Set-StrictMode -Version Latest

Add-Type -AssemblyName System.Security

$script:EventZenRepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$script:EventZenSecretStoreDirectory = Join-Path $script:EventZenRepoRoot ".secrets"
$script:EventZenSecretStorePath = Join-Path $script:EventZenSecretStoreDirectory "local-vault-secrets.dpapi"
$script:EventZenSecretStoreExamplePath = Join-Path $script:EventZenSecretStoreDirectory "local-vault-secrets.dpapi.example.json"
$script:EventZenSecretStoreEntropy = [System.Text.Encoding]::UTF8.GetBytes("EventZen.LocalVault.SecretStore.v1")

function Get-EventZenLocalSecretStorePath {
    return $script:EventZenSecretStorePath
}

function Get-EventZenLocalSecretStoreExamplePath {
    return $script:EventZenSecretStoreExamplePath
}

function Get-EventZenManagedSecretKeys {
    return @(
        "VAULT_DEV_ROOT_TOKEN_ID",
        "MYSQL_ROOT_PASSWORD",
        "MINIO_ROOT_PASSWORD",
        "GRAFANA_ADMIN_PASSWORD",
        "AUTH_DB_PASSWORD",
        "EVENT_DB_PASSWORD",
        "FINANCE_DB_PASSWORD",
        "AUTH_JWT_SECRET",
        "AUTH_CRYPTO_SECRET",
        "AUTH_BOOTSTRAP_ADMIN_EMAIL",
        "AUTH_BOOTSTRAP_ADMIN_PASSWORD",
        "NOTIFICATION_INTERNAL_SERVICE_KEY",
        "TICKETING_INTERNAL_SERVICE_KEY",
        "VENUE_VENDOR_INTERNAL_SERVICE_KEY",
        "AUTH_SMTP_USERNAME",
        "AUTH_SMTP_PASSWORD",
        "NOTIFICATION_SMTP_USERNAME",
        "NOTIFICATION_SMTP_PASSWORD",
        "NOTIFICATION_FIREBASE_PROJECT_ID",
        "NOTIFICATION_FIREBASE_CLIENT_EMAIL",
        "NOTIFICATION_FIREBASE_PRIVATE_KEY",
        "FINANCE_RAZORPAY_KEY_ID",
        "FINANCE_RAZORPAY_KEY_SECRET"
    )
}

function Get-EventZenRequiredSecretKeys {
    return @(
        "VAULT_DEV_ROOT_TOKEN_ID",
        "MYSQL_ROOT_PASSWORD",
        "MINIO_ROOT_PASSWORD",
        "GRAFANA_ADMIN_PASSWORD",
        "AUTH_DB_PASSWORD",
        "EVENT_DB_PASSWORD",
        "FINANCE_DB_PASSWORD",
        "AUTH_JWT_SECRET",
        "AUTH_CRYPTO_SECRET",
        "AUTH_BOOTSTRAP_ADMIN_EMAIL",
        "AUTH_BOOTSTRAP_ADMIN_PASSWORD",
        "NOTIFICATION_INTERNAL_SERVICE_KEY",
        "TICKETING_INTERNAL_SERVICE_KEY",
        "VENUE_VENDOR_INTERNAL_SERVICE_KEY"
    )
}

function New-EventZenRandomSecret {
    param(
        [int]$ByteLength = 32
    )

    $bytes = [byte[]]::new($ByteLength)
    $randomNumberGenerator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $randomNumberGenerator.GetBytes($bytes)
    }
    finally {
        $randomNumberGenerator.Dispose()
    }
    $secret = [Convert]::ToBase64String($bytes)
    return $secret.TrimEnd('=') -replace '\+', '-' -replace '/', '_'
}

function Get-EventZenLocalSecretDefaults {
    return [ordered]@{
        VAULT_DEV_ROOT_TOKEN_ID         = "eventzen-root-$(New-EventZenRandomSecret -ByteLength 18)"
        MYSQL_ROOT_PASSWORD             = New-EventZenRandomSecret
        MINIO_ROOT_PASSWORD             = New-EventZenRandomSecret
        GRAFANA_ADMIN_PASSWORD          = New-EventZenRandomSecret
        AUTH_DB_PASSWORD                = New-EventZenRandomSecret
        EVENT_DB_PASSWORD               = New-EventZenRandomSecret
        FINANCE_DB_PASSWORD             = New-EventZenRandomSecret
        AUTH_JWT_SECRET                 = New-EventZenRandomSecret -ByteLength 48
        AUTH_CRYPTO_SECRET              = New-EventZenRandomSecret -ByteLength 48
        AUTH_BOOTSTRAP_ADMIN_EMAIL      = "admin@eventzen.local"
        AUTH_BOOTSTRAP_ADMIN_PASSWORD   = New-EventZenRandomSecret -ByteLength 24
        NOTIFICATION_INTERNAL_SERVICE_KEY = New-EventZenRandomSecret
        TICKETING_INTERNAL_SERVICE_KEY    = New-EventZenRandomSecret
        VENUE_VENDOR_INTERNAL_SERVICE_KEY = New-EventZenRandomSecret
        AUTH_SMTP_USERNAME              = ""
        AUTH_SMTP_PASSWORD              = ""
        NOTIFICATION_SMTP_USERNAME      = ""
        NOTIFICATION_SMTP_PASSWORD      = ""
        NOTIFICATION_FIREBASE_PROJECT_ID = ""
        NOTIFICATION_FIREBASE_CLIENT_EMAIL = ""
        NOTIFICATION_FIREBASE_PRIVATE_KEY = ""
        FINANCE_RAZORPAY_KEY_ID         = ""
        FINANCE_RAZORPAY_KEY_SECRET     = ""
    }
}

function Merge-EventZenSecretValues {
    param(
        [hashtable]$BaseValues,
        [hashtable]$OverrideValues
    )

    foreach ($key in $OverrideValues.Keys) {
        $BaseValues[$key] = $OverrideValues[$key]
    }

    return $BaseValues
}

function Get-EventZenEnvironmentSecretOverrides {
    $overrides = @{}

    foreach ($key in Get-EventZenManagedSecretKeys) {
        $value = [Environment]::GetEnvironmentVariable($key)
        if ($null -ne $value) {
            $overrides[$key] = $value
        }
    }

    return $overrides
}

function Get-EventZenEnvFileEntries {
    param(
        [string]$Path
    )

    if ([string]::IsNullOrWhiteSpace($Path)) {
        return @{}
    }

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Env file not found: $Path"
    }

    $entries = @{}
    $lines = Get-Content -LiteralPath $Path

    foreach ($line in $lines) {
        $trimmedLine = $line.Trim()
        if ([string]::IsNullOrWhiteSpace($trimmedLine) -or $trimmedLine.StartsWith("#")) {
            continue
        }

        $separatorIndex = $trimmedLine.IndexOf("=")
        if ($separatorIndex -lt 1) {
            continue
        }

        $key = $trimmedLine.Substring(0, $separatorIndex).Trim()
        $value = $trimmedLine.Substring($separatorIndex + 1)
        if ($value.Length -ge 2) {
            $firstCharacter = $value[0]
            $lastCharacter = $value[$value.Length - 1]
            if (($firstCharacter -eq '"' -and $lastCharacter -eq '"') -or ($firstCharacter -eq "'" -and $lastCharacter -eq "'")) {
                $value = $value.Substring(1, $value.Length - 2)
            }
        }

        $entries[$key] = $value
    }

    return $entries
}

function Get-EventZenEnvFileSecretOverrides {
    param(
        [string]$Path
    )

    $entries = Get-EventZenEnvFileEntries -Path $Path

    $managedKeys = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)
    foreach ($key in Get-EventZenManagedSecretKeys) {
        $managedKeys.Add($key) | Out-Null
    }

    $overrides = @{}
    foreach ($key in $entries.Keys) {
        if (-not $managedKeys.Contains($key)) {
            continue
        }

        $overrides[$key] = $entries[$key]
    }

    return $overrides
}

function Test-EventZenLocalSecretStore {
    return Test-Path -LiteralPath (Get-EventZenLocalSecretStorePath)
}

function Protect-EventZenLocalSecretPayload {
    param(
        [string]$Json
    )

    $plainBytes = [System.Text.Encoding]::UTF8.GetBytes($Json)
    return [System.Security.Cryptography.ProtectedData]::Protect(
        $plainBytes,
        $script:EventZenSecretStoreEntropy,
        [System.Security.Cryptography.DataProtectionScope]::CurrentUser
    )
}

function Unprotect-EventZenLocalSecretPayload {
    param(
        [byte[]]$CipherBytes
    )

    $plainBytes = [System.Security.Cryptography.ProtectedData]::Unprotect(
        $CipherBytes,
        $script:EventZenSecretStoreEntropy,
        [System.Security.Cryptography.DataProtectionScope]::CurrentUser
    )

    return [System.Text.Encoding]::UTF8.GetString($plainBytes)
}

function Write-EventZenLocalSecretStore {
    param(
        [hashtable]$SecretValues
    )

    if (-not (Test-Path -LiteralPath $script:EventZenSecretStoreDirectory)) {
        New-Item -ItemType Directory -Path $script:EventZenSecretStoreDirectory -Force | Out-Null
    }

    $json = $SecretValues | ConvertTo-Json -Depth 4 -Compress
    $cipherBytes = Protect-EventZenLocalSecretPayload -Json $json
    [System.IO.File]::WriteAllBytes((Get-EventZenLocalSecretStorePath), $cipherBytes)
}

function ConvertTo-EventZenHashtable {
    param(
        [object]$Value
    )

    if ($null -eq $Value) {
        return $null
    }

    if ($Value -is [System.Collections.IDictionary]) {
        $table = @{}
        foreach ($key in $Value.Keys) {
            $table[[string]$key] = ConvertTo-EventZenHashtable -Value $Value[$key]
        }

        return $table
    }

    if ($Value -is [System.Management.Automation.PSCustomObject]) {
        $table = @{}
        foreach ($property in $Value.PSObject.Properties) {
            $table[$property.Name] = ConvertTo-EventZenHashtable -Value $property.Value
        }

        return $table
    }

    if ($Value -is [System.Collections.IEnumerable] -and -not ($Value -is [string])) {
        $items = New-Object System.Collections.Generic.List[object]
        foreach ($item in $Value) {
            $items.Add((ConvertTo-EventZenHashtable -Value $item)) | Out-Null
        }

        return $items.ToArray()
    }

    return $Value
}

function Read-EventZenLocalSecretStore {
    if (-not (Test-EventZenLocalSecretStore)) {
        return $null
    }

    $cipherBytes = [System.IO.File]::ReadAllBytes((Get-EventZenLocalSecretStorePath))
    $json = Unprotect-EventZenLocalSecretPayload -CipherBytes $cipherBytes
    $data = ConvertFrom-Json -InputObject $json
    return [hashtable](ConvertTo-EventZenHashtable -Value $data)
}

function Assert-EventZenLocalSecretValues {
    param(
        [hashtable]$SecretValues
    )

    $missingKeys = New-Object System.Collections.Generic.List[string]

    foreach ($key in Get-EventZenRequiredSecretKeys) {
        if (-not $SecretValues.ContainsKey($key) -or [string]::IsNullOrWhiteSpace([string]$SecretValues[$key])) {
            $missingKeys.Add($key) | Out-Null
        }
    }

    if ($missingKeys.Count -gt 0) {
        throw "Local secret store is missing required keys: $($missingKeys -join ', ')"
    }
}

function Get-EventZenPreparedSecretValues {
    param(
        [switch]$RotateGeneratedSecrets,
        [hashtable]$ExplicitOverrides
    )

    $secretValues = Get-EventZenLocalSecretDefaults

    if ((Test-EventZenLocalSecretStore) -and -not $RotateGeneratedSecrets) {
        $existingValues = Read-EventZenLocalSecretStore
        if ($null -ne $existingValues) {
            $secretValues = Merge-EventZenSecretValues -BaseValues $secretValues -OverrideValues $existingValues
        }
    }

    $environmentOverrides = Get-EventZenEnvironmentSecretOverrides
    if ($environmentOverrides.Count -gt 0) {
        $secretValues = Merge-EventZenSecretValues -BaseValues $secretValues -OverrideValues $environmentOverrides
    }

    if ($null -ne $ExplicitOverrides -and $ExplicitOverrides.Count -gt 0) {
        $secretValues = Merge-EventZenSecretValues -BaseValues $secretValues -OverrideValues $ExplicitOverrides
    }

    return $secretValues
}

function Set-EventZenSecretsToProcessEnvironment {
    param(
        [hashtable]$SecretValues
    )

    foreach ($key in $SecretValues.Keys) {
        Set-Item -Path ("Env:{0}" -f $key) -Value ([string]$SecretValues[$key])
    }
}
