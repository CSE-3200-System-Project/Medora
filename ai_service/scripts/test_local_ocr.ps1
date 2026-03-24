param(
    [Parameter(Mandatory = $true)]
    [string]$ImagePath,
    [string]$BaseUrl = "http://127.0.0.1:8001",
    [bool]$Debug = $true
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $ImagePath)) {
    throw "Image not found: $ImagePath"
}

$health = Invoke-RestMethod -Method GET -Uri "$($BaseUrl.TrimEnd('/'))/health"
Write-Host "Service health:" ($health | ConvertTo-Json -Depth 6)

$uri = "$($BaseUrl.TrimEnd('/'))/ocr/prescription?debug=$($Debug.ToString().ToLower())"
Write-Host "Calling: $uri"

$resolvedImage = Resolve-Path $ImagePath
$response = & curl.exe -sS -X POST "$uri" -F "file=@$resolvedImage"

try {
    $json = $response | ConvertFrom-Json
    $json | ConvertTo-Json -Depth 30
}
catch {
    Write-Host "Raw response:"
    Write-Output $response
    throw "Response was not valid JSON."
}
