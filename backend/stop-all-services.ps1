# Stop all backend services by matching the cmd.exe command line.
Write-Host "========================================"
Write-Host "Stopping All Backend Services"
Write-Host "========================================"
Write-Host ""

$services = @(
    @{ Name = "Auth Service"; Match = "services\auth-service" }
    @{ Name = "Event Service"; Match = "services\event-service" }
    @{ Name = "Finance Service"; Match = "services\finance-service" }
    @{ Name = "Notification Service"; Match = "services\notification-service" }
    @{ Name = "Ticketing Service"; Match = "services\ticketing-service" }
    @{ Name = "Venue Vendor Service"; Match = "services\venue-vendor-service" }
)

$stopped = 0

foreach ($service in $services) {
    $processes = Get-CimInstance Win32_Process -Filter "Name = 'cmd.exe'" |
        Where-Object { $_.CommandLine -like "*$($service.Match)*" }

    if ($processes) {
        foreach ($proc in $processes) {
            try {
                & taskkill /PID $proc.ProcessId /F /T | Out-Null
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "  - $($service.Name) stopped" -ForegroundColor Green
                    $stopped++
                } else {
                    Write-Host "  - Failed to stop $($service.Name)" -ForegroundColor Red
                }
            } catch {
                Write-Host "  - Failed to stop $($service.Name)" -ForegroundColor Red
            }
        }
    } else {
        Write-Host "  - $($service.Name) was not running" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "========================================"
if ($stopped -gt 0) {
    Write-Host "$stopped service(s) stopped successfully"
} else {
    Write-Host "No services found running"
}
Write-Host "========================================"
Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
