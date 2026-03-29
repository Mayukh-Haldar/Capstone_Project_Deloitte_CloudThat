[CmdletBinding()]
param(
    [switch]$SkipBuild,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $repoRoot ".env"
$composeFile = Join-Path $repoRoot "docker-compose.yml"

if (-not (Test-Path -LiteralPath $envPath)) {
    throw ".env file not found at $envPath"
}

function Get-EnvLines {
    param([string]$Path)

    return [System.Collections.Generic.List[string]](Get-Content -LiteralPath $Path)
}

function Save-EnvLines {
    param(
        [string]$Path,
        [System.Collections.Generic.List[string]]$Lines
    )

    $expectedLines = [string[]]$Lines
    Set-Content -LiteralPath $Path -Value $expectedLines -Encoding ascii

    # Verify the persisted file matches what we intended to write. This catches
    # host-specific sync or permission issues where Set-Content reports success
    # but the file on disk does not actually reflect the new values.
    $persistedLines = [string[]](Get-Content -LiteralPath $Path)
    if ($persistedLines.Length -ne $expectedLines.Length) {
        throw ".env write verification failed: line count mismatch after saving $Path"
    }

    for ($i = 0; $i -lt $expectedLines.Length; $i++) {
        if ($persistedLines[$i] -cne $expectedLines[$i]) {
            throw ".env write verification failed at line $($i + 1) after saving $Path"
        }
    }
}

function Set-EnvValue {
    param(
        [System.Collections.Generic.List[string]]$Lines,
        [string]$Key,
        [string]$Value
    )

    $pattern = "^{0}=" -f [regex]::Escape($Key)
    for ($i = 0; $i -lt $Lines.Count; $i++) {
        if ($Lines[$i] -match $pattern) {
            $Lines[$i] = "$Key=$Value"
            return
        }
    }

    $Lines.Add("$Key=$Value") | Out-Null
}

function Get-EnvValue {
    param(
        [string[]]$Lines,
        [string]$Key,
        [int]$DefaultValue
    )

    $prefix = "$Key="
    foreach ($line in $Lines) {
        if ($line.StartsWith($prefix)) {
            $rawValue = $line.Substring($prefix.Length).Trim()
            $parsedValue = 0
            if ([int]::TryParse($rawValue, [ref]$parsedValue)) {
                return $parsedValue
            }
        }
    }

    return $DefaultValue
}

function Get-EnvStringValue {
    param(
        [string[]]$Lines,
        [string]$Key,
        [string]$DefaultValue
    )

    $prefix = "$Key="
    foreach ($line in $Lines) {
        if ($line.StartsWith($prefix)) {
            return $line.Substring($prefix.Length).Trim()
        }
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
    } catch {
        return $false
    } finally {
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
    @{ Key = "GRAFANA_HOST_PORT"; Default = 3308; FallbackStart = 13308; Label = "Grafana" }
)

$envLines = Get-EnvLines -Path $envPath
$excludedRanges = Get-ExcludedPortRanges
$changes = New-Object System.Collections.Generic.List[object]
$reservedPorts = [System.Collections.Generic.HashSet[int]]::new()

foreach ($setting in $portSettings) {
    $currentPort = Get-EnvValue -Lines $envLines -Key $setting.Key -DefaultValue $setting.Default
    $resolvedPort = Find-AvailablePort `
        -PreferredPort $currentPort `
        -ExcludedRanges $excludedRanges `
        -FallbackStart $setting.FallbackStart `
        -ReservedPorts $reservedPorts

    $reservedPorts.Add($resolvedPort) | Out-Null

    if ($resolvedPort -ne $currentPort) {
        Set-EnvValue -Lines $envLines -Key $setting.Key -Value $resolvedPort
        $changes.Add([pscustomobject]@{
                Key   = $setting.Key
                Label = $setting.Label
                Old   = $currentPort
                New   = $resolvedPort
            }) | Out-Null
    }
}

$nginxPort = Get-EnvValue -Lines $envLines -Key "NGINX_PORT" -DefaultValue 80
$publicBaseUrl = Get-LocalhostUrl -Port $nginxPort
$minioApiPort = Get-EnvValue -Lines $envLines -Key "MINIO_API_PORT" -DefaultValue 9000
$minioBucket = Get-EnvStringValue -Lines $envLines -Key "MINIO_BUCKET" -DefaultValue "eventzen-media"
$minioPublicBaseUrl = "$(Get-LocalhostUrl -Port $minioApiPort)/$minioBucket"

Set-EnvValue -Lines $envLines -Key "FRONTEND_ORIGIN" -Value $publicBaseUrl
Set-EnvValue -Lines $envLines -Key "AUTH_APP_BASE_URL" -Value $publicBaseUrl
Set-EnvValue -Lines $envLines -Key "VITE_SITE_URL" -Value $publicBaseUrl
Set-EnvValue -Lines $envLines -Key "MINIO_PUBLIC_BASE_URL" -Value $minioPublicBaseUrl

if ($changes.Count -gt 0) {
    Write-Host "Updated .env with safe host ports:" -ForegroundColor Yellow
    foreach ($change in $changes) {
        Write-Host ("  {0}: {1} -> {2}" -f $change.Label, $change.Old, $change.New)
    }

    if (-not $DryRun) {
        Save-EnvLines -Path $envPath -Lines $envLines
    }
} else {
    Write-Host "All configured host ports are available." -ForegroundColor Green
}

if ($DryRun) {
    Write-Host "Dry run complete. Skipping docker compose startup." -ForegroundColor Cyan
    exit 0
}

$composeArgs = @(
    "compose",
    "--env-file", ".env",
    "-f", $composeFile,
    "up",
    "-d"
)

if (-not $SkipBuild) {
    $composeArgs += "--build"
}

Write-Host "Starting Docker Compose stack..." -ForegroundColor Cyan
& docker @composeArgs
exit $LASTEXITCODE
