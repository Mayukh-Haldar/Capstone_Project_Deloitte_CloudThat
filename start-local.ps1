[CmdletBinding()]
param(
    [switch]$SkipBuild,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$envPath = Join-Path $repoRoot ".env"
$composeFile = Join-Path $repoRoot "docker-compose.yml"

if (-not (Test-Path -LiteralPath $envPath)) {
    throw ".env file not found at $envPath"
}

function Get-EnvLines {
    param([string]$Path)

    return [System.Collections.Generic.List[string]](Get-Content -LiteralPath $Path)
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
        [int]$FallbackStart
    )

    if (-not (Test-PortExcluded -Port $PreferredPort -Ranges $ExcludedRanges) -and (Test-PortBindable -Port $PreferredPort)) {
        return $PreferredPort
    }

    for ($candidate = $FallbackStart; $candidate -le 65535; $candidate++) {
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

foreach ($setting in $portSettings) {
    $currentPort = Get-EnvValue -Lines $envLines -Key $setting.Key -DefaultValue $setting.Default
    $resolvedPort = Find-AvailablePort -PreferredPort $currentPort -ExcludedRanges $excludedRanges -FallbackStart $setting.FallbackStart

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

Set-EnvValue -Lines $envLines -Key "FRONTEND_ORIGIN" -Value $publicBaseUrl
Set-EnvValue -Lines $envLines -Key "AUTH_APP_BASE_URL" -Value $publicBaseUrl
Set-EnvValue -Lines $envLines -Key "VITE_SITE_URL" -Value $publicBaseUrl

if ($changes.Count -gt 0) {
    Write-Host "Updated .env with safe host ports:" -ForegroundColor Yellow
    foreach ($change in $changes) {
        Write-Host ("  {0}: {1} -> {2}" -f $change.Label, $change.Old, $change.New)
    }

    if (-not $DryRun) {
        Set-Content -LiteralPath $envPath -Value $envLines -Encoding ascii
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
