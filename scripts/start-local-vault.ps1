param(
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$composeFiles = @(
    (Join-Path $repoRoot "docker-compose.yml"),
    (Join-Path $repoRoot "docker-compose.vault.yml")
)
$localVaultPortsPath = Join-Path $repoRoot ".secrets/local-vault-ports.json"

. (Join-Path $PSScriptRoot "vault/local-secret-store.ps1")

$setSecretsScript = Join-Path $PSScriptRoot "set-local-vault-secrets.ps1"

function Set-DefaultEnv {
    param(
        [string]$Name,
        [string]$Value
    )

    if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($Name))) {
        Set-Item -Path ("Env:{0}" -f $Name) -Value $Value
    }
}

function Get-EnvIntValue {
    param(
        [string]$Name,
        [int]$DefaultValue
    )

    $rawValue = [Environment]::GetEnvironmentVariable($Name)
    $parsedValue = 0
    if ([int]::TryParse($rawValue, [ref]$parsedValue)) {
        return $parsedValue
    }

    return $DefaultValue
}

function Get-ExcludedPortRanges {
    $output = & netsh int ipv4 show excludedportrange protocol=tcp
    $ranges = New-Object System.Collections.Generic.List[object]

    foreach ($line in $output) {
        if ($line -match "^\s*(\d+)\s+(\d+)\s*(\*)?\s*$") {
            $ranges.Add([pscustomobject]@{
                    Start = [int]$matches[1]
                    End   = [int]$matches[2]
                }) | Out-Null
        }
    }

    return $ranges
}

function Test-PortExcluded {
    param(
        [int]$Port,
        [System.Collections.Generic.List[object]]$Ranges
    )

    foreach ($range in $Ranges) {
        if ($Port -ge $range.Start -and $Port -le $range.End) {
            return $true
        }
    }

    return $false
}

function Test-PortBindable {
    param([int]$Port)

    $listener = $null
    try {
        $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
        $listener.Server.ExclusiveAddressUse = $true
        $listener.Start()
        return $true
    }
    catch {
        return $false
    }
    finally {
        if ($null -ne $listener) {
            $listener.Stop()
        }
    }
}

function Find-AvailablePort {
    param(
        [int]$PreferredPort,
        [System.Collections.Generic.List[object]]$ExcludedRanges,
        [int]$FallbackStart,
        [System.Collections.Generic.HashSet[int]]$ReservedPorts
    )

    if (
        -not $ReservedPorts.Contains($PreferredPort) -and
        -not (Test-PortExcluded -Port $PreferredPort -Ranges $ExcludedRanges) -and
        (Test-PortBindable -Port $PreferredPort)
    ) {
        return $PreferredPort
    }

    for ($candidate = $FallbackStart; $candidate -le 65535; $candidate++) {
        if ($ReservedPorts.Contains($candidate)) {
            continue
        }

        if (Test-PortExcluded -Port $candidate -Ranges $ExcludedRanges) {
            continue
        }

        if (Test-PortBindable -Port $candidate) {
            return $candidate
        }
    }

    throw "Unable to find an available TCP port starting from $FallbackStart"
}

function Get-LocalhostUrl {
    param([int]$Port)

    if ($Port -eq 80) {
        return "http://localhost"
    }

    return "http://localhost:$Port"
}

function Save-ResolvedPortState {
    param(
        [string]$Path,
        [object[]]$Settings
    )

    $portState = [ordered]@{}

    foreach ($setting in $Settings) {
        $portState[$setting.Key] = Get-EnvIntValue -Name $setting.Key -DefaultValue $setting.Default
    }

    $directory = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($directory)) {
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
    }

    $portState | ConvertTo-Json | Set-Content -Path $Path -Encoding UTF8
}

if (-not (Test-EventZenLocalSecretStore)) {
    Write-Host "Encrypted local Vault secret store not found. Initializing it now..." -ForegroundColor Yellow
    & $setSecretsScript
}

$localSecretValues = Read-EventZenLocalSecretStore
Assert-EventZenLocalSecretValues -SecretValues $localSecretValues
Set-EventZenSecretsToProcessEnvironment -SecretValues $localSecretValues

Set-DefaultEnv -Name "NGINX_PORT" -Value "80"
Set-DefaultEnv -Name "MYSQL_PORT" -Value "13306"
Set-DefaultEnv -Name "MONGODB_PORT" -Value "27018"
Set-DefaultEnv -Name "MINIO_API_PORT" -Value "9000"
Set-DefaultEnv -Name "MINIO_CONSOLE_PORT" -Value "9001"
Set-DefaultEnv -Name "ZOOKEEPER_PORT" -Value "2181"
Set-DefaultEnv -Name "KAFKA_PORT" -Value "9092"
Set-DefaultEnv -Name "KAFKA_UI_PORT" -Value "8091"
Set-DefaultEnv -Name "KAFKA_EXTERNAL_HOST" -Value "localhost"
Set-DefaultEnv -Name "PROMETHEUS_PORT" -Value "9090"
Set-DefaultEnv -Name "LOKI_HOST_PORT" -Value "3301"
Set-DefaultEnv -Name "TEMPO_HOST_PORT" -Value "3300"
Set-DefaultEnv -Name "OTEL_GRPC_PORT" -Value "4317"
Set-DefaultEnv -Name "OTEL_HTTP_PORT" -Value "4318"
Set-DefaultEnv -Name "OTEL_METRICS_PORT" -Value "8888"
Set-DefaultEnv -Name "GRAFANA_HOST_PORT" -Value "3308"
Set-DefaultEnv -Name "VAULT_PORT" -Value "8200"

$portSettings = @(
    @{ Key = "NGINX_PORT"; Default = 80; FallbackStart = 8080; Label = "Nginx" },
    @{ Key = "MYSQL_PORT"; Default = 13306; FallbackStart = 13306; Label = "MySQL" },
    @{ Key = "MONGODB_PORT"; Default = 27018; FallbackStart = 27018; Label = "MongoDB" },
    @{ Key = "MINIO_API_PORT"; Default = 9000; FallbackStart = 19000; Label = "MinIO API" },
    @{ Key = "MINIO_CONSOLE_PORT"; Default = 9001; FallbackStart = 19001; Label = "MinIO Console" },
    @{ Key = "ZOOKEEPER_PORT"; Default = 2181; FallbackStart = 12181; Label = "Zookeeper" },
    @{ Key = "KAFKA_PORT"; Default = 9092; FallbackStart = 19092; Label = "Kafka" },
    @{ Key = "KAFKA_UI_PORT"; Default = 8091; FallbackStart = 18091; Label = "Kafka UI" },
    @{ Key = "PROMETHEUS_PORT"; Default = 9090; FallbackStart = 19090; Label = "Prometheus" },
    @{ Key = "LOKI_HOST_PORT"; Default = 3301; FallbackStart = 13301; Label = "Loki" },
    @{ Key = "TEMPO_HOST_PORT"; Default = 3300; FallbackStart = 13300; Label = "Tempo" },
    @{ Key = "OTEL_GRPC_PORT"; Default = 4317; FallbackStart = 14317; Label = "OTel gRPC" },
    @{ Key = "OTEL_HTTP_PORT"; Default = 4318; FallbackStart = 14318; Label = "OTel HTTP" },
    @{ Key = "OTEL_METRICS_PORT"; Default = 8888; FallbackStart = 18888; Label = "OTel Metrics" },
    @{ Key = "GRAFANA_HOST_PORT"; Default = 3308; FallbackStart = 13308; Label = "Grafana" },
    @{ Key = "VAULT_PORT"; Default = 8200; FallbackStart = 18200; Label = "Vault" }
)

$excludedRanges = Get-ExcludedPortRanges
$reservedPorts = [System.Collections.Generic.HashSet[int]]::new()
$changes = New-Object System.Collections.Generic.List[object]

foreach ($setting in $portSettings) {
    $currentPort = Get-EnvIntValue -Name $setting.Key -DefaultValue $setting.Default
    $resolvedPort = Find-AvailablePort `
        -PreferredPort $currentPort `
        -ExcludedRanges $excludedRanges `
        -FallbackStart $setting.FallbackStart `
        -ReservedPorts $reservedPorts

    $reservedPorts.Add($resolvedPort) | Out-Null

    if ($resolvedPort -ne $currentPort) {
        Set-Item -Path ("Env:{0}" -f $setting.Key) -Value $resolvedPort
        $changes.Add([pscustomobject]@{
                Key   = $setting.Key
                Label = $setting.Label
                Old   = $currentPort
                New   = $resolvedPort
            }) | Out-Null
    }
}

$nginxPort = Get-EnvIntValue -Name "NGINX_PORT" -DefaultValue 80
$publicBaseUrl = Get-LocalhostUrl -Port $nginxPort
$minioApiPort = Get-EnvIntValue -Name "MINIO_API_PORT" -DefaultValue 9000
$minioBucket = [Environment]::GetEnvironmentVariable("MINIO_BUCKET")
if ([string]::IsNullOrWhiteSpace($minioBucket)) {
    $minioBucket = "eventzen-media"
}
$minioPublicBaseUrl = "$(Get-LocalhostUrl -Port $minioApiPort)/$minioBucket"

Set-Item -Path "Env:FRONTEND_ORIGIN" -Value $publicBaseUrl
Set-Item -Path "Env:AUTH_APP_BASE_URL" -Value $publicBaseUrl
Set-Item -Path "Env:VITE_SITE_URL" -Value $publicBaseUrl
Set-Item -Path "Env:MINIO_PUBLIC_BASE_URL" -Value $minioPublicBaseUrl

if ($changes.Count -gt 0) {
    Write-Host "Updated environment with safe host ports:" -ForegroundColor Yellow
    foreach ($change in $changes) {
        Write-Host ("  {0}: {1} -> {2}" -f $change.Label, $change.Old, $change.New)
    }
}
else {
    Write-Host "All configured host ports are available." -ForegroundColor Green
}

Save-ResolvedPortState -Path $localVaultPortsPath -Settings $portSettings
Write-Host "Saved resolved Vault port mappings to $localVaultPortsPath" -ForegroundColor DarkGray

$composeArgs = @(
    "compose"
)

foreach ($composeFile in $composeFiles) {
    $composeArgs += @("-f", $composeFile)
}

$composeArgs += @("up", "-d")

if (-not $SkipBuild) {
    $composeArgs += "--build"
}

Write-Host "Starting Docker Compose stack with local HashiCorp Vault..." -ForegroundColor Cyan
& docker @composeArgs

Write-Host "Vault UI: http://localhost:$env:VAULT_PORT/ui" -ForegroundColor Green
Write-Host "Vault-backed local stack started. Secrets were loaded from your encrypted local store, seeded into Vault, and rendered to in-memory tmpfs volumes." -ForegroundColor Green
