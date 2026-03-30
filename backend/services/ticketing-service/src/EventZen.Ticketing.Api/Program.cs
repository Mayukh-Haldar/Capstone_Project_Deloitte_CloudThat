using System.Text.Json;
using EventZen.Ticketing.Api.Hubs;
using EventZen.Ticketing.Api.Infrastructure;
using EventZen.Ticketing.Api.Middleware;
using EventZen.Ticketing.Api.Options;
using EventZen.Ticketing.Api.Security;
using EventZen.Ticketing.Api.Services;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using Prometheus;

var builder = WebApplication.CreateBuilder(args);

ApplyDotEnvFiles(builder);
builder.Configuration.AddEnvironmentVariables();
ApplyLocalJwtFallback(builder);

builder.Services.Configure<MongoOptions>(builder.Configuration.GetSection("Mongo"));
builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection("Jwt"));
builder.Services.Configure<EventServiceOptions>(builder.Configuration.GetSection("EventService"));
builder.Services.Configure<CorsOptions>(builder.Configuration.GetSection("Cors"));
builder.Services.Configure<NotificationServiceOptions>(builder.Configuration.GetSection("NotificationService"));
builder.Services.Configure<StorageOptions>(builder.Configuration.GetSection("Storage"));

builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<JwtTokenService>();
builder.Services.AddSingleton<QrCodeService>();
builder.Services.AddSingleton<TicketDeliveryAssetService>();
builder.Services.AddSingleton<TicketPassStorageService>();
builder.Services.AddSingleton<ITicketingRepository, MongoTicketingRepository>();
builder.Services.AddHostedService<SampleTicketingSeeder>();
builder.Services.AddHttpClient<EventCatalogClient>();
builder.Services.AddHttpClient<INotificationDispatchClient, NotificationDispatchClient>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(3);
});
builder.Services.AddScoped<TicketingService>();

builder.Services.AddControllers().AddJsonOptions(options =>
{
    options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    options.JsonSerializerOptions.DictionaryKeyPolicy = JsonNamingPolicy.CamelCase;
});
builder.Services.AddOpenApi("v1");

builder.Services.AddSignalR();

builder.Services.AddCors(options =>
{
    options.AddPolicy("eventzen", policy =>
    {
        var origins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? ["http://localhost:5173"];
        policy.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod().AllowCredentials();
    });
});

builder.Services
    .AddOpenTelemetry()
    .ConfigureResource(resource => resource.AddService("ticketing-service"))
    .WithTracing(tracing => tracing
        .AddAspNetCoreInstrumentation()
        .AddHttpClientInstrumentation()
        .AddOtlpExporter(options =>
        {
            var endpoint = builder.Configuration["OTEL_EXPORTER_OTLP_ENDPOINT"];
            if (!string.IsNullOrWhiteSpace(endpoint))
            {
                options.Endpoint = new Uri(endpoint);
            }
        }));

var app = builder.Build();

app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseCors("eventzen");
app.UseHttpMetrics();
app.UseMiddleware<JwtAuthenticationMiddleware>();
app.MapOpenApi("/openapi/{documentName}.json");
app.MapControllers();
app.MapHub<SeatHub>("/seat-hub");
app.MapMetrics("/metrics");

app.Run();

static void ApplyLocalJwtFallback(WebApplicationBuilder builder)
{
    if (!builder.Environment.IsDevelopment())
    {
        return;
    }

    var configuredSecret = builder.Configuration["Jwt:Secret"];
    if (!string.IsNullOrWhiteSpace(configuredSecret) &&
        !configuredSecret.StartsWith("replace-with-", StringComparison.OrdinalIgnoreCase))
    {
        return;
    }

    foreach (var candidate in GetAuthEnvCandidates(builder.Environment.ContentRootPath))
    {
        if (!File.Exists(candidate))
        {
            continue;
        }

        var authJwtSecret = TryReadDotEnvValue(candidate, "AUTH_JWT_SECRET");
        if (string.IsNullOrWhiteSpace(authJwtSecret))
        {
            continue;
        }

        builder.Configuration.AddInMemoryCollection(
        [
            new KeyValuePair<string, string?>("Jwt:Secret", authJwtSecret)
        ]);

        break;
    }
}

static void ApplyDotEnvFiles(WebApplicationBuilder builder)
{
    foreach (var candidate in GetDotEnvCandidates(builder.Environment.ContentRootPath))
    {
        if (!File.Exists(candidate))
        {
            continue;
        }

        var entries = ReadDotEnv(candidate);
        if (entries.Count == 0)
        {
            continue;
        }

        builder.Configuration.AddInMemoryCollection(entries);
    }
}

static IEnumerable<string> GetDotEnvCandidates(string contentRootPath)
{
    yield return Path.Combine(contentRootPath, ".env");
    yield return Path.Combine(contentRootPath, ".env.local");
    yield return Path.GetFullPath(Path.Combine(contentRootPath, "..", "..", "..", ".env"));
    yield return Path.GetFullPath(Path.Combine(contentRootPath, "..", "..", "..", ".env.local"));
}

static IEnumerable<string> GetAuthEnvCandidates(string contentRootPath)
{
    yield return Path.GetFullPath(Path.Combine(contentRootPath, "..", "..", "..", "auth-service", ".env"));
    yield return Path.GetFullPath(Path.Combine(contentRootPath, "..", "..", "auth-service", ".env"));
}

static IReadOnlyDictionary<string, string?> ReadDotEnv(string filePath)
{
    var values = new Dictionary<string, string?>(StringComparer.Ordinal);

    foreach (var rawLine in File.ReadLines(filePath))
    {
        var line = rawLine.Trim();
        if (line.Length == 0 || line.StartsWith('#'))
        {
            continue;
        }

        var separatorIndex = line.IndexOf('=');
        if (separatorIndex <= 0)
        {
            continue;
        }

        var key = line[..separatorIndex].Trim().Replace("__", ":");
        var value = line[(separatorIndex + 1)..].Trim();
        values[key] = value;
    }

    return values;
}

static string? TryReadDotEnvValue(string filePath, string key)
{
    var values = ReadDotEnv(filePath);
    return values.TryGetValue(key, out var value) ? value : null;
}

public partial class Program;
