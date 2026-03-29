package com.eventzen.finance.repository;

import com.eventzen.finance.model.Payment;
import com.eventzen.finance.model.PaymentStatus;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PaymentRepository extends JpaRepository<Payment, UUID> {
    Optional<Payment> findByGatewayReference(String gatewayReference);
    Optional<Payment> findByGatewayOrderId(String gatewayOrderId);
    List<Payment> findByCreatedByUserIdOrderByCreatedAtDesc(UUID createdByUserId);
    List<Payment> findTop10ByEventIdOrderByCreatedAtDesc(UUID eventId);
    long countByEventIdAndPaymentStatus(UUID eventId, PaymentStatus paymentStatus);

    @Query("select coalesce(sum(p.amount), 0) from Payment p where p.eventId = :eventId and p.paymentStatus = :status")
    BigDecimal totalByEventIdAndStatus(@Param("eventId") UUID eventId, @Param("status") PaymentStatus status);

    @Query("""
            select coalesce(sum(p.amount), 0)
            from Payment p
            where p.eventId = :eventId
              and p.paymentStatus = :status
              and p.registrationId is not null
            """)
    BigDecimal totalTicketRevenueByEventIdAndStatus(@Param("eventId") UUID eventId, @Param("status") PaymentStatus status);

    @Query("""
            select coalesce(sum(p.amount), 0)
            from Payment p
            where p.eventId = :eventId
              and p.paymentStatus = :status
              and p.venueBookingId is not null
            """)
    BigDecimal totalVenueRevenueByEventIdAndStatus(@Param("eventId") UUID eventId, @Param("status") PaymentStatus status);
}
