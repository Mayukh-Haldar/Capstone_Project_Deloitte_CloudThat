param(
    [switch]$RotateGeneratedSecrets,
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$setSecretsScript = Join-Path $PSScriptRoot "set-local-vault-secrets.ps1"
$startVaultScript = Join-Path $PSScriptRoot "start-local-vault.ps1"

function Assert-CommandAvailable {
    param(
        [string]$Name,
        [string]$InstallHint
    )

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "$Name is not available on PATH. $InstallHint"
    }
}

Assert-CommandAvailable -Name "docker" -InstallHint "Install Docker Desktop and reopen PowerShell."

try {
    docker version | Out-Null
}
catch {
    throw "Docker is installed but not responding. Start Docker Desktop, wait until it is healthy, then rerun this script."
}

$setSecretArgs = @()
if ($RotateGeneratedSecrets) {
    $setSecretArgs += "-RotateGeneratedSecrets"
}

Write-Host "Preparing encrypted local Vault secret store..." -ForegroundColor Cyan
& $setSecretsScript @setSecretArgs

$startArgs = @()
if ($SkipBuild) {
    $startArgs += "-SkipBuild"
}

Write-Host "Starting Vault-backed local stack..." -ForegroundColor Cyan
& $startVaultScript @startArgs
