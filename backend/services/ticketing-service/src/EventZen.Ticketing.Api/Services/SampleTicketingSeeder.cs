using EventZen.Ticketing.Api.Domain;
using EventZen.Ticketing.Api.Infrastructure;

namespace EventZen.Ticketing.Api.Services;

public sealed class SampleTicketingSeeder : IHostedService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<SampleTicketingSeeder> _logger;

    public SampleTicketingSeeder(IServiceProvider serviceProvider, ILogger<SampleTicketingSeeder> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var repository = scope.ServiceProvider.GetRequiredService<ITicketingRepository>();

        foreach (var ticketType in SampleTicketCatalog.TicketTypes)
        {
            var existing = await repository.ListTicketTypesAsync(ticketType.EventId, cancellationToken);
            if (existing.Any(item => item.Id == ticketType.Id))
            {
                continue;
            }

            await repository.SaveTicketTypeAsync(ticketType, cancellationToken);
        }

        _logger.LogInformation("Seeded sample ticketing catalog for {Count} ticket tiers", SampleTicketCatalog.TicketTypes.Count);
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
