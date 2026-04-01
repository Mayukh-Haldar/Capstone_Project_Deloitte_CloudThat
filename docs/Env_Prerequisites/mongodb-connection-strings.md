# MongoDB Connection Strings

[Back to README section](../../README.md#env-file-example-and-prerequisites-for-hashi-corp-vault) | [Back to env overview](./OVERVIEW.md)

EventZen can run MongoDB in two ways:

1. Against the local Docker MongoDB container included in the stack.
2. Against MongoDB Atlas if you want a hosted cluster.

## Variables covered

- `VENUE_VENDOR_MONGO_URI`
- `TICKETING_MONGO_CONNECTION_STRING`
- `TICKETING_MONGO_DATABASE`
- `NOTIFICATION_MONGO_URI`

## Option A: Local Docker MongoDB

If you are using the repository's local MongoDB container, these values can stay local-only and simple:

```env
VENUE_VENDOR_MONGO_URI=mongodb://mongodb:27017/eventzen_venue_vendor
TICKETING_MONGO_CONNECTION_STRING=mongodb://mongodb:27017
TICKETING_MONGO_DATABASE=eventzen_ticketing
NOTIFICATION_MONGO_URI=mongodb://mongodb:27017/eventzen_notifications
```

Use this option for the easiest local setup.

## Option B: MongoDB Atlas

If you prefer Atlas, MongoDB's current Atlas flow is:

1. Create a cluster.
2. Create a database user.
3. Add your IP address to the network access list.
4. Open the **Connect** dialog and copy the connection string.

## Atlas step-by-step setup

### 1. Create an Atlas project and cluster

1. Open Atlas: https://cloud.mongodb.com/
2. Create or select a project.
3. Create a cluster that fits your environment.

### 2. Create a database user

1. In Atlas, create a database user for EventZen.
2. Save the username and password securely.

### 3. Allow network access

1. Add your development IP address to the Atlas IP access list.
2. If your IP changes often, update the access list before testing again.

### 4. Copy the connection string

1. Open the cluster.
2. Click **Connect**.
3. Choose the driver connection option.
4. Copy the SRV connection string, which usually starts with `mongodb+srv://`.

### 5. Map the values to `.env`

Examples:

```env
VENUE_VENDOR_MONGO_URI=mongodb+srv://username:password@cluster-url/eventzen_venue_vendor?retryWrites=true&w=majority
TICKETING_MONGO_CONNECTION_STRING=mongodb+srv://username:password@cluster-url/?retryWrites=true&w=majority
TICKETING_MONGO_DATABASE=eventzen_ticketing
NOTIFICATION_MONGO_URI=mongodb+srv://username:password@cluster-url/eventzen_notifications?retryWrites=true&w=majority
```

## Practical notes

- Keep per-service databases separate even when they share one cluster.
- Prefer SRV connection strings for Atlas.
- Do not commit Atlas usernames or passwords.
- If you move from local MongoDB to Atlas, make sure firewall and outbound rules allow access to Atlas.

## Official references

- Atlas cluster creation and connection flow: https://www.mongodb.com/docs/atlas/create-connect-deployments/
- Atlas connection guide: https://www.mongodb.com/docs/atlas/connect-to-cluster/
