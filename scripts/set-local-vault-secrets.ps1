param(
    [switch]$RotateGeneratedSecrets,
    [switch]$RevealBootstrapPassword,
    [string]$ImportFromEnvFile,
    [switch]$ImportAllFromEnvFile,
    [switch]$ListStoredKeys
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot "vault/local-secret-store.ps1")

if ($ListStoredKeys) {
    $storePath = Get-EventZenLocalSecretStorePath
    if (-not (Test-EventZenLocalSecretStore)) {
        throw "Encrypted local Vault secret store not found at '$storePath'."
    }

    $storedValues = Read-EventZenLocalSecretStore
    if ($null -eq $storedValues -or $storedValues.Count -eq 0) {
        Write-Host "No env keys are currently stored in the encrypted local Vault secret store." -ForegroundColor Yellow
        exit 0
    }

    $storedKeys = @($storedValues.Keys | Sort-Object)
    Write-Host "Stored env keys in encrypted local Vault secret store ($($storedKeys.Count)):" -ForegroundColor Green
    foreach ($key in $storedKeys) {
        Write-Host "- $key"
    }

    exit 0
}

$explicitOverrides = @{}
if (-not [string]::IsNullOrWhiteSpace($ImportFromEnvFile)) {
    $resolvedImportPath = $ImportFromEnvFile
    if (-not [System.IO.Path]::IsPathRooted($resolvedImportPath)) {
        $resolvedImportPath = Join-Path $repoRoot $resolvedImportPath
    }
    if ($ImportAllFromEnvFile) {
        $explicitOverrides = Get-EventZenEnvFileEntries -Path $resolvedImportPath
    }
    else {
        $explicitOverrides = Get-EventZenEnvFileSecretOverrides -Path $resolvedImportPath
    }
}

$secretValues = Get-EventZenPreparedSecretValues -RotateGeneratedSecrets:$RotateGeneratedSecrets -ExplicitOverrides $explicitOverrides
Assert-EventZenLocalSecretValues -SecretValues $secretValues
Write-EventZenLocalSecretStore -SecretValues $secretValues

$storePath = Get-EventZenLocalSecretStorePath
$examplePath = Get-EventZenLocalSecretStoreExamplePath

Write-Host "Encrypted local Vault secret store updated." -ForegroundColor Green
Write-Host "Store path: $storePath" -ForegroundColor Cyan
Write-Host "Committed example path: $examplePath" -ForegroundColor Cyan
Write-Host "Secrets are protected with Windows DPAPI and tied to the current user profile." -ForegroundColor Cyan
Write-Host "Values are only loaded into process memory when scripts/start-local-vault.ps1 runs." -ForegroundColor Cyan
if ($explicitOverrides.Count -gt 0) {
    if ($ImportAllFromEnvFile) {
        Write-Host "Imported $($explicitOverrides.Count) env value(s) from env file into the encrypted store." -ForegroundColor Cyan
    }
    else {
        Write-Host "Imported $($explicitOverrides.Count) managed secret value(s) from env file." -ForegroundColor Cyan
    }
}
Write-Host "Bootstrap admin email: $($secretValues.AUTH_BOOTSTRAP_ADMIN_EMAIL)" -ForegroundColor Yellow

if ($RevealBootstrapPassword) {
    Write-Host "Bootstrap admin password: $($secretValues.AUTH_BOOTSTRAP_ADMIN_PASSWORD)" -ForegroundColor Yellow
}
else {
    Write-Host "Bootstrap admin password is stored in the encrypted local store and was not printed. Use -RevealBootstrapPassword only when you need to view it." -ForegroundColor Yellow
}

if ([string]::IsNullOrWhiteSpace($secretValues.AUTH_SMTP_PASSWORD) -and [string]::IsNullOrWhiteSpace($secretValues.NOTIFICATION_SMTP_PASSWORD) -and [string]::IsNullOrWhiteSpace($secretValues.NOTIFICATION_FIREBASE_PRIVATE_KEY) -and [string]::IsNullOrWhiteSpace($secretValues.FINANCE_RAZORPAY_KEY_SECRET)) {
    Write-Host "Optional third-party secrets are currently blank. If needed, set them in the current PowerShell session before rerunning this script." -ForegroundColor DarkYellow
    Write-Host "Example: `$env:AUTH_SMTP_PASSWORD = 'your-password'; .\scripts\set-local-vault-secrets.ps1" -ForegroundColor DarkYellow
}

if ($explicitOverrides.Count -eq 0 -and [string]::IsNullOrWhiteSpace($ImportFromEnvFile)) {
    Write-Host "Tip: import managed secret keys directly from a local env file with .\scripts\set-local-vault-secrets.ps1 -ImportFromEnvFile .env" -ForegroundColor DarkCyan
    Write-Host "Tip: import the full env payload with .\scripts\set-local-vault-secrets.ps1 -ImportFromEnvFile .env -ImportAllFromEnvFile" -ForegroundColor DarkCyan
}
