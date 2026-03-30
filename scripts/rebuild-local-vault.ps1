param(
    [switch]$SkipBuild,
    [string[]]$Services
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$composeFiles = @(
    (Join-Path $repoRoot "docker-compose.yml"),
    (Join-Path $repoRoot "docker-compose.vault.yml")
)
$localVaultPortsPath = Join-Path $repoRoot ".secrets/local-vault-ports.json"
$portKeys = @(
    "NGINX_PORT",
    "MYSQL_PORT",
    "MONGODB_PORT",
    "MINIO_API_PORT",
    "MINIO_CONSOLE_PORT",
    "ZOOKEEPER_PORT",
    "KAFKA_PORT",
    "KAFKA_UI_PORT",
    "PROMETHEUS_PORT",
    "LOKI_HOST_PORT",
    "TEMPO_HOST_PORT",
    "OTEL_GRPC_PORT",
    "OTEL_HTTP_PORT",
    "OTEL_METRICS_PORT",
    "GRAFANA_HOST_PORT",
    "VAULT_PORT"
)

. (Join-Path $PSScriptRoot "vault/local-secret-store.ps1")

function ConvertTo-Hashtable {
    param(
        [Parameter(Mandatory = $true)]
        [object]$InputObject
    )

    if ($null -eq $InputObject) {
        return $null
    }

    if ($InputObject -is [System.Collections.IDictionary]) {
        $dictionary = @{}
        foreach ($key in $InputObject.Keys) {
            $dictionary[$key] = ConvertTo-Hashtable -InputObject $InputObject[$key]
        }

        return $dictionary
    }

    if ($InputObject -is [System.Collections.IEnumerable] -and -not ($InputObject -is [string])) {
        $items = @()
        foreach ($item in $InputObject) {
            $items += ,(ConvertTo-Hashtable -InputObject $item)
        }

        return $items
    }

    if ($InputObject -is [psobject]) {
        $properties = $InputObject.PSObject.Properties
        if ($null -ne $properties) {
            $dictionary = @{}
            foreach ($property in $properties) {
                $dictionary[$property.Name] = ConvertTo-Hashtable -InputObject $property.Value
            }

            if ($dictionary.Count -gt 0) {
                return $dictionary
            }
        }
    }

    return $InputObject
}

if (-not (Test-Path -LiteralPath $localVaultPortsPath)) {
    throw "Saved Vault port state not found at '$localVaultPortsPath'. Run .\scripts\start-local-vault.ps1 first so rebuild-local-vault can reuse the resolved ports."
}

if (-not (Test-EventZenLocalSecretStore)) {
    $storePath = Get-EventZenLocalSecretStorePath
    throw "Encrypted local Vault secret store not found at '$storePath'. Run .\scripts\set-local-vault-secrets.ps1 first."
}

$localSecretValues = Read-EventZenLocalSecretStore
Assert-EventZenLocalSecretValues -SecretValues $localSecretValues
Set-EventZenSecretsToProcessEnvironment -SecretValues $localSecretValues

$savedPortsObject = Get-Content -LiteralPath $localVaultPortsPath -Raw | ConvertFrom-Json
$savedPorts = ConvertTo-Hashtable -InputObject $savedPortsObject

foreach ($portKey in $portKeys) {
    if (-not $savedPorts.ContainsKey($portKey)) {
        throw "Saved Vault port state at '$localVaultPortsPath' is missing '$portKey'. Run .\scripts\start-local-vault.ps1 again to refresh the stored port mappings."
    }

    Set-Item -Path ("Env:{0}" -f $portKey) -Value ([string]$savedPorts[$portKey])
}

$composeArgs = @("compose")
foreach ($composeFile in $composeFiles) {
    $composeArgs += @("-f", $composeFile)
}

$composeArgs += @("up", "-d")

if (-not $SkipBuild) {
    $composeArgs += "--build"
}

if ($null -ne $Services -and $Services.Count -gt 0) {
    $composeArgs += $Services
}

Write-Host "Rebuilding Vault-backed local Docker Compose stack using saved Vault port mappings..." -ForegroundColor Cyan
& docker @composeArgs
