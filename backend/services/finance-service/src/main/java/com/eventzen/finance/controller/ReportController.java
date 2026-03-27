package com.eventzen.finance.controller;

import com.eventzen.finance.dto.FinancialReportResponse;
import com.eventzen.finance.security.AuthenticatedUser;
import com.eventzen.finance.service.FinancialReportService;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/events/{eventId}/reports")
public class ReportController {

    private final FinancialReportService financialReportService;

    public ReportController(FinancialReportService financialReportService) {
        this.financialReportService = financialReportService;
    }

    @GetMapping("/financial")
    @PreAuthorize("hasAnyRole('ADMIN','ORGANIZER')")
    FinancialReportResponse getFinancialReport(@PathVariable UUID eventId, @AuthenticationPrincipal AuthenticatedUser actor) {
        return financialReportService.getEventFinancialReport(eventId, actor);
    }
}
