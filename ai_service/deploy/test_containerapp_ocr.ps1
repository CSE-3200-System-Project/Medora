param(
    [Parameter(Mandatory = $true)]
    [string]$ServiceBaseUrl,
    [Parameter(Mandatory = $true)]
    [string]$ImagePath,
    [bool]$Debug = $true
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $ImagePath)) {
    throw "Image not found: $ImagePath"
}

$base = $ServiceBaseUrl.TrimEnd("/")
$healthUrl = "$base/health"
$ocrUrl = "$base/ocr/prescription?debug=$($Debug.ToString().ToLower())"
$resolvedImage = Resolve-Path $ImagePath

Write-Host "Checking health: $healthUrl"
$health = Invoke-RestMethod -Method GET -Uri $healthUrl
$health | ConvertTo-Json -Depth 6

Write-Host "Calling OCR: $ocrUrl"
$response = & curl.exe -sS -X POST "$ocrUrl" -F "file=@$resolvedImage"

try {
    $json = $response | ConvertFrom-Json
    $json | ConvertTo-Json -Depth 30
}
catch {
    Write-Host "Raw response:"
    Write-Output $response
    throw "Response was not valid JSON."
}
