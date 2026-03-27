namespace EventZen.Ticketing.Api.Security;

public sealed record UserContext(
    Guid UserId,
    string Email,
    IReadOnlySet<string> Roles
)
{
    public bool HasRole(params string[] roles) => roles.Any(role => Roles.Contains(role, StringComparer.OrdinalIgnoreCase));
}
