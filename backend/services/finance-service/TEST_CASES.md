# Finance Service – Test Cases

## Summary

| Layer | File / Source | Count |
|---|---|---|
| Smoke | `FinanceServiceApplicationTests` | 1 |
| Integration (Spring context) | `FinanceServiceIntegrationTest` | 3 |
| Unit – BudgetService | `BudgetServiceTest` | 13 |
| Unit – ExpenseService | `ExpenseServiceTest` | 7 |
| Unit – PaymentService | `PaymentServiceTest` | 13 |
| HTTP Integration | `FinanceControllerTest` | 18 |
| **Total automated** | | **55** |
| System (Postman) | `tests/postman/` | 20 |
| **Grand total** | | **75** |

---

## Smoke Test

| ID | File | Description | Expected |
|---|---|---|---|
| FIN-SMOKE-001 | `FinanceServiceApplicationTests` | Spring context loads with `test` profile (H2) | Context starts without errors |

---

## Spring Integration Tests

| ID | File | Description | Expected |
|---|---|---|---|
| FIN-IT-001 | `FinanceServiceIntegrationTest` | Organizer creates budget with line items | 201, status = DRAFT |
| FIN-IT-002 | `FinanceServiceIntegrationTest` | Admin approves budget | 200, status = APPROVED |
| FIN-IT-003 | `FinanceServiceIntegrationTest` | Log expense + verify financial report totals | 201 expense; report shows correct revenue/expenses |

---

## Unit Tests – BudgetService

| ID | Method | Description | Expected |
|---|---|---|---|
| FIN-US-001 | `createBudget` | Estimated total is summed from line items | `estimatedTotal` = sum of all item amounts |
| FIN-US-002 | `createBudget` | Budget already exists for event | Throws `FIN-4003 CONFLICT` |
| FIN-US-003 | `createBudget` | ADMIN can create budget | Budget saved |
| FIN-US-004 | `approveBudget` | Admin approves with explicit approved total | Status = APPROVED, `approvedTotal` persisted |
| FIN-US-005 | `approveBudget` | ORGANIZER tries to approve | Throws `AUTH-403 FORBIDDEN` |
| FIN-US-006 | `approveBudget` | Budget not found | Throws `FIN-4041 NOT_FOUND` |
| FIN-US-007 | `getBudgetForEvent` | Budget not found | Throws `FIN-4041 NOT_FOUND` |
| FIN-US-008 | `getBudgetForEvent` | ORGANIZER owns the event | Returns budget |
| FIN-US-009 | `getBudgetForEvent` | ORGANIZER does not own event | Throws `AUTH-403 FORBIDDEN` |
| FIN-US-010 | `addBudgetItem` | New item added | `estimatedTotal` increases by item amount |
| FIN-US-011 | `buildAlerts` | Spend below 80% of budget | No alerts returned |
| FIN-US-012 | `buildAlerts` | Spend at 85% of budget | MEDIUM alert returned |
| FIN-US-013 | `buildAlerts` | Spend at or above 100% of budget | HIGH / CRITICAL alert returned |

---

## Unit Tests – ExpenseService

| ID | Method | Description | Expected |
|---|---|---|---|
| FIN-EX-001 | `logExpense` | Successful expense log | Expense saved; budget actuals refreshed |
| FIN-EX-002 | `logExpense` | Budget not found for event | Throws `FIN-4041 NOT_FOUND` |
| FIN-EX-003 | `logExpense` | ORGANIZER logs for event they don't own | Throws `AUTH-403 FORBIDDEN` |
| FIN-EX-004 | `logExpense` | Amount exceeds approved budget | Throws `FIN-4001 UNPROCESSABLE_ENTITY` |
| FIN-EX-005 | `logExpense` | Amount exactly at approved budget limit | Expense saved (boundary OK) |
| FIN-EX-006 | `logExpense` | ADMIN logs expense for any event | Expense saved regardless of organizer ownership |
| FIN-EX-007 | `logExpense` | No approved budget – uses estimated total as cap | Expense saved within estimated total; rejected when over |

---

## Unit Tests – PaymentService

| ID | Method | Description | Expected |
|---|---|---|---|
| FIN-PAY-001 | `verifyRazorpayPayment` | Valid Razorpay signature | Status = SUCCEEDED |
| FIN-PAY-002 | `verifyRazorpayPayment` | Mismatched signature | Throws `FIN-4002` |
| FIN-PAY-003 | `verifyRazorpayPayment` | Payment method is BANK_TRANSFER | Method reconciled to BANK_TRANSFER |
| FIN-PAY-004 | `verifyRazorpayPayment` | Payment method is UPI | Method reconciled to UPI |
| FIN-PAY-005 | `initiatePayment` | `simulateFailure=true` | Throws `FIN-4002`; FAILED payment persisted |
| FIN-PAY-006 | `initiatePayment` | BANK_TRANSFER, gateway disabled | Payment saved as PENDING |
| FIN-PAY-007 | `verifyRazorpayPayment` | Payment not found | Throws `FIN-4042 NOT_FOUND` |
| FIN-PAY-008 | `verifyRazorpayPayment` | Invalid signature (gateway enabled) | FAILED saved; Throws `FIN-4002` |
| FIN-PAY-009 | `verifyRazorpayPayment` | Local dev fallback (gateway disabled) | Bypasses signature; SUCCEEDED |
| FIN-PAY-010 | `handleWebhook` | Unknown `gatewayReference` | Throws `FIN-4042 NOT_FOUND` |
| FIN-PAY-011 | `handleWebhook` | SUCCEEDED status | `paymentDate` set; Status = SUCCEEDED |
| FIN-PAY-012 | `listPaymentsForUser` | Returns payments for calling user | List filtered to caller's userId |
| FIN-PAY-013 | `initiatePayment` | CARD, gateway disabled | Status = SUCCEEDED immediately |

---

## HTTP Integration Tests (MockMvc + H2)

Auth uses dev-header fallback (`x-user-id`, `x-user-email`, `x-user-roles`) — works because MockMvc uses `serverName=localhost`.

### Budget Endpoints

| ID | Method & Path | Auth | Description | Expected Status | Expected Body |
|---|---|---|---|---|---|
| FIN-CT-001 | `POST /api/v1/events/{id}/budget` | ORGANIZER | Create valid budget | 201 | `status=DRAFT`, items present |
| FIN-CT-002 | `POST /api/v1/events/{id}/budget` | none | No authentication | 401 | — |
| FIN-CT-003 | `POST /api/v1/events/{id}/budget` | ATTENDEE | Insufficient role | 403 | — |
| FIN-CT-004 | `POST /api/v1/events/{id}/budget` | ORGANIZER | Duplicate event budget | 409 | `code=FIN-4003` |
| FIN-CT-005 | `GET /api/v1/events/{id}/budget` | ORGANIZER | Get existing budget | 200 | Budget JSON |
| FIN-CT-006 | `PUT /api/v1/budgets/{id}/approve` | ADMIN | Approve budget | 200 | `status=APPROVED` |
| FIN-CT-007 | `PUT /api/v1/budgets/{id}/approve` | ORGANIZER | Not allowed to approve | 403 | — |
| FIN-CT-008 | `POST /api/v1/budgets/{id}/items` | ORGANIZER | Add line item | 201 | Item count incremented |

### Expense Endpoints

| ID | Method & Path | Auth | Description | Expected Status | Expected Body |
|---|---|---|---|---|---|
| FIN-CT-009 | `POST /api/v1/expenses` | ORGANIZER | Log valid expense | 201 | Expense JSON with amount |
| FIN-CT-010 | `POST /api/v1/expenses` | ORGANIZER | Amount exceeds approved budget | 422 | `code=FIN-4001` |

### Payment Endpoints

| ID | Method & Path | Auth | Description | Expected Status | Expected Body |
|---|---|---|---|---|---|
| FIN-CT-011 | `POST /api/v1/payments` | ATTENDEE | CARD payment, gateway disabled | 201 | `status=SUCCEEDED`, `gatewayReference` starts with `PAY-` |
| FIN-CT-012 | `POST /api/v1/payments` | ATTENDEE | `simulateFailure=true` | 402 | `code=FIN-4002` |
| FIN-CT-013 | `GET /api/v1/payments/me` | ATTENDEE | List my payments | 200 | Array with ≥ 1 item |
| FIN-CT-014 | `POST /api/v1/payments/webhook` | public | Valid webhook SUCCEEDED | 200 | `status=SUCCEEDED` |
| FIN-CT-015 | `POST /api/v1/payments/webhook` | public | Unknown gatewayReference | 404 | `code=FIN-4042` |

### Financial Report

| ID | Method & Path | Auth | Description | Expected Status | Expected Body |
|---|---|---|---|---|---|
| FIN-CT-016 | `GET /api/v1/events/{id}/reports/financial` | ADMIN | Full report | 200 | `totalRevenue`, `totalExpenses`, budget present |
| FIN-CT-017 | `GET /api/v1/events/{id}/reports/financial` | ORGANIZER | Report for owned event | 200 | Report JSON |
| FIN-CT-018 | `GET /api/v1/events/{id}/reports/financial` | ATTENDEE | Not authorized | 403 | — |

---

## System Tests (Postman)

Located in `tests/postman/`. Import both files into Postman, select the environment, and run the collection in order.

**Prerequisites:**
- Finance service running on `localhost:8085`
- `organizerEventId` set to a valid event UUID (pre-create in event-service, or finance-service does not validate event existence)
- Run folders in order: **Setup → Budget → Expenses → Payments → Financial Report**

| ID | Method & Path | Auth | Description | Expected |
|---|---|---|---|---|
| FIN-ST-001 | `GET /actuator/health` | public | Service health check | 200 |
| FIN-ST-002 | `POST /api/v1/events/{eventId}/budget` | ORGANIZER | Create budget; stores `budgetId` | 201, `status=DRAFT` |
| FIN-ST-003 | `POST /api/v1/events/{eventId}/budget` | none | No auth | 401 |
| FIN-ST-004 | `POST /api/v1/events/{eventId}/budget` | ATTENDEE | Wrong role | 403 |
| FIN-ST-005 | `POST /api/v1/events/{eventId}/budget` | ORGANIZER | Duplicate event budget | 409, `code=FIN-4003` |
| FIN-ST-006 | `GET /api/v1/events/{eventId}/budget` | ORGANIZER | Get budget | 200 |
| FIN-ST-007 | `PUT /api/v1/budgets/{budgetId}/approve` | ADMIN | Approve budget | 200, `status=APPROVED`, `approvedTotal=85000` |
| FIN-ST-008 | `PUT /api/v1/budgets/{budgetId}/approve` | ORGANIZER | Not allowed | 403 |
| FIN-ST-009 | `POST /api/v1/budgets/{budgetId}/items` | ORGANIZER | Add budget item | 201, item count > 3 |
| FIN-ST-010 | `POST /api/v1/expenses` | ORGANIZER | Log expense; stores `expenseId` | 201, `amount=12000` |
| FIN-ST-011 | `POST /api/v1/expenses` | ORGANIZER | Amount exceeds budget | 422, `code=FIN-4001` |
| FIN-ST-012 | `POST /api/v1/payments` | ATTENDEE | CARD payment; stores `paymentId`, `gatewayReference` | 201, `status=SUCCEEDED` |
| FIN-ST-013 | `POST /api/v1/payments` | ATTENDEE | `simulateFailure=true` | 402, `code=FIN-4002` |
| FIN-ST-014 | `POST /api/v1/payments` | ORGANIZER | BANK_TRANSFER; stores `pendingPaymentRef` | 201, `status=PENDING` |
| FIN-ST-015 | `GET /api/v1/payments/me` | ATTENDEE | List my payments | 200, array ≥ 1 item |
| FIN-ST-016 | `POST /api/v1/payments/webhook` | public | Webhook confirms BANK_TRANSFER | 200, `status=SUCCEEDED` |
| FIN-ST-017 | `POST /api/v1/payments/webhook` | public | Unknown gatewayReference | 404, `code=FIN-4042` |
| FIN-ST-018 | `POST /api/v1/payments` | none | No auth | 401 |
| FIN-ST-019 | `GET /api/v1/events/{eventId}/reports/financial` | ADMIN | Full report with populated data | 200, budget present, numeric totals |
| FIN-ST-020 | `GET /api/v1/events/{eventId}/reports/financial` | ATTENDEE | Forbidden | 403 |

---

## Manual API Checks (beyond automated)

- Enable Razorpay test keys and confirm `CARD`, `UPI`, and net-banking options open Razorpay Checkout.
- Verify `/api/v1/payments/verify` marks the payment `SUCCEEDED` after a real Razorpay checkout.
- Log multiple expenses across categories; confirm per-category actual totals in the report.
- Confirm financial report alerts escalate correctly: NONE → MEDIUM (>80%) → HIGH (>90%) → CRITICAL (>100%).

---

## Frontend Integration Checks

- `/admin/finance` loads live event options from the event service.
- `/admin/finance` creates a budget when the selected event has no finance data yet.
- `/admin/finance` shows live utilization, alerts, and recent transactions from the finance service.
- Logging an expense from `/admin/finance` refreshes totals and transaction history.
- Registering from `/events/:id` creates a finance payment after ticket registration and shows the payment reference in the success message.
- Registering from `/events/:id` opens Razorpay Checkout when the selected ticket has a non-zero price and Razorpay is enabled.
