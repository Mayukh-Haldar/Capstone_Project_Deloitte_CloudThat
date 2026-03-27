package com.eventzen.finance.repository;

import com.eventzen.finance.model.BudgetCategory;
import com.eventzen.finance.model.Expense;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ExpenseRepository extends JpaRepository<Expense, UUID> {
    List<Expense> findTop10ByEventIdOrderByExpenseDateDescCreatedAtDesc(UUID eventId);
    long countByEventId(UUID eventId);

    @Query("select coalesce(sum(e.amount), 0) from Expense e where e.eventId = :eventId")
    BigDecimal totalByEventId(@Param("eventId") UUID eventId);

    @Query("select coalesce(sum(e.amount), 0) from Expense e where e.eventId = :eventId and e.category = :category")
    BigDecimal totalByEventIdAndCategory(@Param("eventId") UUID eventId, @Param("category") BudgetCategory category);
}
