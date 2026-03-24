param(
    [string]$Host = "0.0.0.0",
    [int]$Port = 8001,
    [string]$ModelType = "read",
    [bool]$DisableMedicineMatching = $true
)

$ErrorActionPreference = "Stop"

$env:MODEL_TYPE = $ModelType
$env:DISABLE_MEDICINE_MATCHING = $DisableMedicineMatching.ToString().ToLower()

Write-Host "Starting AI OCR service on http://$Host`:$Port"
Write-Host "MODEL_TYPE=$($env:MODEL_TYPE)"
Write-Host "DISABLE_MEDICINE_MATCHING=$($env:DISABLE_MEDICINE_MATCHING)"

$serviceRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $serviceRoot
try {
    uvicorn app.main:app --host $Host --port $Port --reload
}
finally {
    Pop-Location
}
