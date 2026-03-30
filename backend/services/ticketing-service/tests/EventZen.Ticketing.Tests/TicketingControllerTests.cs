/*
 * TicketingControllerTests.cs
 * ─────────────────────────────────────────────────────────────────────────────
 * HTTP-level integration tests for EventZen Ticketing Service.
 *
 * Strategy
 * ────────
 *  • Uses WebApplicationFactory<Program> so the real ASP.NET Core pipeline runs
 *    (middleware, controllers, TicketingService) against an in-memory repository.
 *  • Sets the host environment to "Development" to enable the dev-header
 *    authentication fallback (x-user-id / x-user-email / x-user-roles).
 *  • Replaces ITicketingRepository with InMemoryTicketingRepository.
 *  • Replaces INotificationDispatchClient with a no-op stub.
 *  • Replaces the EventCatalogClient's HTTP handler with a stub that returns a
 *    valid REGISTRATION_OPEN event for any request.
 *  • Removes SampleTicketingSeeder to avoid background MongoDB access.
 *  • Each test uses unique GUIDs for event / user IDs to prevent cross-test
 *    state pollution.
 */

using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using EventZen.Ticketing.Api.Contracts;
using EventZen.Ticketing.Api.Domain;
using EventZen.Ticketing.Api.Infrastructure;
using EventZen.Ticketing.Api.Options;
using EventZen.Ticketing.Api.Security;
using EventZen.Ticketing.Api.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace EventZen.Ticketing.Tests;

// ─────────────────────────────────────────────────────────────────────────────
// Shared WebApplicationFactory
// ─────────────────────────────────────────────────────────────────────────────

public sealed class TicketingWebApplicationFactory : WebApplicationFactory<Program>
{
    public TicketingIntegrationRepository Repository { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");

        builder.ConfigureTestServices(services =>
        {
            // ── Remove SampleTicketingSeeder so it won't attempt MongoDB access ──
            var seeder = services.SingleOrDefault(
                d => d.ImplementationType == typeof(SampleTicketingSeeder));
            if (seeder != null) services.Remove(seeder);

            // ── Replace MongoTicketingRepository with in-memory version ──
            var repoDescriptors = services
                .Where(d => d.ServiceType == typeof(ITicketingRepository))
                .ToList();
            foreach (var d in repoDescriptors) services.Remove(d);
            services.AddSingleton<ITicketingRepository>(Repository);

            // ── Replace HTTP-based notification client with no-op ──
            var notifDescriptors = services
                .Where(d => d.ServiceType == typeof(INotificationDispatchClient))
                .ToList();
            foreach (var d in notifDescriptors) services.Remove(d);
            services.AddSingleton<INotificationDispatchClient>(new IntegrationNoOpNotificationClient());

            // ── Replace EventCatalogClient's primary HTTP handler with a stub ──
            services.AddHttpClient<EventCatalogClient>()
                .ConfigurePrimaryHttpMessageHandler(() => new StubEventCatalogHandler());
        });

        builder.ConfigureAppConfiguration((_, cfg) =>
            cfg.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Secret"] = "change-me-change-me-change-me-change-me-1234567890",
                ["Jwt:Issuer"] = "eventzen-auth-service",
                ["NotificationService:InternalServiceKey"] = "test-internal-key",
                ["Mongo:ConnectionString"] = "mongodb://localhost:27017",
                ["Mongo:DatabaseName"] = "eventzen_ticketing_test",
                ["EventService:BaseUrl"] = "http://localhost:8082",
                ["Storage:Enabled"] = "false",
            }));
    }

    // ── No-op notification dispatch ──
    private sealed class IntegrationNoOpNotificationClient : INotificationDispatchClient
    {
        public Task SendInAppNotificationAsync(
            string userId, string? email, string eventType, string title,
            string body, object? metadata, string? html,
            IReadOnlyList<NotificationEmailAttachment>? attachments,
            CancellationToken cancellationToken) => Task.CompletedTask;
    }

    // ── Stub event catalog: always returns a valid REGISTRATION_OPEN event ──
    private sealed class StubEventCatalogHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var eventId = ExtractFirstGuid(request.RequestUri?.AbsolutePath) ?? Guid.NewGuid();
            var body = $$"""
                {
                  "event": {
                    "id": "{{eventId}}",
                    "title": "Integration Test Event",
                    "startTime": "2026-12-01T09:00:00Z",
                    "endTime": "2026-12-01T17:00:00Z",
                    "venueName": "Test Arena",
                    "venueCity": "Test City",
                    "status": "REGISTRATION_OPEN"
                  }
                }
                """;
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(body, Encoding.UTF8, "application/json")
            });
        }

        private static Guid? ExtractFirstGuid(string? path)
        {
            if (path is null) return null;
            foreach (var seg in path.Split('/', StringSplitOptions.RemoveEmptyEntries))
                if (Guid.TryParse(seg, out var g)) return g;
            return null;
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Integration Test Class
// ─────────────────────────────────────────────────────────────────────────────

[Collection("ticketing-integration")]
public sealed class TicketingControllerTests : IClassFixture<TicketingWebApplicationFactory>
{
    private readonly TicketingWebApplicationFactory _factory;
    private readonly HttpClient _client;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public TicketingControllerTests(TicketingWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helper: attach dev-header auth to a request message
    // ─────────────────────────────────────────────────────────────────────────
    private static HttpRequestMessage WithAdmin(HttpRequestMessage req, Guid? userId = null)
    {
        req.Headers.Add("x-user-id", (userId ?? Guid.NewGuid()).ToString());
        req.Headers.Add("x-user-email", "admin@eventzen.local");
        req.Headers.Add("x-user-roles", "ADMIN");
        return req;
    }

    private static HttpRequestMessage WithOrganizer(HttpRequestMessage req, Guid? userId = null)
    {
        req.Headers.Add("x-user-id", (userId ?? Guid.NewGuid()).ToString());
        req.Headers.Add("x-user-email", "organizer@eventzen.local");
        req.Headers.Add("x-user-roles", "ORGANIZER");
        return req;
    }

    private static HttpRequestMessage WithAttendee(HttpRequestMessage req, Guid userId, string email = "attendee@eventzen.local")
    {
        req.Headers.Add("x-user-id", userId.ToString());
        req.Headers.Add("x-user-email", email);
        req.Headers.Add("x-user-roles", "ATTENDEE");
        return req;
    }

    private static HttpRequestMessage WithStaff(HttpRequestMessage req, Guid? userId = null)
    {
        req.Headers.Add("x-user-id", (userId ?? Guid.NewGuid()).ToString());
        req.Headers.Add("x-user-email", "staff@eventzen.local");
        req.Headers.Add("x-user-roles", "STAFF");
        return req;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TKT-CT-001: Health endpoint responds OK
    // ─────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task TKT_CT_001_HealthEndpoint_Returns200()
    {
        var response = await _client.GetAsync("/api/v1/health");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TKT-CT-002: List ticket types – public endpoint returns 200 for unknown event
    // ─────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task TKT_CT_002_ListTicketTypes_PublicAccess_Returns200EmptyArray()
    {
        var eventId = Guid.NewGuid();
        var response = await _client.GetAsync($"/api/v1/ticket-types?eventId={eventId}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        Assert.Equal(JsonValueKind.Array, doc.RootElement.ValueKind);
        Assert.Equal(0, doc.RootElement.GetArrayLength());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TKT-CT-003: Create ticket type – unauthenticated request is rejected (401)
    // ─────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task TKT_CT_003_CreateTicketType_NoAuth_Returns401()
    {
        var eventId = Guid.NewGuid();
        var req = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/events/{eventId}/ticket-types")
        {
            Content = JsonContent.Create(new
            {
                TicketName = "VIP",
                TierCode = "VIP",
                Price = 299,
                TotalQuantity = 50,
                MaxPerOrder = 2
            })
        };

        var response = await _client.SendAsync(req);
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TKT-CT-004: Create ticket type – ORGANIZER can create (200)
    // ─────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task TKT_CT_004_CreateTicketType_AsOrganizer_Returns200()
    {
        var eventId = Guid.NewGuid();
        var req = WithOrganizer(new HttpRequestMessage(HttpMethod.Post, $"/api/v1/events/{eventId}/ticket-types")
        {
            Content = JsonContent.Create(new
            {
                TicketName = "Standard",
                TierCode = "STD",
                Price = 75,
                TotalQuantity = 200,
                MaxPerOrder = 4
            })
        });

        var response = await _client.SendAsync(req);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        Assert.Equal("Standard", doc.RootElement.GetProperty("ticketName").GetString());
        Assert.Equal(200, doc.RootElement.GetProperty("totalQuantity").GetInt32());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TKT-CT-005: Create ticket type – zero capacity is rejected (400 / TKT-3006)
    // ─────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task TKT_CT_005_CreateTicketType_ZeroQuantity_Returns400()
    {
        var eventId = Guid.NewGuid();
        var req = WithOrganizer(new HttpRequestMessage(HttpMethod.Post, $"/api/v1/events/{eventId}/ticket-types")
        {
            Content = JsonContent.Create(new
            {
                TicketName = "Empty Tier",
                TierCode = "NONE",
                Price = 50,
                TotalQuantity = 0,
                MaxPerOrder = 1
            })
        });

        var response = await _client.SendAsync(req);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TKT-CT-006: Update ticket type – ORGANIZER can update (200)
    // ─────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task TKT_CT_006_UpdateTicketType_AsOrganizer_Returns200()
    {
        var eventId = Guid.NewGuid();

        // Create it first
        var createReq = WithOrganizer(new HttpRequestMessage(HttpMethod.Post, $"/api/v1/events/{eventId}/ticket-types")
        {
            Content = JsonContent.Create(new { TicketName = "Old Name", TierCode = "OLD", Price = 100, TotalQuantity = 30, MaxPerOrder = 2 })
        });
        var createResp = await _client.SendAsync(createReq);
        var createBody = await createResp.Content.ReadAsStringAsync();
        using var createDoc = JsonDocument.Parse(createBody);
        var ticketTypeId = createDoc.RootElement.GetProperty("ticketTypeId").GetGuid();

        // Update it
        var updateReq = WithOrganizer(new HttpRequestMessage(HttpMethod.Put, $"/api/v1/events/{eventId}/ticket-types/{ticketTypeId}")
        {
            Content = JsonContent.Create(new { TicketName = "Updated Name", TierCode = "UPD", Price = 120, TotalQuantity = 30, MaxPerOrder = 2 })
        });
        var updateResp = await _client.SendAsync(updateReq);

        Assert.Equal(HttpStatusCode.OK, updateResp.StatusCode);
        var updateBody = await updateResp.Content.ReadAsStringAsync();
        using var updateDoc = JsonDocument.Parse(updateBody);
        Assert.Equal("Updated Name", updateDoc.RootElement.GetProperty("ticketName").GetString());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TKT-CT-007: Delete ticket type – ORGANIZER can delete an unused tier (204)
    // ─────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task TKT_CT_007_DeleteTicketType_Unused_Returns204()
    {
        var eventId = Guid.NewGuid();

        var createReq = WithOrganizer(new HttpRequestMessage(HttpMethod.Post, $"/api/v1/events/{eventId}/ticket-types")
        {
            Content = JsonContent.Create(new { TicketName = "Delete Me", TierCode = "DEL", Price = 50, TotalQuantity = 20, MaxPerOrder = 1 })
        });
        var createResp = await _client.SendAsync(createReq);
        var createBody = await createResp.Content.ReadAsStringAsync();
        using var createDoc = JsonDocument.Parse(createBody);
        var ticketTypeId = createDoc.RootElement.GetProperty("ticketTypeId").GetGuid();

        var deleteReq = WithOrganizer(new HttpRequestMessage(HttpMethod.Delete, $"/api/v1/events/{eventId}/ticket-types/{ticketTypeId}"));
        var deleteResp = await _client.SendAsync(deleteReq);

        Assert.Equal(HttpStatusCode.NoContent, deleteResp.StatusCode);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TKT-CT-008: Register – unauthenticated request is rejected (401)
    // ─────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task TKT_CT_008_Register_NoAuth_Returns401()
    {
        var req = new HttpRequestMessage(HttpMethod.Post, "/api/v1/registrations")
        {
            Content = JsonContent.Create(new
            {
                EventId = Guid.NewGuid(),
                TicketTypeId = Guid.NewGuid(),
                FirstName = "Jane",
                LastName = "Doe",
                Email = "jane@test.com"
            })
        };

        var response = await _client.SendAsync(req);
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TKT-CT-009: Register – authenticated attendee creates a PENDING registration
    // ─────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task TKT_CT_009_Register_AsAttendee_ReturnsPendingRegistration()
    {
        var eventId = Guid.NewGuid();
        var attendeeId = Guid.NewGuid();

        // Seed a paid ticket type
        var ticketType = await _factory.Repository.SaveTicketTypeAsync(new TicketTypeDocument
        {
            EventId = eventId,
            TicketName = "CT-009 Paid Tier",
            TierCode = "CT009",
            Price = 150,
            TotalQuantity = 20,
            AvailableQuantity = 20,
            IsActive = true
        }, CancellationToken.None);

        var req = WithAttendee(
            new HttpRequestMessage(HttpMethod.Post, "/api/v1/registrations")
            {
                Content = JsonContent.Create(new
                {
                    EventId = eventId,
                    TicketTypeId = ticketType.Id,
                    FirstName = "CT009",
                    LastName = "Attendee",
                    Email = "ct009@test.com"
                })
            },
            attendeeId, "ct009@test.com");

        var response = await _client.SendAsync(req);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        Assert.Equal("PENDING", doc.RootElement.GetProperty("status").GetString());
        Assert.Equal(eventId.ToString(), doc.RootElement.GetProperty("eventId").GetGuid().ToString());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TKT-CT-010: Register – free tier creates a CONFIRMED registration
    // ─────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task TKT_CT_010_Register_FreeTier_ReturnsConfirmedRegistration()
    {
        var eventId = Guid.NewGuid();
        var attendeeId = Guid.NewGuid();

        var ticketType = await _factory.Repository.SaveTicketTypeAsync(new TicketTypeDocument
        {
            EventId = eventId,
            TicketName = "CT-010 Free Tier",
            TierCode = "CT010",
            Price = 0,
            TotalQuantity = 50,
            AvailableQuantity = 50,
            IsActive = true
        }, CancellationToken.None);

        var req = WithAttendee(
            new HttpRequestMessage(HttpMethod.Post, "/api/v1/registrations")
            {
                Content = JsonContent.Create(new
                {
                    EventId = eventId,
                    TicketTypeId = ticketType.Id,
                    FirstName = "CT010",
                    LastName = "Free",
                    Email = "ct010@test.com"
                })
            },
            attendeeId, "ct010@test.com");

        var response = await _client.SendAsync(req);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        Assert.Equal("CONFIRMED", doc.RootElement.GetProperty("status").GetString());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TKT-CT-011: My registrations – returns the caller's registrations
    // ─────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task TKT_CT_011_MyRegistrations_AsAttendee_ReturnsList()
    {
        var eventId = Guid.NewGuid();
        var attendeeId = Guid.NewGuid();
        const string email = "ct011@test.com";

        var ticketType = await _factory.Repository.SaveTicketTypeAsync(new TicketTypeDocument
        {
            EventId = eventId, TicketName = "CT-011 Tier", TierCode = "CT011",
            Price = 0, TotalQuantity = 20, AvailableQuantity = 20, IsActive = true
        }, CancellationToken.None);

        // Register first
        var regReq = WithAttendee(
            new HttpRequestMessage(HttpMethod.Post, "/api/v1/registrations")
            {
                Content = JsonContent.Create(new { EventId = eventId, TicketTypeId = ticketType.Id, FirstName = "CT011", LastName = "User", Email = email })
            },
            attendeeId, email);
        await _client.SendAsync(regReq);

        // Now list
        var listReq = WithAttendee(new HttpRequestMessage(HttpMethod.Get, "/api/v1/registrations/me"), attendeeId, email);
        var listResp = await _client.SendAsync(listReq);

        Assert.Equal(HttpStatusCode.OK, listResp.StatusCode);
        var body = await listResp.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        Assert.Equal(JsonValueKind.Array, doc.RootElement.ValueKind);
        Assert.True(doc.RootElement.GetArrayLength() >= 1);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TKT-CT-012: My tickets – returns the caller's tickets
    // ─────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task TKT_CT_012_MyTickets_AsAttendee_ReturnsList()
    {
        var eventId = Guid.NewGuid();
        var attendeeId = Guid.NewGuid();
        const string email = "ct012@test.com";

        var ticketType = await _factory.Repository.SaveTicketTypeAsync(new TicketTypeDocument
        {
            EventId = eventId, TicketName = "CT-012 Tier", TierCode = "CT012",
            Price = 0, TotalQuantity = 20, AvailableQuantity = 20, IsActive = true
        }, CancellationToken.None);

        // Register to create a ticket
        var regReq = WithAttendee(
            new HttpRequestMessage(HttpMethod.Post, "/api/v1/registrations")
            {
                Content = JsonContent.Create(new { EventId = eventId, TicketTypeId = ticketType.Id, FirstName = "CT012", LastName = "User", Email = email })
            },
            attendeeId, email);
        await _client.SendAsync(regReq);

        // List tickets
        var req = WithAttendee(new HttpRequestMessage(HttpMethod.Get, "/api/v1/tickets/me"), attendeeId, email);
        var response = await _client.SendAsync(req);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        Assert.Equal(JsonValueKind.Array, doc.RootElement.ValueKind);
        Assert.True(doc.RootElement.GetArrayLength() >= 1);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TKT-CT-013: Event registrations – ADMIN can view all registrations (200)
    // ─────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task TKT_CT_013_EventRegistrations_AsAdmin_Returns200()
    {
        var eventId = Guid.NewGuid();

        var req = WithAdmin(new HttpRequestMessage(HttpMethod.Get, $"/api/v1/events/{eventId}/registrations"));
        var response = await _client.SendAsync(req);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        Assert.Equal(JsonValueKind.Array, doc.RootElement.ValueKind);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TKT-CT-014: Event registrations – internal service key bypasses auth (200)
    // ─────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task TKT_CT_014_EventRegistrations_WithInternalKey_Returns200()
    {
        var eventId = Guid.NewGuid();

        var req = new HttpRequestMessage(HttpMethod.Get, $"/api/v1/events/{eventId}/registrations");
        req.Headers.Add("x-internal-service-key", "test-internal-key");

        var response = await _client.SendAsync(req);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TKT-CT-015: Event registrations – unauthenticated request is rejected (401)
    // ─────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task TKT_CT_015_EventRegistrations_NoAuth_Returns401()
    {
        var eventId = Guid.NewGuid();
        var response = await _client.GetAsync($"/api/v1/events/{eventId}/registrations");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TKT-CT-016: Event registrations – ATTENDEE (insufficient role) → 403
    // ─────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task TKT_CT_016_EventRegistrations_AsAttendee_Returns403()
    {
        var eventId = Guid.NewGuid();
        var attendeeId = Guid.NewGuid();

        var req = WithAttendee(
            new HttpRequestMessage(HttpMethod.Get, $"/api/v1/events/{eventId}/registrations"),
            attendeeId);
        var response = await _client.SendAsync(req);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TKT-CT-017: Confirm payment – valid internal key transitions to CONFIRMED
    // ─────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task TKT_CT_017_ConfirmPayment_ValidKey_ReturnsConfirmed()
    {
        var eventId = Guid.NewGuid();
        var attendeeId = Guid.NewGuid();
        const string email = "ct017@test.com";

        // Seed a paid ticket type
        var ticketType = await _factory.Repository.SaveTicketTypeAsync(new TicketTypeDocument
        {
            EventId = eventId, TicketName = "CT-017 Paid", TierCode = "CT017",
            Price = 200, TotalQuantity = 10, AvailableQuantity = 10, IsActive = true
        }, CancellationToken.None);

        // Register to get PENDING
        var regReq = WithAttendee(
            new HttpRequestMessage(HttpMethod.Post, "/api/v1/registrations")
            {
                Content = JsonContent.Create(new { EventId = eventId, TicketTypeId = ticketType.Id, FirstName = "CT017", LastName = "User", Email = email })
            },
            attendeeId, email);
        var regResp = await _client.SendAsync(regReq);
        Assert.Equal(HttpStatusCode.OK, regResp.StatusCode);

        var regBody = await regResp.Content.ReadAsStringAsync();
        using var regDoc = JsonDocument.Parse(regBody);
        var registrationId = regDoc.RootElement.GetProperty("registrationId").GetGuid();

        Assert.Equal("PENDING", regDoc.RootElement.GetProperty("status").GetString());

        // Confirm payment with valid internal key
        var confirmReq = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/internal/registrations/{registrationId}/confirm-payment");
        confirmReq.Headers.Add("x-internal-service-key", "test-internal-key");

        var confirmResp = await _client.SendAsync(confirmReq);
        Assert.Equal(HttpStatusCode.OK, confirmResp.StatusCode);

        var confirmBody = await confirmResp.Content.ReadAsStringAsync();
        using var confirmDoc = JsonDocument.Parse(confirmBody);
        Assert.Equal("CONFIRMED", confirmDoc.RootElement.GetProperty("status").GetString());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TKT-CT-018: Confirm payment – wrong internal key is rejected (403)
    // ─────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task TKT_CT_018_ConfirmPayment_WrongKey_Returns403()
    {
        var registrationId = Guid.NewGuid();

        var req = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/internal/registrations/{registrationId}/confirm-payment");
        req.Headers.Add("x-internal-service-key", "wrong-key-entirely");

        var response = await _client.SendAsync(req);
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TKT-CT-019: Join waitlist – authenticated attendee joins sold-out event (200)
    // ─────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task TKT_CT_019_JoinWaitlist_SoldOutEvent_Returns200()
    {
        var eventId = Guid.NewGuid();
        var attendeeId = Guid.NewGuid();
        const string email = "ct019@test.com";

        // Seed a sold-out ticket type
        var ticketType = await _factory.Repository.SaveTicketTypeAsync(new TicketTypeDocument
        {
            EventId = eventId, TicketName = "CT-019 Sold Out", TierCode = "CT019",
            Price = 100, TotalQuantity = 1, AvailableQuantity = 0, IsActive = true
        }, CancellationToken.None);

        var req = WithAttendee(
            new HttpRequestMessage(HttpMethod.Post, $"/api/v1/events/{eventId}/waitlist")
            {
                Content = JsonContent.Create(new
                {
                    TicketTypeId = ticketType.Id,
                    FirstName = "CT019",
                    LastName = "Waitlist",
                    Email = email
                })
            },
            attendeeId, email);

        var response = await _client.SendAsync(req);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        Assert.Equal("ACTIVE", doc.RootElement.GetProperty("status").GetString());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TKT-CT-020: Cancel registration – owner can cancel their own registration (204)
    // ─────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task TKT_CT_020_CancelRegistration_AsOwner_Returns204()
    {
        var eventId = Guid.NewGuid();
        var attendeeId = Guid.NewGuid();
        const string email = "ct020@test.com";

        var ticketType = await _factory.Repository.SaveTicketTypeAsync(new TicketTypeDocument
        {
            EventId = eventId, TicketName = "CT-020 Tier", TierCode = "CT020",
            Price = 0, TotalQuantity = 10, AvailableQuantity = 10, IsActive = true
        }, CancellationToken.None);

        // Register
        var regReq = WithAttendee(
            new HttpRequestMessage(HttpMethod.Post, "/api/v1/registrations")
            {
                Content = JsonContent.Create(new { EventId = eventId, TicketTypeId = ticketType.Id, FirstName = "CT020", LastName = "User", Email = email })
            },
            attendeeId, email);
        var regResp = await _client.SendAsync(regReq);
        var regBody = await regResp.Content.ReadAsStringAsync();
        using var regDoc = JsonDocument.Parse(regBody);
        var registrationId = regDoc.RootElement.GetProperty("registrationId").GetGuid();

        // Cancel as owner
        var cancelReq = WithAttendee(
            new HttpRequestMessage(HttpMethod.Delete, $"/api/v1/registrations/{registrationId}"),
            attendeeId, email);
        var cancelResp = await _client.SendAsync(cancelReq);

        Assert.Equal(HttpStatusCode.NoContent, cancelResp.StatusCode);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TKT-CT-021: Cancel registration – different user is rejected (403)
    // ─────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task TKT_CT_021_CancelRegistration_DifferentUser_Returns403()
    {
        var eventId = Guid.NewGuid();
        var ownerId = Guid.NewGuid();
        var impersonatorId = Guid.NewGuid();
        const string ownerEmail = "ct021owner@test.com";

        var ticketType = await _factory.Repository.SaveTicketTypeAsync(new TicketTypeDocument
        {
            EventId = eventId, TicketName = "CT-021 Tier", TierCode = "CT021",
            Price = 0, TotalQuantity = 10, AvailableQuantity = 10, IsActive = true
        }, CancellationToken.None);

        // Register as owner
        var regReq = WithAttendee(
            new HttpRequestMessage(HttpMethod.Post, "/api/v1/registrations")
            {
                Content = JsonContent.Create(new { EventId = eventId, TicketTypeId = ticketType.Id, FirstName = "Owner", LastName = "User", Email = ownerEmail })
            },
            ownerId, ownerEmail);
        var regResp = await _client.SendAsync(regReq);
        var regBody = await regResp.Content.ReadAsStringAsync();
        using var regDoc = JsonDocument.Parse(regBody);
        var registrationId = regDoc.RootElement.GetProperty("registrationId").GetGuid();

        // Try to cancel as impersonator
        var cancelReq = WithAttendee(
            new HttpRequestMessage(HttpMethod.Delete, $"/api/v1/registrations/{registrationId}"),
            impersonatorId, "ct021impersonator@test.com");
        var cancelResp = await _client.SendAsync(cancelReq);

        Assert.Equal(HttpStatusCode.Forbidden, cancelResp.StatusCode);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TKT-CT-022: Check-in scan – STAFF can scan a confirmed ticket (200)
    // Full scenario: register → confirm → scan
    // ─────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task TKT_CT_022_CheckInScan_AsStaff_ReturnsCheckedIn()
    {
        var eventId = Guid.NewGuid();
        var attendeeId = Guid.NewGuid();
        const string email = "ct022@test.com";

        // Free ticket → auto-confirmed
        var ticketType = await _factory.Repository.SaveTicketTypeAsync(new TicketTypeDocument
        {
            EventId = eventId, TicketName = "CT-022 Free", TierCode = "CT022",
            Price = 0, TotalQuantity = 5, AvailableQuantity = 5, IsActive = true
        }, CancellationToken.None);

        // Register
        var regReq = WithAttendee(
            new HttpRequestMessage(HttpMethod.Post, "/api/v1/registrations")
            {
                Content = JsonContent.Create(new { EventId = eventId, TicketTypeId = ticketType.Id, FirstName = "CT022", LastName = "ScanUser", Email = email })
            },
            attendeeId, email);
        var regResp = await _client.SendAsync(regReq);
        Assert.Equal(HttpStatusCode.OK, regResp.StatusCode);

        var regBody = await regResp.Content.ReadAsStringAsync();
        using var regDoc = JsonDocument.Parse(regBody);
        Assert.Equal("CONFIRMED", regDoc.RootElement.GetProperty("status").GetString());
        var qrPayload = regDoc.RootElement.GetProperty("ticket").GetProperty("qrPayload").GetString()!;

        // Scan the confirmed ticket
        var scanReq = WithStaff(new HttpRequestMessage(HttpMethod.Post, "/api/v1/checkin/scan")
        {
            Content = JsonContent.Create(new { QrPayload = qrPayload, Gate = "MAIN" })
        });
        var scanResp = await _client.SendAsync(scanReq);

        Assert.Equal(HttpStatusCode.OK, scanResp.StatusCode);
        var scanBody = await scanResp.Content.ReadAsStringAsync();
        using var scanDoc = JsonDocument.Parse(scanBody);
        Assert.Equal("CHECKED_IN", scanDoc.RootElement.GetProperty("status").GetString());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TKT-CT-023: Check-in scan – unauthenticated request is rejected (401)
    // ─────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task TKT_CT_023_CheckInScan_NoAuth_Returns401()
    {
        var req = new HttpRequestMessage(HttpMethod.Post, "/api/v1/checkin/scan")
        {
            Content = JsonContent.Create(new { QrPayload = "fake-payload", Gate = "MAIN" })
        };

        var response = await _client.SendAsync(req);
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TKT-CT-024: Check-in stats – ORGANIZER can view event stats (200)
    // Full scenario: register + scan → check stats
    // ─────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task TKT_CT_024_CheckInStats_AsOrganizer_ReturnsStats()
    {
        var eventId = Guid.NewGuid();
        var attendeeId = Guid.NewGuid();
        const string email = "ct024@test.com";

        var ticketType = await _factory.Repository.SaveTicketTypeAsync(new TicketTypeDocument
        {
            EventId = eventId, TicketName = "CT-024 Free", TierCode = "CT024",
            Price = 0, TotalQuantity = 5, AvailableQuantity = 5, IsActive = true
        }, CancellationToken.None);

        // Register and scan one attendee
        var regReq = WithAttendee(
            new HttpRequestMessage(HttpMethod.Post, "/api/v1/registrations")
            {
                Content = JsonContent.Create(new { EventId = eventId, TicketTypeId = ticketType.Id, FirstName = "Stats", LastName = "User", Email = email })
            },
            attendeeId, email);
        var regResp = await _client.SendAsync(regReq);
        var regBody = await regResp.Content.ReadAsStringAsync();
        using var regDoc = JsonDocument.Parse(regBody);
        var qrPayload = regDoc.RootElement.GetProperty("ticket").GetProperty("qrPayload").GetString()!;

        var scanReq = WithStaff(new HttpRequestMessage(HttpMethod.Post, "/api/v1/checkin/scan")
        {
            Content = JsonContent.Create(new { QrPayload = qrPayload, Gate = "ENTRY" })
        });
        await _client.SendAsync(scanReq);

        // Get stats
        var statsReq = WithOrganizer(new HttpRequestMessage(HttpMethod.Get, $"/api/v1/events/{eventId}/checkin/stats"));
        var statsResp = await _client.SendAsync(statsReq);

        Assert.Equal(HttpStatusCode.OK, statsResp.StatusCode);
        var statsBody = await statsResp.Content.ReadAsStringAsync();
        using var statsDoc = JsonDocument.Parse(statsBody);
        Assert.Equal(1, statsDoc.RootElement.GetProperty("totalRegistrations").GetInt32());
        Assert.Equal(1, statsDoc.RootElement.GetProperty("checkedInCount").GetInt32());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TKT-CT-025: Seat map – public endpoint returns a valid seat map (200)
    // ─────────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task TKT_CT_025_SeatMap_PublicEndpoint_Returns200()
    {
        var eventId = Guid.NewGuid();

        var ticketType = await _factory.Repository.SaveTicketTypeAsync(new TicketTypeDocument
        {
            EventId = eventId, TicketName = "CT-025 Hall", TierCode = "CT025-HALL",
            Price = 80, TotalQuantity = 50, AvailableQuantity = 50, IsActive = true
        }, CancellationToken.None);

        var response = await _client.GetAsync($"/api/v1/ticket-types/{ticketType.Id}/seat-map?eventId={eventId}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        Assert.True(doc.RootElement.TryGetProperty("capacity", out _));
        Assert.True(doc.RootElement.TryGetProperty("rows", out _));
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Integration test in-memory repository
// (Duplicated from TicketingServiceTests intentionally to keep test classes self-contained)
// ─────────────────────────────────────────────────────────────────────────────

public sealed class TicketingIntegrationRepository : ITicketingRepository
{
    private readonly Dictionary<Guid, AttendeeDocument> _attendees = [];
    private readonly Dictionary<Guid, TicketTypeDocument> _ticketTypes = [];
    private readonly Dictionary<Guid, RegistrationDocument> _registrations = [];
    private readonly Dictionary<Guid, TicketDocument> _tickets = [];
    private readonly Dictionary<Guid, CheckInLogDocument> _checkIns = [];
    private readonly Dictionary<Guid, WaitlistEntryDocument> _waitlist = [];
    private readonly Dictionary<Guid, SeatReservationDocument> _seatReservations = [];
    private readonly Dictionary<Guid, SeatBookingDocument> _seatBookings = [];

    public Task<AttendeeDocument?> FindAttendeeByUserIdAsync(Guid userId, CancellationToken ct) =>
        Task.FromResult(_attendees.Values.FirstOrDefault(a => a.UserId == userId));

    public Task<AttendeeDocument?> FindAttendeeByEmailAsync(string email, CancellationToken ct) =>
        Task.FromResult(_attendees.Values.FirstOrDefault(a => a.Email == email));

    public Task<AttendeeDocument> UpsertAttendeeAsync(AttendeeDocument attendee, CancellationToken ct)
    {
        _attendees[attendee.Id] = attendee;
        return Task.FromResult(attendee);
    }

    public Task<TicketTypeDocument> SaveTicketTypeAsync(TicketTypeDocument ticketType, CancellationToken ct)
    {
        _ticketTypes[ticketType.Id] = ticketType;
        return Task.FromResult(ticketType);
    }

    public Task<IReadOnlyList<TicketTypeDocument>> ListTicketTypesAsync(Guid eventId, CancellationToken ct) =>
        Task.FromResult<IReadOnlyList<TicketTypeDocument>>(
            _ticketTypes.Values.Where(t => t.EventId == eventId).ToList());

    public Task<TicketTypeDocument?> GetTicketTypeAsync(Guid ticketTypeId, CancellationToken ct) =>
        Task.FromResult(_ticketTypes.GetValueOrDefault(ticketTypeId));

    public Task<RegistrationDocument?> FindRegistrationAsync(Guid eventId, Guid? attendeeUserId, string attendeeEmail, CancellationToken ct) =>
        Task.FromResult(_registrations.Values.FirstOrDefault(r =>
            r.EventId == eventId &&
            ((attendeeUserId.HasValue && r.AttendeeUserId == attendeeUserId) || r.AttendeeEmail == attendeeEmail)));

    public Task<RegistrationDocument?> FindRegistrationByIdAsync(Guid registrationId, CancellationToken ct) =>
        Task.FromResult(_registrations.GetValueOrDefault(registrationId));

    public Task<RegistrationDocument> SaveRegistrationAsync(RegistrationDocument registration, CancellationToken ct)
    {
        _registrations[registration.Id] = registration;
        return Task.FromResult(registration);
    }

    public Task<IReadOnlyList<RegistrationDocument>> ListRegistrationsForEventAsync(Guid eventId, CancellationToken ct) =>
        Task.FromResult<IReadOnlyList<RegistrationDocument>>(
            _registrations.Values.Where(r => r.EventId == eventId).OrderByDescending(r => r.CreatedAt).ToList());

    public Task<IReadOnlyList<RegistrationDocument>> ListRegistrationsForUserAsync(Guid userId, string email, CancellationToken ct) =>
        Task.FromResult<IReadOnlyList<RegistrationDocument>>(
            _registrations.Values.Where(r => r.AttendeeUserId == userId || r.AttendeeEmail == email).OrderByDescending(r => r.CreatedAt).ToList());

    public Task<TicketDocument> SaveTicketAsync(TicketDocument ticket, CancellationToken ct)
    {
        _tickets[ticket.Id] = ticket;
        return Task.FromResult(ticket);
    }

    public Task<TicketDocument?> FindTicketByIdAsync(Guid ticketId, CancellationToken ct) =>
        Task.FromResult(_tickets.GetValueOrDefault(ticketId));

    public Task<TicketDocument?> FindTicketByPayloadAsync(string payload, CancellationToken ct) =>
        Task.FromResult(_tickets.Values.FirstOrDefault(t => t.QrPayload == payload));

    public Task<IReadOnlyList<TicketDocument>> ListTicketsForUserAsync(Guid userId, string email, CancellationToken ct)
    {
        var ids = _registrations.Values
            .Where(r => r.AttendeeUserId == userId || r.AttendeeEmail == email)
            .Select(r => r.TicketId)
            .ToHashSet();
        return Task.FromResult<IReadOnlyList<TicketDocument>>(
            _tickets.Values.Where(t => ids.Contains(t.Id)).OrderByDescending(t => t.CreatedAt).ToList());
    }

    public Task<CheckInLogDocument> SaveCheckInAsync(CheckInLogDocument checkIn, CancellationToken ct)
    {
        _checkIns[checkIn.Id] = checkIn;
        return Task.FromResult(checkIn);
    }

    public Task<bool> HasCheckInAsync(Guid registrationId, CancellationToken ct) =>
        Task.FromResult(_checkIns.Values.Any(c => c.RegistrationId == registrationId));

    public Task<IReadOnlyList<CheckInLogDocument>> ListCheckInsForEventAsync(Guid eventId, CancellationToken ct) =>
        Task.FromResult<IReadOnlyList<CheckInLogDocument>>(
            _checkIns.Values.Where(c => c.EventId == eventId).OrderByDescending(c => c.CheckInTime).ToList());

    public Task<WaitlistEntryDocument> SaveWaitlistEntryAsync(WaitlistEntryDocument entry, CancellationToken ct)
    {
        _waitlist[entry.Id] = entry;
        return Task.FromResult(entry);
    }

    public Task<WaitlistEntryDocument?> FindActiveWaitlistEntryAsync(Guid eventId, Guid? attendeeUserId, string attendeeEmail, CancellationToken ct) =>
        Task.FromResult(_waitlist.Values.FirstOrDefault(w =>
            w.EventId == eventId && w.Status == WaitlistStatus.Active &&
            ((attendeeUserId.HasValue && w.AttendeeUserId == attendeeUserId) || w.AttendeeEmail == attendeeEmail)));

    public Task<WaitlistEntryDocument?> GetNextWaitlistEntryAsync(Guid eventId, Guid ticketTypeId, CancellationToken ct) =>
        Task.FromResult(_waitlist.Values
            .Where(w => w.EventId == eventId && w.TicketTypeId == ticketTypeId && w.Status == WaitlistStatus.Active)
            .OrderBy(w => w.CreatedAt)
            .FirstOrDefault());

    public Task<SeatReservationDocument?> FindActiveSeatReservationAsync(Guid eventId, Guid ticketTypeId, string seatRow, int seatColumn, CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        return Task.FromResult(_seatReservations.Values.FirstOrDefault(r =>
            r.EventId == eventId && r.TicketTypeId == ticketTypeId &&
            r.SeatRow == seatRow && r.SeatColumn == seatColumn && r.ExpiresAt > now));
    }

    public Task<SeatReservationDocument?> FindActiveUserReservationAsync(Guid eventId, Guid ticketTypeId, Guid userId, CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        return Task.FromResult(_seatReservations.Values.FirstOrDefault(r =>
            r.EventId == eventId && r.TicketTypeId == ticketTypeId &&
            r.UserId == userId && r.ExpiresAt > now));
    }

    public Task<SeatReservationDocument?> GetSeatReservationByIdAsync(Guid reservationId, CancellationToken ct) =>
        Task.FromResult(_seatReservations.GetValueOrDefault(reservationId));

    public Task<IReadOnlyList<SeatReservationDocument>> ListActiveSeatReservationsAsync(Guid eventId, Guid ticketTypeId, CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        return Task.FromResult<IReadOnlyList<SeatReservationDocument>>(
            _seatReservations.Values.Where(r => r.EventId == eventId && r.TicketTypeId == ticketTypeId && r.ExpiresAt > now).ToList());
    }

    public Task<SeatReservationDocument> SaveSeatReservationAsync(SeatReservationDocument reservation, CancellationToken ct)
    {
        _seatReservations[reservation.Id] = reservation;
        return Task.FromResult(reservation);
    }

    public Task DeleteSeatReservationAsync(Guid reservationId, CancellationToken ct)
    {
        _seatReservations.Remove(reservationId);
        return Task.CompletedTask;
    }

    public Task<SeatBookingDocument?> FindSeatBookingAsync(Guid eventId, Guid ticketTypeId, string seatRow, int seatColumn, CancellationToken ct) =>
        Task.FromResult(_seatBookings.Values.FirstOrDefault(b =>
            b.EventId == eventId && b.TicketTypeId == ticketTypeId &&
            b.SeatRow == seatRow && b.SeatColumn == seatColumn));

    public Task<SeatBookingDocument?> FindSeatBookingByRegistrationIdAsync(Guid registrationId, CancellationToken ct) =>
        Task.FromResult(_seatBookings.Values.FirstOrDefault(b => b.RegistrationId == registrationId));

    public Task<IReadOnlyList<SeatBookingDocument>> ListSeatBookingsAsync(Guid eventId, Guid ticketTypeId, CancellationToken ct) =>
        Task.FromResult<IReadOnlyList<SeatBookingDocument>>(
            _seatBookings.Values.Where(b => b.EventId == eventId && b.TicketTypeId == ticketTypeId).ToList());

    public Task<SeatBookingDocument> SaveSeatBookingAsync(SeatBookingDocument booking, CancellationToken ct)
    {
        _seatBookings[booking.Id] = booking;
        return Task.FromResult(booking);
    }

    public Task DeleteSeatBookingAsync(Guid bookingId, CancellationToken ct)
    {
        _seatBookings.Remove(bookingId);
        return Task.CompletedTask;
    }
}
