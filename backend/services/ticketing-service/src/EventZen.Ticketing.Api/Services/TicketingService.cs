using EventZen.Ticketing.Api.Common;
using EventZen.Ticketing.Api.Contracts;
using EventZen.Ticketing.Api.Domain;
using EventZen.Ticketing.Api.Infrastructure;
using EventZen.Ticketing.Api.Options;
using EventZen.Ticketing.Api.Security;
using Microsoft.Extensions.Options;

namespace EventZen.Ticketing.Api.Services;

public sealed class TicketingService
{
    private readonly ITicketingRepository _repository;
    private readonly EventCatalogClient _eventCatalogClient;
    private readonly INotificationDispatchClient _notificationDispatchClient;
    private readonly QrCodeService _qrCodeService;
    private readonly TicketDeliveryAssetService _ticketDeliveryAssetService;
    private readonly TicketPassStorageService _ticketPassStorageService;
    private readonly JwtOptions _jwtOptions;

    public TicketingService(
        ITicketingRepository repository,
        EventCatalogClient eventCatalogClient,
        INotificationDispatchClient notificationDispatchClient,
        QrCodeService qrCodeService,
        TicketDeliveryAssetService ticketDeliveryAssetService,
        TicketPassStorageService ticketPassStorageService,
        IOptions<JwtOptions> jwtOptions)
    {
        _repository = repository;
        _eventCatalogClient = eventCatalogClient;
        _notificationDispatchClient = notificationDispatchClient;
        _qrCodeService = qrCodeService;
        _ticketDeliveryAssetService = ticketDeliveryAssetService;
        _ticketPassStorageService = ticketPassStorageService;
        _jwtOptions = jwtOptions.Value;
    }

    public async Task<TicketTypeResponse> CreateTicketTypeAsync(Guid eventId, CreateTicketTypeRequest request, CancellationToken cancellationToken)
    {
        if (request.TotalQuantity <= 0)
        {
            throw new EventZenException(400, "VALIDATION_ERROR", "TKT-3006", "TotalQuantity must be greater than zero");
        }

        var ticketType = new TicketTypeDocument
        {
            EventId = eventId,
            TicketName = request.TicketName.Trim(),
            TierCode = request.TierCode.Trim().ToUpperInvariant(),
            Price = request.Price,
            TotalQuantity = request.TotalQuantity,
            AvailableQuantity = request.TotalQuantity,
            MaxPerOrder = Math.Max(1, request.MaxPerOrder),
            Description = request.Description?.Trim(),
            SaleStartsAt = request.SaleStartsAt,
            SaleEndsAt = request.SaleEndsAt
        };

        await _repository.SaveTicketTypeAsync(ticketType, cancellationToken);
        return Map(ticketType);
    }

    public async Task<IReadOnlyList<TicketTypeResponse>> ListTicketTypesAsync(Guid eventId, CancellationToken cancellationToken)
    {
        var ticketTypes = await EnsureSampleTicketTypesForEventAsync(eventId, cancellationToken);
        return ticketTypes.Where(item => item.IsActive).Select(Map).ToList();
    }

    public async Task<RegistrationResponse> RegisterAsync(RegisterAttendeeRequest request, UserContext user, string? idempotencyKey, CancellationToken cancellationToken)
    {
        var eventSnapshot = await _eventCatalogClient.GetEventAsync(request.EventId, cancellationToken);
        EnsureEventIsBookable(eventSnapshot.Status);

        var ticketType = await _repository.GetTicketTypeAsync(request.TicketTypeId, cancellationToken)
                         ?? throw new EventZenException(404, "NOT_FOUND", "TKT-3007", "Ticket type not found");

        if (ticketType.EventId != request.EventId)
        {
            throw new EventZenException(400, "VALIDATION_ERROR", "TKT-3008", "Ticket type does not belong to the requested event");
        }

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var existing = await _repository.FindRegistrationAsync(request.EventId, user.UserId, normalizedEmail, cancellationToken);
        if (existing is not null)
        {
            if (!string.IsNullOrWhiteSpace(idempotencyKey) && string.Equals(existing.IdempotencyKey, idempotencyKey, StringComparison.Ordinal))
            {
                var existingTicket = await _repository.FindTicketByIdAsync(existing.TicketId, cancellationToken)
                                     ?? throw new EventZenException(500, "SYSTEM_ERROR", "SYS-9001", "Ticket was missing for idempotent registration");
                return Map(existing, existingTicket);
            }

            if (existing.Status != RegistrationStatus.Canceled)
            {
                throw new EventZenException(409, "BUSINESS_ERROR", "TKT-3002", "Duplicate registration");
            }
        }

        if (ticketType.AvailableQuantity <= 0)
        {
            throw new EventZenException(409, "BUSINESS_ERROR", "TKT-3001", "No tickets remaining (sold out)");
        }

        var attendee = await EnsureAttendeeAsync(user, request.FirstName, request.LastName, normalizedEmail, request.Phone, cancellationToken);

        // Validate seat reservation if provided
        string? seatRow = null;
        int? seatColumn = null;
        if (!string.IsNullOrWhiteSpace(request.SeatRow) && request.SeatColumn.HasValue)
        {
            seatRow = request.SeatRow.Trim().ToUpperInvariant();
            seatColumn = request.SeatColumn.Value;

            // Verify no permanent booking exists for this seat
            var existingBooking = await _repository.FindSeatBookingAsync(request.EventId, request.TicketTypeId, seatRow, seatColumn.Value, cancellationToken);
            if (existingBooking is not null)
            {
                throw new EventZenException(409, "BUSINESS_ERROR", "TKT-3015", $"Seat {seatRow}{seatColumn} is already booked");
            }

            // Validate the reservation if reservationId provided
            if (request.SeatReservationId.HasValue)
            {
                var reservation = await _repository.GetSeatReservationByIdAsync(request.SeatReservationId.Value, cancellationToken);
                if (reservation is null || reservation.ExpiresAt <= DateTimeOffset.UtcNow)
                {
                    throw new EventZenException(409, "BUSINESS_ERROR", "TKT-3016", "Seat reservation has expired. Please select the seat again.");
                }
                if (!string.Equals(reservation.SeatRow, seatRow, StringComparison.Ordinal) || reservation.SeatColumn != seatColumn)
                {
                    throw new EventZenException(400, "VALIDATION_ERROR", "TKT-3017", "Seat reservation does not match selected seat");
                }
                // Delete the temporary reservation now that we're booking
                await _repository.DeleteSeatReservationAsync(reservation.Id, cancellationToken);
            }
        }

        ticketType.AvailableQuantity -= 1;
        ticketType.UpdatedAt = DateTimeOffset.UtcNow;

        var registration = existing ?? new RegistrationDocument
        {
            EventId = eventSnapshot.Id,
            AttendeeId = attendee.Id,
            AttendeeUserId = user.UserId,
            AttendeeEmail = attendee.Email
        };

        registration.EventTitle = eventSnapshot.Title;
        registration.EventStartTime = eventSnapshot.StartTime;
        registration.EventEndTime = eventSnapshot.EndTime;
        registration.VenueName = eventSnapshot.VenueName;
        registration.VenueCity = eventSnapshot.VenueCity;
        registration.TicketTypeId = ticketType.Id;
        registration.TicketTypeName = ticketType.TicketName;
        registration.SeatRow = seatRow;
        registration.SeatColumn = seatColumn;
        var requiresPayment = ticketType.Price > 0;
        registration.Status = requiresPayment ? RegistrationStatus.Pending : RegistrationStatus.Confirmed;
        registration.IdempotencyKey = idempotencyKey;
        registration.UpdatedAt = DateTimeOffset.UtcNow;
        registration.CancelledAt = null;

        var ticket = new TicketDocument
        {
            RegistrationId = registration.Id,
            EventId = registration.EventId,
            AttendeeId = attendee.Id,
            TicketTypeId = ticketType.Id,
            TicketNumber = $"EZ-{DateTime.UtcNow:yyyyMMdd}-{registration.Id.ToString()[..8].ToUpperInvariant()}",
            SeatRow = seatRow,
            SeatColumn = seatColumn
        };

        var qr = _qrCodeService.Generate(ticket.Id, registration.Id, registration.EventId, _jwtOptions.Secret);
        ticket.QrPayload = qr.Payload;
        ticket.QrSignature = qr.Signature;
        ticket.QrCodeSvgDataUri = qr.DataUri;
        registration.TicketId = ticket.Id;

        // When re-activating a previously cancelled registration, clear any stale seat
        // booking left over from the original booking. Without this, the old seat shows
        // as BOOKED alongside the new seat because both share the same RegistrationId.
        if (existing is not null)
        {
            var staleBooking = await _repository.FindSeatBookingByRegistrationIdAsync(existing.Id, cancellationToken);
            if (staleBooking is not null)
            {
                await _repository.DeleteSeatBookingAsync(staleBooking.Id, cancellationToken);
            }
        }

        await _repository.SaveTicketTypeAsync(ticketType, cancellationToken);
        await _repository.SaveRegistrationAsync(registration, cancellationToken);
        await _repository.SaveTicketAsync(ticket, cancellationToken);

        // Create permanent seat booking record if seat was selected
        if (seatRow != null && seatColumn.HasValue)
        {
            var seatBooking = new SeatBookingDocument
            {
                EventId = registration.EventId,
                TicketTypeId = ticketType.Id,
                SeatRow = seatRow,
                SeatColumn = seatColumn.Value,
                RegistrationId = registration.Id
            };
            await _repository.SaveSeatBookingAsync(seatBooking, cancellationToken);
        }

        if (requiresPayment)
        {
            await _notificationDispatchClient.SendInAppNotificationAsync(
                user.UserId.ToString(),
                user.Email,
                "registration.pending_payment",
                $"Complete payment for {registration.EventTitle}",
                $"Your {registration.TicketTypeName} reservation is pending payment. Complete Razorpay checkout to confirm ticket {ticket.TicketNumber}.",
                new
                {
                    eventId = registration.EventId,
                    eventName = registration.EventTitle,
                    ticketType = registration.TicketTypeName,
                    ticketNumber = ticket.TicketNumber,
                    registrationId = registration.Id,
                    status = registration.Status
                },
                null,
                null,
                cancellationToken);
        }
        else
        {
            await EnsureTicketPassStoredAsync(registration, ticket, cancellationToken);
            await SendRegistrationConfirmedNotificationAsync(
                registration,
                ticket,
                user.UserId.ToString(),
                user.Email,
                cancellationToken);
        }

        return Map(registration, ticket);
    }

    public async Task<RegistrationResponse> ConfirmRegistrationPaymentAsync(Guid registrationId, CancellationToken cancellationToken)
    {
        var registration = await _repository.FindRegistrationByIdAsync(registrationId, cancellationToken)
                           ?? throw new EventZenException(404, "NOT_FOUND", "TKT-3009", "Registration not found");
        var ticket = await _repository.FindTicketByIdAsync(registration.TicketId, cancellationToken)
                     ?? throw new EventZenException(404, "NOT_FOUND", "TKT-3010", "Ticket not found");

        if (registration.Status == RegistrationStatus.Canceled)
        {
            throw new EventZenException(409, "BUSINESS_ERROR", "TKT-3013", "Canceled registrations cannot be confirmed");
        }

        if (registration.Status == RegistrationStatus.Confirmed || registration.Status == RegistrationStatus.CheckedIn)
        {
            return Map(registration, ticket);
        }

        registration.Status = RegistrationStatus.Confirmed;
        registration.UpdatedAt = DateTimeOffset.UtcNow;
        await _repository.SaveRegistrationAsync(registration, cancellationToken);
        await EnsureTicketPassStoredAsync(registration, ticket, cancellationToken);

        await SendRegistrationConfirmedNotificationAsync(
            registration,
            ticket,
            registration.AttendeeUserId?.ToString() ?? string.Empty,
            registration.AttendeeEmail,
            cancellationToken);

        return Map(registration, ticket);
    }

    public async Task<IReadOnlyList<RegistrationResponse>> ListRegistrationsForEventAsync(Guid eventId, CancellationToken cancellationToken)
    {
        var registrations = await _repository.ListRegistrationsForEventAsync(eventId, cancellationToken);
        return await HydrateRegistrationsAsync(registrations, cancellationToken);
    }

    public async Task<IReadOnlyList<RegistrationResponse>> ListMyRegistrationsAsync(UserContext user, CancellationToken cancellationToken)
    {
        var registrations = await _repository.ListRegistrationsForUserAsync(user.UserId, user.Email, cancellationToken);
        return await HydrateRegistrationsAsync(registrations, cancellationToken);
    }

    public async Task CancelRegistrationAsync(Guid registrationId, UserContext user, CancellationToken cancellationToken)
    {
        var registration = await _repository.FindRegistrationByIdAsync(registrationId, cancellationToken)
                           ?? throw new EventZenException(404, "NOT_FOUND", "TKT-3009", "Registration not found");

        if (!user.HasRole("ADMIN") && registration.AttendeeUserId != user.UserId && !string.Equals(registration.AttendeeEmail, user.Email, StringComparison.OrdinalIgnoreCase))
        {
            throw new EventZenException(403, "AUTHORIZATION_ERROR", "AUTH-1003", "Insufficient permissions for registration");
        }

        if (registration.Status == RegistrationStatus.Canceled)
        {
            return;
        }

        registration.Status = RegistrationStatus.Canceled;
        registration.CancelledAt = DateTimeOffset.UtcNow;
        registration.UpdatedAt = DateTimeOffset.UtcNow;
        await _repository.SaveRegistrationAsync(registration, cancellationToken);

        var ticket = await _repository.FindTicketByIdAsync(registration.TicketId, cancellationToken);
        if (ticket is not null)
        {
            ticket.Status = TicketStatus.Canceled;
            ticket.UpdatedAt = DateTimeOffset.UtcNow;
            await _repository.SaveTicketAsync(ticket, cancellationToken);
        }

        // Free up the seat BEFORE waitlist promotion / notification so it always runs
        // even if later steps throw. This also fixes any orphaned bookings from older data.
        var seatBooking = await _repository.FindSeatBookingByRegistrationIdAsync(registration.Id, cancellationToken);
        if (seatBooking is not null)
        {
            await _repository.DeleteSeatBookingAsync(seatBooking.Id, cancellationToken);
        }

        var ticketType = await _repository.GetTicketTypeAsync(registration.TicketTypeId, cancellationToken);
        if (ticketType is not null)
        {
            ticketType.AvailableQuantity += 1;
            ticketType.UpdatedAt = DateTimeOffset.UtcNow;
            await _repository.SaveTicketTypeAsync(ticketType, cancellationToken);
            await PromoteWaitlistedAttendeeAsync(registration.EventId, registration.TicketTypeId, cancellationToken);
        }

        await _notificationDispatchClient.SendInAppNotificationAsync(
            registration.AttendeeUserId?.ToString() ?? user.UserId.ToString(),
            registration.AttendeeEmail,
            "registration.cancelled",
            $"Registration cancelled for {registration.EventTitle}",
            $"Your {registration.TicketTypeName} registration has been cancelled.",
            new
            {
                eventId = registration.EventId,
                eventName = registration.EventTitle,
                ticketType = registration.TicketTypeName,
                registrationId = registration.Id,
                cancelledAt = registration.CancelledAt
            },
            null,
            null,
            cancellationToken);
    }

    public async Task<TicketResponse> GetTicketAsync(Guid ticketId, UserContext user, CancellationToken cancellationToken)
    {
        var ticket = await _repository.FindTicketByIdAsync(ticketId, cancellationToken)
                     ?? throw new EventZenException(404, "NOT_FOUND", "TKT-3010", "Ticket not found");
        var registration = await _repository.FindRegistrationByIdAsync(ticket.RegistrationId, cancellationToken)
                           ?? throw new EventZenException(404, "NOT_FOUND", "TKT-3009", "Registration not found");

        if (!user.HasRole("ADMIN") && registration.AttendeeUserId != user.UserId && !string.Equals(registration.AttendeeEmail, user.Email, StringComparison.OrdinalIgnoreCase))
        {
            throw new EventZenException(403, "AUTHORIZATION_ERROR", "AUTH-1003", "Insufficient permissions for ticket");
        }

        await EnsureTicketPassStoredAsync(registration, ticket, cancellationToken);
        return Map(ticket);
    }

    public async Task<IReadOnlyList<TicketResponse>> ListMyTicketsAsync(UserContext user, CancellationToken cancellationToken)
    {
        var tickets = await _repository.ListTicketsForUserAsync(user.UserId, user.Email, cancellationToken);
        var responses = new List<TicketResponse>(tickets.Count);
        foreach (var ticket in tickets)
        {
            var registration = await _repository.FindRegistrationByIdAsync(ticket.RegistrationId, cancellationToken);
            if (registration is not null)
            {
                await EnsureTicketPassStoredAsync(registration, ticket, cancellationToken);
            }

            responses.Add(Map(ticket));
        }

        return responses;
    }

    public async Task<RegistrationResponse> ScanAsync(CheckInScanRequest request, UserContext user, CancellationToken cancellationToken)
    {
        var scannedValue = request.QrPayload.Trim();
        var separatorIndex = scannedValue.LastIndexOf('.');
        var payload = separatorIndex > 0 ? scannedValue[..separatorIndex] : scannedValue;
        var scannedSignature = separatorIndex > 0 ? scannedValue[(separatorIndex + 1)..] : null;

        var ticket = await _repository.FindTicketByPayloadAsync(payload, cancellationToken)
                     ?? throw new EventZenException(404, "NOT_FOUND", "TKT-3010", "Ticket not found");

        var expectedSignature = JwtTokenService.Base64UrlEncode(JwtTokenService.HmacSha256(payload, _jwtOptions.Secret));
        if (!string.IsNullOrWhiteSpace(scannedSignature) &&
            !string.Equals(scannedSignature, expectedSignature, StringComparison.Ordinal))
        {
            throw new EventZenException(400, "VALIDATION_ERROR", "TKT-3011", "QR signature verification failed");
        }

        if (!string.Equals(ticket.QrSignature, expectedSignature, StringComparison.Ordinal))
        {
            throw new EventZenException(400, "VALIDATION_ERROR", "TKT-3011", "QR signature verification failed");
        }

        var registration = await _repository.FindRegistrationByIdAsync(ticket.RegistrationId, cancellationToken)
                           ?? throw new EventZenException(404, "NOT_FOUND", "TKT-3009", "Registration not found");

        if (await _repository.HasCheckInAsync(registration.Id, cancellationToken))
        {
            throw new EventZenException(409, "BUSINESS_ERROR", "TKT-3012", "Attendee already checked in");
        }

        var checkIn = new CheckInLogDocument
        {
            EventId = registration.EventId,
            RegistrationId = registration.Id,
            TicketId = ticket.Id,
            Gate = string.IsNullOrWhiteSpace(request.Gate) ? "MAIN" : request.Gate.Trim().ToUpperInvariant(),
            ScannedByUserId = user.UserId.ToString()
        };

        registration.Status = RegistrationStatus.CheckedIn;
        registration.CheckedInAt = DateTimeOffset.UtcNow;
        registration.UpdatedAt = DateTimeOffset.UtcNow;
        ticket.Status = TicketStatus.CheckedIn;
        ticket.UpdatedAt = DateTimeOffset.UtcNow;

        await _repository.SaveCheckInAsync(checkIn, cancellationToken);
        await _repository.SaveRegistrationAsync(registration, cancellationToken);
        await _repository.SaveTicketAsync(ticket, cancellationToken);

        return Map(registration, ticket);
    }

    public async Task<CheckInStatsResponse> GetCheckInStatsAsync(Guid eventId, CancellationToken cancellationToken)
    {
        var registrations = await _repository.ListRegistrationsForEventAsync(eventId, cancellationToken);
        var checkIns = await _repository.ListCheckInsForEventAsync(eventId, cancellationToken);
        var total = registrations.Count(item => item.Status != RegistrationStatus.Canceled);
        var checkedIn = checkIns.Count;
        var pending = Math.Max(0, total - checkedIn);
        var rate = total == 0 ? 0 : Math.Round((decimal)checkedIn / total * 100, 2);

        return new CheckInStatsResponse(
            eventId,
            total,
            checkedIn,
            pending,
            rate,
            checkIns.Take(10).Select(item => new RecentCheckInResponse(item.RegistrationId, item.TicketId, item.Gate, item.CheckInTime)).ToList()
        );
    }

    public async Task<WaitlistResponse> JoinWaitlistAsync(Guid eventId, JoinWaitlistRequest request, UserContext user, CancellationToken cancellationToken)
    {
        var eventSnapshot = await _eventCatalogClient.GetEventAsync(eventId, cancellationToken);
        EnsureEventIsBookable(eventSnapshot.Status);

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var existing = await _repository.FindActiveWaitlistEntryAsync(eventId, user.UserId, normalizedEmail, cancellationToken);
        if (existing is not null)
        {
            return new WaitlistResponse(existing.Id, existing.EventId, existing.TicketTypeId, existing.Status, existing.CreatedAt);
        }

        var attendee = await EnsureAttendeeAsync(user, request.FirstName, request.LastName, normalizedEmail, request.Phone, cancellationToken);
        var entry = new WaitlistEntryDocument
        {
            EventId = eventId,
            TicketTypeId = request.TicketTypeId,
            AttendeeId = attendee.Id,
            AttendeeUserId = user.UserId,
            AttendeeEmail = attendee.Email
        };

        await _repository.SaveWaitlistEntryAsync(entry, cancellationToken);
        return new WaitlistResponse(entry.Id, entry.EventId, entry.TicketTypeId, entry.Status, entry.CreatedAt);
    }

    // -----------------------------------------------------------------------
    // Seat map and reservation
    // -----------------------------------------------------------------------

    public async Task<SeatMapResponse> GetSeatMapAsync(Guid eventId, Guid ticketTypeId, CancellationToken cancellationToken)
    {
        var ticketType = await _repository.GetTicketTypeAsync(ticketTypeId, cancellationToken)
                         ?? throw new EventZenException(404, "NOT_FOUND", "TKT-3007", "Ticket type not found");

        if (ticketType.EventId != eventId)
        {
            throw new EventZenException(400, "VALIDATION_ERROR", "TKT-3008", "Ticket type does not belong to this event");
        }

        var capacity = ticketType.TotalQuantity;
        var seatsPerRow = ComputeSeatsPerRow(capacity);
        var totalRows = (int)Math.Ceiling((double)capacity / seatsPerRow);

        var reservations = await _repository.ListActiveSeatReservationsAsync(eventId, ticketTypeId, cancellationToken);
        var bookings = await _repository.ListSeatBookingsAsync(eventId, ticketTypeId, cancellationToken);

        // Exclude seat bookings whose registration has been cancelled so cancellations
        // are reflected immediately even if the booking document was not cleaned up.
        HashSet<Guid> cancelledRegistrationIds = [];
        if (bookings.Count > 0)
        {
            var allRegistrations = await _repository.ListRegistrationsForEventAsync(eventId, cancellationToken);
            foreach (var reg in allRegistrations)
            {
                if (reg.Status == RegistrationStatus.Canceled)
                    cancelledRegistrationIds.Add(reg.Id);
            }
        }

        var reservedSet = reservations.ToDictionary(r => (r.SeatRow, r.SeatColumn), r => r.ExpiresAt);
        var bookedSet = new HashSet<(string, int)>(
            bookings
                .Where(b => !cancelledRegistrationIds.Contains(b.RegistrationId))
                .Select(b => (b.SeatRow, b.SeatColumn)));

        var rows = new List<SeatRowDto>(totalRows);
        var availableCount = 0;
        var reservedCount = 0;
        var bookedCount = 0;
        var seatsAssigned = 0;

        for (var rowIndex = 0; rowIndex < totalRows; rowIndex++)
        {
            var rowLabel = GetRowLabel(rowIndex);
            var seatsInThisRow = Math.Min(seatsPerRow, capacity - seatsAssigned);
            var seats = new List<SeatInfoDto>(seatsInThisRow);

            for (var col = 1; col <= seatsInThisRow; col++)
            {
                string status;
                DateTimeOffset? expiresAt = null;

                if (bookedSet.Contains((rowLabel, col)))
                {
                    status = SeatStatus.Booked;
                    bookedCount++;
                }
                else if (reservedSet.TryGetValue((rowLabel, col), out var expiry))
                {
                    status = SeatStatus.Reserved;
                    expiresAt = expiry;
                    reservedCount++;
                }
                else
                {
                    status = SeatStatus.Available;
                    availableCount++;
                }

                seats.Add(new SeatInfoDto(rowLabel, col, $"{rowLabel}{col}", status, expiresAt));
            }

            rows.Add(new SeatRowDto(rowLabel, seats));
            seatsAssigned += seatsInThisRow;
        }

        return new SeatMapResponse(
            eventId,
            ticketTypeId,
            ticketType.TicketName,
            capacity,
            seatsPerRow,
            totalRows,
            availableCount,
            reservedCount,
            bookedCount,
            rows
        );
    }

    public async Task<SeatReservationResponse> ReserveSeatAsync(Guid eventId, Guid ticketTypeId, ReserveSeatRequest request, UserContext user, CancellationToken cancellationToken)
    {
        var ticketType = await _repository.GetTicketTypeAsync(ticketTypeId, cancellationToken)
                         ?? throw new EventZenException(404, "NOT_FOUND", "TKT-3007", "Ticket type not found");

        if (ticketType.EventId != eventId)
        {
            throw new EventZenException(400, "VALIDATION_ERROR", "TKT-3008", "Ticket type does not belong to this event");
        }

        var seatRow = request.SeatRow.Trim().ToUpperInvariant();
        var seatColumn = request.SeatColumn;

        // Validate seat is within layout bounds
        var capacity = ticketType.TotalQuantity;
        var seatsPerRow = ComputeSeatsPerRow(capacity);
        var totalRows = (int)Math.Ceiling((double)capacity / seatsPerRow);
        var rowIndex = seatRow.Length == 1
            ? seatRow[0] - 'A'
            : 26 + (seatRow[1] - 'A');

        if (rowIndex < 0 || rowIndex >= totalRows)
        {
            throw new EventZenException(400, "VALIDATION_ERROR", "TKT-3018", $"Seat row '{seatRow}' is out of range for this event");
        }

        var seatsInRow = rowIndex == totalRows - 1 ? capacity - (seatsPerRow * (totalRows - 1)) : seatsPerRow;
        if (seatColumn < 1 || seatColumn > seatsInRow)
        {
            throw new EventZenException(400, "VALIDATION_ERROR", "TKT-3019", $"Seat column {seatColumn} is out of range for row {seatRow}");
        }

        // Check if permanently booked
        var existingBooking = await _repository.FindSeatBookingAsync(eventId, ticketTypeId, seatRow, seatColumn, cancellationToken);
        if (existingBooking is not null)
        {
            throw new EventZenException(409, "BUSINESS_ERROR", "TKT-3015", $"Seat {seatRow}{seatColumn} is already booked");
        }

        // Auto-cancel any prior reservation this user holds for a different seat in the same ticket type
        var priorUserReservation = await _repository.FindActiveUserReservationAsync(eventId, ticketTypeId, user.UserId, cancellationToken);
        if (priorUserReservation is not null && !(priorUserReservation.SeatRow == seatRow && priorUserReservation.SeatColumn == seatColumn))
        {
            await _repository.DeleteSeatReservationAsync(priorUserReservation.Id, cancellationToken);
        }

        // Check if actively reserved by someone else
        var existingReservation = await _repository.FindActiveSeatReservationAsync(eventId, ticketTypeId, seatRow, seatColumn, cancellationToken);
        if (existingReservation is not null && existingReservation.UserId != user.UserId)
        {
            var secondsLeft = (int)(existingReservation.ExpiresAt - DateTimeOffset.UtcNow).TotalSeconds;
            throw new EventZenException(409, "BUSINESS_ERROR", "TKT-3020", $"Seat {seatRow}{seatColumn} is reserved for another {secondsLeft} seconds");
        }

        // If same user already has an active reservation for this seat, refresh it
        if (existingReservation is not null && existingReservation.UserId == user.UserId)
        {
            existingReservation.ExpiresAt = DateTimeOffset.UtcNow.AddMinutes(10);
            await _repository.SaveSeatReservationAsync(existingReservation, cancellationToken);
            return new SeatReservationResponse(
                existingReservation.Id,
                eventId,
                ticketTypeId,
                seatRow,
                seatColumn,
                $"{seatRow}{seatColumn}",
                existingReservation.ExpiresAt,
                600
            );
        }

        var reservation = new SeatReservationDocument
        {
            EventId = eventId,
            TicketTypeId = ticketTypeId,
            SeatRow = seatRow,
            SeatColumn = seatColumn,
            UserId = user.UserId,
            ExpiresAt = DateTimeOffset.UtcNow.AddMinutes(10)
        };

        await _repository.SaveSeatReservationAsync(reservation, cancellationToken);

        return new SeatReservationResponse(
            reservation.Id,
            eventId,
            ticketTypeId,
            seatRow,
            seatColumn,
            $"{seatRow}{seatColumn}",
            reservation.ExpiresAt,
            600
        );
    }

    public async Task CancelReservationAsync(Guid ticketTypeId, Guid reservationId, UserContext user, CancellationToken cancellationToken)
    {
        var reservation = await _repository.GetSeatReservationByIdAsync(reservationId, cancellationToken)
            ?? throw new EventZenException(404, "NOT_FOUND", "TKT-3021", "Seat reservation not found");

        if (reservation.TicketTypeId != ticketTypeId)
            throw new EventZenException(400, "VALIDATION_ERROR", "TKT-3022", "Reservation does not belong to this ticket type");

        if (reservation.UserId != user.UserId)
            throw new EventZenException(403, "FORBIDDEN", "TKT-3023", "You do not own this reservation");

        await _repository.DeleteSeatReservationAsync(reservationId, cancellationToken);
    }

    private static int ComputeSeatsPerRow(int capacity)
    {
        var sqrt = (int)Math.Ceiling(Math.Sqrt((double)capacity));
        return Math.Min(20, Math.Max(10, sqrt));
    }

    private static string GetRowLabel(int rowIndex)
    {
        if (rowIndex < 26)
        {
            return ((char)('A' + rowIndex)).ToString();
        }
        return "A" + ((char)('A' + (rowIndex - 26)));
    }

    public async Task<CsvImportResponse> ImportAttendeesAsync(IFormFile file, CancellationToken cancellationToken)    {
        if (file.Length == 0)
        {
            throw new EventZenException(400, "VALIDATION_ERROR", "TKT-3013", "CSV file is empty");
        }

        var errors = new List<string>();
        var imported = 0;

        using var reader = new StreamReader(file.OpenReadStream());
        var row = 0;
        while (await reader.ReadLineAsync(cancellationToken) is { } line)
        {
            row++;
            if (row == 1 && line.Contains("first", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var columns = line.Split(',');
            if (columns.Length < 3)
            {
                errors.Add($"Row {row}: expected firstName,lastName,email,phone");
                continue;
            }

            var email = columns[2].Trim().ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(email))
            {
                errors.Add($"Row {row}: email is required");
                continue;
            }

            var attendee = await _repository.FindAttendeeByEmailAsync(email, cancellationToken) ?? new AttendeeDocument();
            attendee.FirstName = columns[0].Trim();
            attendee.LastName = columns[1].Trim();
            attendee.Email = email;
            attendee.Phone = columns.Length > 3 ? columns[3].Trim() : null;
            attendee.UpdatedAt = DateTimeOffset.UtcNow;
            await _repository.UpsertAttendeeAsync(attendee, cancellationToken);
            imported++;
        }

        return new CsvImportResponse(imported, errors);
    }

    private async Task PromoteWaitlistedAttendeeAsync(Guid eventId, Guid ticketTypeId, CancellationToken cancellationToken)
    {
        var next = await _repository.GetNextWaitlistEntryAsync(eventId, ticketTypeId, cancellationToken);
        if (next is null)
        {
            return;
        }

        var attendee = await _repository.FindAttendeeByEmailAsync(next.AttendeeEmail, cancellationToken);
        var ticketType = await _repository.GetTicketTypeAsync(ticketTypeId, cancellationToken);
        if (attendee is null || ticketType is null || ticketType.AvailableQuantity <= 0)
        {
            return;
        }

        var eventSnapshot = await _eventCatalogClient.GetEventAsync(eventId, cancellationToken);
        ticketType.AvailableQuantity -= 1;
        ticketType.UpdatedAt = DateTimeOffset.UtcNow;

        var existing = await _repository.FindRegistrationAsync(eventId, next.AttendeeUserId, attendee.Email, cancellationToken);
        var registration = existing ?? new RegistrationDocument
        {
            EventId = eventId,
            AttendeeId = attendee.Id,
            AttendeeUserId = next.AttendeeUserId,
            AttendeeEmail = attendee.Email
        };

        registration.EventTitle = eventSnapshot.Title;
        registration.EventStartTime = eventSnapshot.StartTime;
        registration.EventEndTime = eventSnapshot.EndTime;
        registration.VenueName = eventSnapshot.VenueName;
        registration.VenueCity = eventSnapshot.VenueCity;
        registration.TicketTypeId = ticketType.Id;
        registration.TicketTypeName = ticketType.TicketName;
        registration.Status = RegistrationStatus.Confirmed;
        registration.UpdatedAt = DateTimeOffset.UtcNow;
        registration.CancelledAt = null;

        var ticket = new TicketDocument
        {
            RegistrationId = registration.Id,
            EventId = eventId,
            AttendeeId = attendee.Id,
            TicketTypeId = ticketType.Id,
            TicketNumber = $"EZ-{DateTime.UtcNow:yyyyMMdd}-{registration.Id.ToString()[..8].ToUpperInvariant()}"
        };

        var qr = _qrCodeService.Generate(ticket.Id, registration.Id, registration.EventId, _jwtOptions.Secret);
        ticket.QrPayload = qr.Payload;
        ticket.QrSignature = qr.Signature;
        ticket.QrCodeSvgDataUri = qr.DataUri;
        registration.TicketId = ticket.Id;

        next.Status = WaitlistStatus.Promoted;
        next.PromotedAt = DateTimeOffset.UtcNow;

        await _repository.SaveTicketTypeAsync(ticketType, cancellationToken);
        await _repository.SaveRegistrationAsync(registration, cancellationToken);
        await _repository.SaveTicketAsync(ticket, cancellationToken);
        await _repository.SaveWaitlistEntryAsync(next, cancellationToken);
        await EnsureTicketPassStoredAsync(registration, ticket, cancellationToken);
    }

    private async Task<AttendeeDocument> EnsureAttendeeAsync(UserContext user, string firstName, string lastName, string email, string? phone, CancellationToken cancellationToken)
    {
        var attendee = await _repository.FindAttendeeByUserIdAsync(user.UserId, cancellationToken)
                       ?? await _repository.FindAttendeeByEmailAsync(email, cancellationToken)
                       ?? new AttendeeDocument();

        attendee.UserId = user.UserId;
        attendee.FirstName = firstName.Trim();
        attendee.LastName = lastName.Trim();
        attendee.Email = email;
        attendee.Phone = phone?.Trim();
        attendee.UpdatedAt = DateTimeOffset.UtcNow;
        return await _repository.UpsertAttendeeAsync(attendee, cancellationToken);
    }

    private async Task<IReadOnlyList<TicketTypeDocument>> EnsureSampleTicketTypesForEventAsync(Guid eventId, CancellationToken cancellationToken)
    {
        var ticketTypes = await _repository.ListTicketTypesAsync(eventId, cancellationToken);
        if (ticketTypes.Count > 0)
        {
            return ticketTypes;
        }

        var seededTicketTypes = SampleTicketCatalog.GetForEvent(eventId);
        if (seededTicketTypes.Count == 0)
        {
            return ticketTypes;
        }

        foreach (var ticketType in seededTicketTypes)
        {
            await _repository.SaveTicketTypeAsync(ticketType, cancellationToken);
        }

        return await _repository.ListTicketTypesAsync(eventId, cancellationToken);
    }

    private static void EnsureEventIsBookable(string status)
    {
        if (!string.Equals(status, "PUBLISHED", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(status, "REGISTRATION_OPEN", StringComparison.OrdinalIgnoreCase))
        {
            throw new EventZenException(409, "BUSINESS_ERROR", "TKT-3014", "Registration is not available until the event is published or registration is opened");
        }
    }

    private async Task<IReadOnlyList<RegistrationResponse>> HydrateRegistrationsAsync(IReadOnlyList<RegistrationDocument> registrations, CancellationToken cancellationToken)
    {
        var responses = new List<RegistrationResponse>(registrations.Count);
        foreach (var registration in registrations)
        {
            var ticket = await _repository.FindTicketByIdAsync(registration.TicketId, cancellationToken)
                         ?? throw new EventZenException(500, "SYSTEM_ERROR", "SYS-9001", "Ticket missing for registration");
            await EnsureTicketPassStoredAsync(registration, ticket, cancellationToken);
            responses.Add(Map(registration, ticket));
        }

        return responses;
    }

    private static TicketTypeResponse Map(TicketTypeDocument ticketType) => new(
        ticketType.Id,
        ticketType.EventId,
        ticketType.TicketName,
        ticketType.TierCode,
        ticketType.Price,
        ticketType.TotalQuantity,
        ticketType.AvailableQuantity,
        ticketType.MaxPerOrder,
        ticketType.Description,
        ticketType.IsActive,
        ticketType.SaleStartsAt,
        ticketType.SaleEndsAt
    );

    private static RegistrationResponse Map(RegistrationDocument registration, TicketDocument ticket)
    {
        var seatLabel = (registration.SeatRow != null && registration.SeatColumn.HasValue)
            ? $"{registration.SeatRow}{registration.SeatColumn}"
            : null;
        return new(
            registration.Id,
            registration.EventId,
            registration.EventTitle,
            registration.EventStartTime,
            registration.EventEndTime,
            registration.VenueName,
            registration.VenueCity,
            registration.TicketTypeName,
            registration.Status,
            registration.CreatedAt,
            registration.CheckedInAt,
            Map(ticket),
            registration.SeatRow,
            registration.SeatColumn,
            seatLabel
        );
    }

    private async Task SendRegistrationConfirmedNotificationAsync(
        RegistrationDocument registration,
        TicketDocument ticket,
        string userId,
        string email,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(userId) || string.IsNullOrWhiteSpace(email))
        {
            return;
        }

        await _notificationDispatchClient.SendInAppNotificationAsync(
            userId,
            email,
            "registration.confirmed",
            $"Ticket confirmed for {registration.EventTitle}",
            $"Your {registration.TicketTypeName} ticket is ready. Ticket number: {ticket.TicketNumber}.",
            new
            {
                eventId = registration.EventId,
                eventName = registration.EventTitle,
                ticketType = registration.TicketTypeName,
                ticketNumber = ticket.TicketNumber,
                registrationId = registration.Id,
                status = registration.Status
            },
            _ticketDeliveryAssetService.BuildConfirmationEmailHtml(registration, ticket),
            BuildTicketPassAttachments(registration, ticket),
            cancellationToken);
    }

    private async Task EnsureTicketPassStoredAsync(
        RegistrationDocument registration,
        TicketDocument ticket,
        CancellationToken cancellationToken)
    {
        if (!_ticketPassStorageService.IsEnabled || !string.IsNullOrWhiteSpace(ticket.TicketPassUrl))
        {
            return;
        }

        var pdfBytes = _ticketDeliveryAssetService.BuildTicketPassPdf(registration, ticket);
        var storedPass = await _ticketPassStorageService.UploadAsync(registration, ticket, pdfBytes, cancellationToken);
        if (storedPass is null)
        {
            return;
        }

        ticket.TicketPassObjectKey = storedPass.ObjectKey;
        ticket.TicketPassUrl = storedPass.PublicUrl;
        ticket.UpdatedAt = DateTimeOffset.UtcNow;
        await _repository.SaveTicketAsync(ticket, cancellationToken);
    }

    private IReadOnlyList<NotificationEmailAttachment> BuildTicketPassAttachments(
        RegistrationDocument registration,
        TicketDocument ticket)
    {
        var safeTicketNumber = ticket.TicketNumber.Replace('/', '-');
        var fileName = $"EventZen-Ticket-{safeTicketNumber}.pdf";
        var pdfBytes = _ticketDeliveryAssetService.BuildTicketPassPdf(registration, ticket);

        return
        [
            new NotificationEmailAttachment(
                fileName,
                Convert.ToBase64String(pdfBytes),
                "application/pdf")
        ];
    }

    private static TicketResponse Map(TicketDocument ticket)
    {
        var seatLabel = (ticket.SeatRow != null && ticket.SeatColumn.HasValue)
            ? $"{ticket.SeatRow}{ticket.SeatColumn}"
            : null;
        return new(
            ticket.Id,
            ticket.TicketNumber,
            ticket.Status,
            ticket.QrPayload,
            ticket.QrSignature,
            ticket.QrCodeSvgDataUri,
            ticket.TicketPassUrl,
            ticket.SeatRow,
            ticket.SeatColumn,
            seatLabel
        );
    }
}
