# Finance Service Test Cases

## Automated

- Application context bootstraps with the `test` profile and in-memory H2 database.
- Organizer can create an event budget with multiple line items.
- Admin can approve a budget and preserve the approved total.
- Logging an expense updates actual spend and appears in the financial report.
- Successful payment creation contributes revenue to the financial report.
- Razorpay-disabled local test mode falls back to immediate non-gateway card success.
- Expense logging is rejected with `FIN-4001` when it exceeds the approved budget.

## Manual API Coverage

- Create a budget for an organizer-owned event.
- Approve a budget as `ADMIN`.
- Add an extra budget line item after initial creation.
- Log multiple expenses across categories and verify actual totals per line item.
- Initiate `CARD`, `UPI`, and `BANK_TRANSFER` payments and confirm status behavior.
- Enable Razorpay test keys and confirm `CARD`, `UPI`, and net-banking options open through Checkout.
- Verify `/api/v1/payments/verify` marks the payment as `SUCCEEDED` after successful Razorpay checkout.
- Trigger `/api/v1/payments/webhook` and verify a pending payment moves to `SUCCEEDED`.
- Confirm financial report totals: revenue, expenses, net profit, alerts, and recent transactions.
- Verify non-admins cannot approve budgets.
- Verify attendees cannot access budget/report endpoints.

## Frontend Integration Checks

- `/admin/finance` loads live event options from the event service.
- `/admin/finance` creates a budget when the selected event has no finance data yet.
- `/admin/finance` shows live utilization, alerts, and recent transactions from the finance service.
- Logging an expense from `/admin/finance` refreshes totals and transaction history.
- Registering from `/events/:id` creates a finance payment after ticket registration and shows the payment reference in the success message.
- Registering from `/events/:id` opens Razorpay Checkout when the selected ticket has a non-zero price and Razorpay is enabled.
