Sample JSON drafts for admin venue creation import.

Files:
- `grand-tech-convention-center.json`
- `seaside-innovation-campus.json`
- `heritage-arts-pavilion.json`

These files are ready to upload from the admin venue creation section on `/admin/venues`.

Supported keys:
- `venueName` or `name`
- `address`
- `city`
- `capacity`
- `pricePerDay` or `dailyPrice`
- `amenities`
- `mediaGallery` or `images`
- `halls`

Notes:
- The importer prefills the manual form; admins can still edit every field before creating the venue.
- `amenities` can be either an array or a comma-separated string.
- `mediaGallery` can be either an array or a comma-separated string.
- Each hall should include `hallName` (or `name`) and `capacity`.
