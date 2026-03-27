using EventZen.Ticketing.Api.Common;
using EventZen.Ticketing.Api.Domain;
using EventZen.Ticketing.Api.Options;
using Microsoft.Extensions.Options;
using Minio;
using Minio.DataModel.Args;

namespace EventZen.Ticketing.Api.Services;

public sealed class TicketPassStorageService
{
    private readonly StorageOptions _options;
    private readonly IMinioClient? _minioClient;
    private readonly ILogger<TicketPassStorageService> _logger;

    public TicketPassStorageService(IOptions<StorageOptions> options, ILogger<TicketPassStorageService> logger)
    {
        _options = options.Value;
        _logger = logger;
        _minioClient = CreateClient(_options);
    }

    public bool IsEnabled => _options.Enabled && _minioClient is not null;

    public async Task<StoredTicketPass?> UploadAsync(
        RegistrationDocument registration,
        TicketDocument ticket,
        byte[] pdfBytes,
        CancellationToken cancellationToken)
    {
        if (!IsEnabled || pdfBytes.Length == 0)
        {
            return null;
        }

        var prefix = NormalizePrefix(_options.TicketPassesPrefix, "ticket-passes");
        var objectKey = $"{prefix}/{registration.EventId}/{registration.Id}/{SanitizeFileSegment(ticket.TicketNumber)}.pdf";

        try
        {
            await EnsureBucketExistsAsync(cancellationToken);
            await using var stream = new MemoryStream(pdfBytes, writable: false);
            await _minioClient!.PutObjectAsync(
                new PutObjectArgs()
                    .WithBucket(_options.Bucket)
                    .WithObject(objectKey)
                    .WithStreamData(stream)
                    .WithObjectSize(stream.Length)
                    .WithContentType("application/pdf"),
                cancellationToken);

            return new StoredTicketPass(objectKey, BuildPublicUrl(objectKey));
        }
        catch (Exception exception)
        {
            _logger.LogWarning(exception, "Unable to upload ticket pass PDF for registration {RegistrationId}", registration.Id);
            return null;
        }
    }

    private async Task EnsureBucketExistsAsync(CancellationToken cancellationToken)
    {
        var exists = await _minioClient!.BucketExistsAsync(
            new BucketExistsArgs().WithBucket(_options.Bucket),
            cancellationToken);

        if (!exists)
        {
            await _minioClient.MakeBucketAsync(
                new MakeBucketArgs().WithBucket(_options.Bucket),
                cancellationToken);
        }
    }

    private static IMinioClient? CreateClient(StorageOptions options)
    {
        if (!options.Enabled || string.IsNullOrWhiteSpace(options.Endpoint))
        {
            return null;
        }

        var endpoint = options.Endpoint.Trim();
        if (!Uri.TryCreate(endpoint, UriKind.Absolute, out var endpointUri))
        {
            endpointUri = new Uri($"http://{endpoint}");
        }

        return new MinioClient()
            .WithEndpoint(endpointUri.Authority)
            .WithCredentials(options.AccessKey, options.SecretKey)
            .WithSSL(string.Equals(endpointUri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase))
            .Build();
    }

    private string BuildPublicUrl(string objectKey)
    {
        if (string.IsNullOrWhiteSpace(_options.PublicBaseUrl))
        {
            throw new EventZenException(503, "SYSTEM_ERROR", "SYS-9503", "Ticket storage public URL is not configured");
        }

        return $"{_options.PublicBaseUrl.TrimEnd('/')}/{_options.Bucket}/{objectKey}";
    }

    private static string NormalizePrefix(string candidate, string fallback)
    {
        var value = string.IsNullOrWhiteSpace(candidate) ? fallback : candidate.Trim();
        return value.Trim('/').Replace('\\', '/');
    }

    private static string SanitizeFileSegment(string value)
    {
        var chars = value.Select(character =>
            char.IsLetterOrDigit(character) || character is '-' or '_'
                ? character
                : '-').ToArray();
        return new string(chars).Trim('-');
    }
}

public sealed record StoredTicketPass(string ObjectKey, string PublicUrl);
