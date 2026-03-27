# Notification Service Test Cases

| ID | Level | Area | Scenario | Expected Result |
| --- | --- | --- | --- | --- |
| NTF-UT-001 | Unit | Template rendering | Render subject/body/html with variables | Variables interpolate correctly |
| NTF-UT-002 | Unit | Preferences | Disabled channel rejects event delivery | `isChannelEnabled` returns `false` |
| NTF-UT-003 | Unit | Preferences | Allow-list permits only matching event types | Matching type `true`, others `false` |
| NTF-IT-001 | Integration | Internal trigger | Send `registration.confirmed` to attendee | Notification records created for configured channels |
| NTF-IT-002 | Integration | Inbox | Authenticated attendee lists own notifications | Paginated notification page returned |
| NTF-IT-003 | Integration | Inbox | Attendee marks a notification as read | `readAt` set and status becomes `READ` |
| NTF-IT-004 | Integration | Delivery logs | Admin fetches delivery logs | Paginated log data returned |
| NTF-IT-005 | Integration | Preferences | User updates preferences | Stored preference document reflects submitted values |
| NTF-ST-001 | System | Templates | Admin creates and previews a template | Template persists and preview renders |
| NTF-ST-002 | System | Preferences | User mutes SMS notifications | `sms.enabled=false` in subsequent reads |
| NTF-ST-003 | System | Inbox | User deletes notification | Resource becomes hidden from inbox listings |
| NTF-ST-004 | System | Security | Missing internal service key on send endpoint | HTTP 403 with EventZen error payload |
| NTF-ST-005 | System | Security | Non-admin requests delivery logs | HTTP 403 with authorization error |
