namespace EventZen.Ticketing.Api.Common;

public sealed class EventZenException : Exception
{
    public int StatusCode { get; }
    public string Error { get; }
    public string Code { get; }
    public object? Details { get; }

    public EventZenException(int statusCode, string error, string code, string message, object? details = null) : base(message)
    {
        StatusCode = statusCode;
        Error = error;
        Code = code;
        Details = details;
    }
}
