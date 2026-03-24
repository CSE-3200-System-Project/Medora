param(
    [Parameter(Mandatory = $true)]
    [string]$ResourceGroup,
    [Parameter(Mandatory = $true)]
    [string]$Location,
    [Parameter(Mandatory = $true)]
    [string]$ContainerEnvName,
    [Parameter(Mandatory = $true)]
    [string]$ContainerAppName,
    [Parameter(Mandatory = $true)]
    [string]$AcrName,
    [string]$ImageTag = "latest",
    [string]$ModelType = "read",
    [bool]$DisableMedicineMatching = $true
)

$ErrorActionPreference = "Stop"

function Require-Env([string]$name) {
    $value = [Environment]::GetEnvironmentVariable($name)
    if ([string]::IsNullOrWhiteSpace($value)) {
        throw "Missing required environment variable: $name"
    }
    return $value
}

$azureOcrEndpoint = Require-Env "AZURE_OCR_ENDPOINT"
$azureOcrKey = Require-Env "AZURE_OCR_KEY"

$supabaseUrl = [Environment]::GetEnvironmentVariable("SUPABASE_URL")
$supabaseServiceRoleKey = [Environment]::GetEnvironmentVariable("SUPABASE_SERVICE_ROLE_KEY")

Write-Host "Creating resource group if needed..."
az group create --name $ResourceGroup --location $Location | Out-Null

Write-Host "Ensuring Azure Container Registry exists..."
$acrExists = az acr show --name $AcrName --resource-group $ResourceGroup --query "name" -o tsv 2>$null
if (-not $acrExists) {
    az acr create --name $AcrName --resource-group $ResourceGroup --sku Basic --admin-enabled true | Out-Null
}

$acrLoginServer = az acr show --name $AcrName --resource-group $ResourceGroup --query "loginServer" -o tsv
$fullImage = "$acrLoginServer/$ContainerAppName`:$ImageTag"
$serviceRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

Write-Host "Building image in ACR: $fullImage"
az acr build --registry $AcrName --image "$ContainerAppName`:$ImageTag" --file "$serviceRoot\Dockerfile" "$serviceRoot" --no-logs

Write-Host "Ensuring Container Apps environment exists..."
$envExists = az containerapp env show --name $ContainerEnvName --resource-group $ResourceGroup --query "name" -o tsv 2>$null
if (-not $envExists) {
    az containerapp env create --name $ContainerEnvName --resource-group $ResourceGroup --location $Location | Out-Null
}

$acrUsername = az acr credential show --name $AcrName --query "username" -o tsv
$acrPassword = az acr credential show --name $AcrName --query "passwords[0].value" -o tsv

$appExists = az containerapp show --name $ContainerAppName --resource-group $ResourceGroup --query "name" -o tsv 2>$null

if (-not $appExists) {
    Write-Host "Creating Container App..."
    az containerapp create `
        --name $ContainerAppName `
        --resource-group $ResourceGroup `
        --environment $ContainerEnvName `
        --image $fullImage `
        --target-port 8001 `
        --ingress external `
        --registry-server $acrLoginServer `
        --registry-username $acrUsername `
        --registry-password $acrPassword `
        --cpu 1.0 `
        --memory 2.0Gi `
        --min-replicas 0 `
        --max-replicas 3 `
        --env-vars `
            MODEL_TYPE=$ModelType `
            DISABLE_MEDICINE_MATCHING=$($DisableMedicineMatching.ToString().ToLower()) `
            AZURE_OCR_ENDPOINT=$azureOcrEndpoint `
            YOLO_MODEL_PATH="models/Yolo26s/Yolo26s-prescription-5.onnx" | Out-Null
}
else {
    Write-Host "Updating Container App image..."
    az containerapp update `
        --name $ContainerAppName `
        --resource-group $ResourceGroup `
        --image $fullImage `
        --set-env-vars `
            MODEL_TYPE=$ModelType `
            DISABLE_MEDICINE_MATCHING=$($DisableMedicineMatching.ToString().ToLower()) `
            AZURE_OCR_ENDPOINT=$azureOcrEndpoint `
            YOLO_MODEL_PATH="models/Yolo26s/Yolo26s-prescription-5.onnx" | Out-Null
}

Write-Host "Setting secrets..."
$secretArgs = @(
    "azure-ocr-key=$azureOcrKey"
)
if (-not [string]::IsNullOrWhiteSpace($supabaseServiceRoleKey)) {
    $secretArgs += "supabase-service-role-key=$supabaseServiceRoleKey"
}

az containerapp secret set --name $ContainerAppName --resource-group $ResourceGroup --secrets $secretArgs | Out-Null

$envVarsWithSecrets = @(
    "AZURE_OCR_KEY=secretref:azure-ocr-key"
)
if (-not [string]::IsNullOrWhiteSpace($supabaseUrl)) {
    $envVarsWithSecrets += "SUPABASE_URL=$supabaseUrl"
}
if (-not [string]::IsNullOrWhiteSpace($supabaseServiceRoleKey)) {
    $envVarsWithSecrets += "SUPABASE_SERVICE_ROLE_KEY=secretref:supabase-service-role-key"
}

az containerapp update --name $ContainerAppName --resource-group $ResourceGroup --set-env-vars $envVarsWithSecrets | Out-Null

$fqdn = az containerapp show --name $ContainerAppName --resource-group $ResourceGroup --query "properties.configuration.ingress.fqdn" -o tsv
$url = "https://$fqdn"

Write-Host "Deployment complete."
Write-Host "Service URL: $url"
Write-Host "Health check: $url/health"
