using EventZen.Ticketing.Api.Common;
using EventZen.Ticketing.Api.Security;
using Microsoft.AspNetCore.Mvc;

namespace EventZen.Ticketing.Api.Controllers;

[ApiController]
public abstract class ApiControllerBase : ControllerBase
{
    protected UserContext RequireUser()
    {
        if (HttpContext.Items.TryGetValue(JwtAuthenticationMiddleware.UserItemKey, out var value) && value is UserContext user)
        {
            return user;
        }

        throw new EventZenException(401, "AUTHENTICATION_ERROR", "AUTH-1002", "Authentication required");
    }

    protected UserContext RequireRoles(params string[] roles)
    {
        var user = RequireUser();
        if (!user.HasRole(roles))
        {
            throw new EventZenException(403, "AUTHORIZATION_ERROR", "AUTH-1003", "Insufficient permissions for resource");
        }

        return user;
    }
}
