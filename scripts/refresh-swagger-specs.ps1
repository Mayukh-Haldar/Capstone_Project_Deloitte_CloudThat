[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$specDirectory = Join-Path $projectRoot "backend\docker\nginx\static\docs\specs"

if (-not (Test-Path -LiteralPath $specDirectory)) {
    throw "Swagger spec directory not found: $specDirectory"
}

$services = @(
    @{ Name = "auth-service"; Url = "http://auth-service:8081/v3/api-docs"; File = "auth-service.json" },
    @{ Name = "event-service"; Url = "http://event-service:8082/v3/api-docs"; File = "event-service.json" },
    @{ Name = "finance-service"; Url = "http://finance-service:8085/v3/api-docs"; File = "finance-service.json" },
    @{ Name = "ticketing-service"; Url = "http://ticketing-service:8084/openapi/v1.json"; File = "ticketing-service.json" },
    @{ Name = "venue-vendor-service"; Url = "http://venue-vendor-service:8083/openapi.json"; File = "venue-vendor-service.json" },
    @{ Name = "notification-service"; Url = "http://notification-service:8086/openapi.json"; File = "notification-service.json" }
)

foreach ($service in $services) {
    $targetPath = Join-Path $specDirectory $service.File
    Write-Host "Refreshing $($service.Name) -> $($service.File)"
    $content = & docker exec eventzen-nginx sh -c "wget -qO- $($service.Url)"
    if ([string]::IsNullOrWhiteSpace($content)) {
        throw "No OpenAPI content returned for $($service.Name)"
    }

    $content | Set-Content -LiteralPath $targetPath -Encoding utf8
}

Write-Host "Swagger spec refresh complete."
