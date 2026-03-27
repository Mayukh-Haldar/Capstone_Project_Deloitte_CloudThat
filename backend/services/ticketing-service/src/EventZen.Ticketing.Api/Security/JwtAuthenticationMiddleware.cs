using System.Net;

namespace EventZen.Ticketing.Api.Security;

public sealed class JwtAuthenticationMiddleware
{
    public const string UserItemKey = "eventzen.user";

    private readonly RequestDelegate _next;

    public JwtAuthenticationMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, JwtTokenService tokenService, IWebHostEnvironment environment)
    {
        var authorization = context.Request.Headers.Authorization.ToString();
        if (authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            try
            {
                context.Items[UserItemKey] = tokenService.ParseAccessToken(authorization[7..]);
            }
            catch
            {
                context.Items.Remove(UserItemKey);
                TryApplyDevelopmentUserHeaders(context, environment);
            }
        }
        else
        {
            TryApplyDevelopmentUserHeaders(context, environment);
        }

        await _next(context);
    }

    private static void TryApplyDevelopmentUserHeaders(HttpContext context, IWebHostEnvironment environment)
    {
        if (!CanUseLocalDevFallback(context, environment) ||
            !context.Request.Headers.TryGetValue("x-user-id", out var userIdHeader) ||
            !Guid.TryParse(userIdHeader, out var devUserId))
        {
            return;
        }

        var roles = context.Request.Headers["x-user-roles"].ToString()
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        context.Items[UserItemKey] = new UserContext(
            devUserId,
            context.Request.Headers["x-user-email"].ToString(),
            new HashSet<string>(roles, StringComparer.OrdinalIgnoreCase));
    }

    private static bool CanUseLocalDevFallback(HttpContext context, IWebHostEnvironment environment)
    {
        if (environment.IsDevelopment())
        {
            return true;
        }

        var host = context.Request.Host.Host;
        if (string.Equals(host, "localhost", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(host, "127.0.0.1", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(host, "::1", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        if (context.Connection.RemoteIpAddress is { } remoteIp &&
            IPAddress.IsLoopback(remoteIp))
        {
            return true;
        }

        return false;
    }
}
