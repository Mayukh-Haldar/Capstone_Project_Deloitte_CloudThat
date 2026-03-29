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

. (Join-Path $PSScriptRoot "vault/local-secret-store.ps1")

if (-not (Test-EventZenLocalSecretStore)) {
    $storePath = Get-EventZenLocalSecretStorePath
    throw "Encrypted local Vault secret store not found at '$storePath'. Run .\scripts\set-local-vault-secrets.ps1 first."
}

$localSecretValues = Read-EventZenLocalSecretStore
Assert-EventZenLocalSecretValues -SecretValues $localSecretValues
Set-EventZenSecretsToProcessEnvironment -SecretValues $localSecretValues

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

Write-Host "Rebuilding Vault-backed local Docker Compose stack without reassigning ports..." -ForegroundColor Cyan
& docker @composeArgs
