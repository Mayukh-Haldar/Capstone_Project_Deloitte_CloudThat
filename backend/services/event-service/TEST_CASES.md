# Event Service Test Cases

## Automated

- Application context bootstraps with test profile.
- Public category listing is accessible without auth.
- Organizer can create a valid event.
- Unauthenticated event creation is rejected.
- Capacity validation prevents expected attendees exceeding capacity.
- Session conflict detection blocks overlapping sessions.
- Venue integration is invoked when a venue booking payload is supplied.

## Manual API Coverage

- Create event as `ADMIN` and `ORGANIZER`.
- Update an organizer-owned event.
- Verify organizer cannot update another organizer's event.
- Transition status `DRAFT <-> PUBLISHED -> REGISTRATION_OPEN <-> PUBLISHED -> ONGOING -> COMPLETED -> ARCHIVED`.
- Reject invalid status transitions.
- Add multiple sessions and confirm agenda/session times stay inside event range.
- Reorder agenda items and verify persisted `sortOrder`.
- Create event with venue booking and confirm booking id is returned.
- Search events by title/type/description and filter by category, city, status, and organizer.

## Frontend Integration Checks

- Public `/events` page loads live events and category filters.
- `/events/:id` loads event detail and agenda.
- `/admin/events` creates events and updates status.
- `/admin/venues` booking form uses live event IDs from event service.
- `/admin/vendors` vendor review/hiring forms use live event IDs from event service.
