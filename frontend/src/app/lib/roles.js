const normalize = (role) => role.trim().toUpperCase();
export const hasAdminRole = (roles = []) => roles.map(normalize).includes("ADMIN");
export const hasVendorRole = (roles = []) => roles.map(normalize).some((role) => role === "VENDOR" || role === "ORGANIZER");
export const hasCustomerRole = (roles = []) => roles.map(normalize).some((role) => role === "ATTENDEE" || role === "CUSTOMER") || (!hasAdminRole(roles) && !hasVendorRole(roles));
export const getPrimaryPortal = (session) => {
    if (!session?.user?.roles) {
        return null;
    }
    if (hasAdminRole(session.user.roles)) {
        return "ADMIN";
    }
    if (hasVendorRole(session.user.roles)) {
        return "VENDOR";
    }
    if (hasCustomerRole(session.user.roles)) {
        return "CUSTOMER";
    }
    return null;
};
export const getPortalHomePath = (portal) => {
    switch (portal) {
        case "ADMIN":
            return "/admin/dashboard";
        case "VENDOR":
            return "/vendor/dashboard";
        case "CUSTOMER":
            return "/customer/dashboard";
        default:
            return "/events";
    }
};
export const getPortalLabel = (portal) => {
    switch (portal) {
        case "ADMIN":
            return "Admin";
        case "VENDOR":
            return "Vendor";
        case "CUSTOMER":
            return "Customer";
        default:
            return "Portal";
    }
};
export const toPortalRoles = (roles = []) => {
    const portals = [];
    if (hasAdminRole(roles)) {
        portals.push("ADMIN");
    }
    if (hasVendorRole(roles)) {
        portals.push("VENDOR");
    }
    if (hasCustomerRole(roles)) {
        portals.push("CUSTOMER");
    }
    return portals;
};
export const toBackendRolesForPortal = (portal) => {
    switch (portal) {
        case "ADMIN":
            return ["ADMIN"];
        case "VENDOR":
            return ["ORGANIZER", "VENDOR"];
        case "CUSTOMER":
            return ["ATTENDEE"];
    }
};
export const portalFromPath = (pathname) => {
    if (pathname.startsWith("/admin")) {
        return "ADMIN";
    }
    if (pathname.startsWith("/vendor")) {
        return "VENDOR";
    }
    if (pathname.startsWith("/customer")) {
        return "CUSTOMER";
    }
    return null;
};
