param(
    [string]$EnvFile = ".env",
    [string]$AuthToken
)

$ErrorActionPreference = "Stop"

function Get-EnvValue {
    param(
        [string]$Path,
        [string]$Key
    )

    if (-not (Test-Path $Path)) {
        throw "Environment file not found: $Path"
    }

    $line = Get-Content $Path | Where-Object {
        $_ -match "^\s*$Key\s*="
    } | Select-Object -First 1

    if (-not $line) {
        return $null
    }

    return ($line -split "=", 2)[1].Trim()
}

$backendBaseUrl = Get-EnvValue -Path $EnvFile -Key "BACKEND_BASE_URL"
$imagePath = Get-EnvValue -Path $EnvFile -Key "TEST_PRESCRIPTION_IMAGE_PATH"
$saveFile = Get-EnvValue -Path $EnvFile -Key "TEST_SAVE_FILE"

# Optional backward compatibility for automation that already uses this key.
if ([string]::IsNullOrWhiteSpace($AuthToken)) {
    $AuthToken = Get-EnvValue -Path $EnvFile -Key "TEST_AUTH_BEARER_TOKEN"
}

if ([string]::IsNullOrWhiteSpace($backendBaseUrl)) {
    $backendBaseUrl = "http://127.0.0.1:8000"
}

if ([string]::IsNullOrWhiteSpace($saveFile)) {
    $saveFile = "false"
}

if ([string]::IsNullOrWhiteSpace($AuthToken) -or $AuthToken -eq "replace-with-valid-jwt-token") {
    $secureToken = Read-Host "Paste Supabase access token (JWT)" -AsSecureString
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
    try {
        $AuthToken = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    } finally {
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
}

if ([string]::IsNullOrWhiteSpace($AuthToken)) {
    throw "Auth token is required. Pass -AuthToken or paste it when prompted."
}

if ([string]::IsNullOrWhiteSpace($imagePath)) {
    throw "Set TEST_PRESCRIPTION_IMAGE_PATH in $EnvFile before running this script."
}

if (-not (Test-Path $imagePath)) {
    throw "Prescription image not found: $imagePath"
}

$uri = "$($backendBaseUrl.TrimEnd('/'))/upload/prescription/extract"

$headers = @{
    Authorization = "Bearer $AuthToken"
}

Write-Host "Calling: $uri"
Write-Host "Image: $imagePath"
Write-Host "Save file: $saveFile"

$curlOutput = curl.exe `
    -sS `
    -X POST "$uri" `
    -H "Authorization: Bearer $AuthToken" `
    -F "save_file=$saveFile" `
    -F "file=@$imagePath"

if ($LASTEXITCODE -ne 0) {
    throw "curl request failed with exit code $LASTEXITCODE"
}

$curlOutput
