param(
    [switch]$RemoveVolumes
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
    throw "Encrypted local Vault secret store not found at '$storePath'. Run .\scripts\set-local-vault-secrets.ps1 first, or stop the stack from a shell where the Vault env vars are already loaded."
}

$localSecretValues = Read-EventZenLocalSecretStore
Assert-EventZenLocalSecretValues -SecretValues $localSecretValues
Set-EventZenSecretsToProcessEnvironment -SecretValues $localSecretValues

$composeArgs = @()
foreach ($composeFile in $composeFiles) {
    $composeArgs += "-f"
    $composeArgs += $composeFile
}

$composeArgs += "down"
$composeArgs += "--remove-orphans"

if ($RemoveVolumes) {
    $composeArgs += "-v"
}

Write-Host "Stopping Vault-backed local Docker stack..." -ForegroundColor Cyan
docker compose @composeArgs
