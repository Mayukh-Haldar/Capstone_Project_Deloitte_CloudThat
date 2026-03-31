[← Features Overview](./README.md) · [← Novelty & Advanced Features](../../README.md#-novelty--advanced-features)

---

# 💰 Financial Reports & Budget Tracking

## Overview

EventZen's **Finance Service** (Spring Boot + MySQL) provides a complete financial management layer for events. Organizers can create a budget for their event, track individual expense line items, monitor revenue from ticket and venue bookings, and view a consolidated **Financial Report** - all from a single service. Budget approval by admins adds a governance layer before funds are committed.

---

## Feature Map

```
Finance Service
├── Budget Management
│   ├── Create budget for an event
│   ├── Add line items (caterers, AV, security, etc.)
│   └── Admin approval workflow
│
├── Expense Tracking
│   └── Record actual expenses against budget categories
│
├── Payment Aggregation
│   ├── Pull revenue from ticket bookings
│   └── Pull revenue from venue bookings
│
└── Financial Report
    ├── Total revenue (tickets + venues)
    ├── Total expenses
    ├── Net profit / loss
    ├── Budget vs actuals
    ├── Budget alerts (overspend warnings)
    └── Recent 10 transactions
```

---

## Budget Lifecycle

```
Organizer creates budget (DRAFT)
         │
         ▼
Organizer adds budget line items
         │
         ▼
Organizer submits for approval  →  PENDING_APPROVAL
         │
         ▼
Admin approves  →  APPROVED
         │
         ▼
Expenses are logged against the approved budget
```

---

## Key Source Files

| File | Purpose |
|---|---|
| `BudgetController.java` | REST endpoints - create, get, approve, add items |
| `BudgetService.java` | Business logic - budget creation, item management, approval workflow |
| `ExpenseController.java` | REST endpoints - log and list expenses per event |
| `ReportController.java` | REST endpoint - generate full financial report for an event |
| `FinancialReportService.java` | Aggregates budget, payments, expenses into `FinancialReportResponse` |

---

## Financial Report Response

```java
FinancialReportResponse {
  eventId,
  eventName,
  budget,               // Full budget with line items & status
  totalRevenue,         // Ticket + venue payments (SUCCEEDED only)
  ticketBookingRevenue,
  venueBookingRevenue,
  totalExpenses,
  netProfit,            // totalRevenue - totalExpenses
  totalPaymentCount,
  totalExpenseCount,
  transactions,         // Top 10 recent (payments + expenses combined)
  alerts,               // Budget overspend alerts + failed payment warnings
  generatedAt
}
```

---

## API Endpoints

```
POST   /api/v1/events/{eventId}/budget           Create budget
GET    /api/v1/events/{eventId}/budget           Get budget
PUT    /api/v1/budgets/{budgetId}/approve        Admin approve
POST   /api/v1/budgets/{budgetId}/items          Add budget line item

POST   /api/v1/events/{eventId}/expenses         Log expense
GET    /api/v1/events/{eventId}/expenses         List expenses

GET    /api/v1/events/{eventId}/financial-report Full financial report
```

---

## Budget Alerts

`FinancialReportService` automatically generates alerts and includes them in the report:

| Alert Type | Trigger Condition |
|---|---|
| `budget.item.overspent` | An expense category exceeds its budgeted amount |
| `budget.total.overspent` | Total expenses exceed total budget |
| `payment.failed` | One or more `FAILED` payments exist for the event |

---

## Security

- Budget creation and expense logging require `ADMIN` or `ORGANIZER` role
- Budget approval is restricted to `ADMIN` only
- Organizers can only manage budgets for events they own
- Revenue figures are derived directly from the `payments` table filtered by `PaymentStatus.SUCCEEDED` - no manual entry
