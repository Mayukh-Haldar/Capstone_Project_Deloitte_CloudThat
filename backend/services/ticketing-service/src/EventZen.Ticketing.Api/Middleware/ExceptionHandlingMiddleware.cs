using EventZen.Ticketing.Api.Common;

namespace EventZen.Ticketing.Api.Middleware;

public sealed class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;

    public ExceptionHandlingMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (EventZenException exception)
        {
            context.Response.StatusCode = exception.StatusCode;
            await context.Response.WriteAsJsonAsync(new ErrorResponse(
                exception.Error,
                exception.Code,
                exception.Message,
                exception.Details?.ToString(),
                context.TraceIdentifier
            ));
        }
        catch (Exception exception)
        {
            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            await context.Response.WriteAsJsonAsync(new ErrorResponse(
                "SYSTEM_ERROR",
                "SYS-9001",
                "Unexpected server error",
                exception.Message,
                context.TraceIdentifier
            ));
        }
    }

    private sealed record ErrorResponse(
        string Error,
        string Code,
        string Message,
        string? Details,
        string TraceId
    );
}
