# Medora AI OCR Service

## API Contract

### Endpoint

`POST /ocr/prescription`

Accepts:

- `multipart/form-data` with `file`
- `multipart/form-data` with `image_url`
- `application/json` with `image_url` or base64 `image_file`

Optional query:

- `debug=true` to include all YOLO regions and OCR lines in response.

### Response (stable black-box output)

```json
{
  "medications": [
    {
      "name": "Carbizole",
      "dosage": "5 mg",
      "frequency": "1+0+1",
      "quantity": "10 days",
      "confidence": 0.92
    }
  ],
  "raw_text": "full OCR text",
  "meta": {
    "model": "azure_prebuilt-read",
    "model_type": "read",
    "processing_time_ms": 320,
    "detected_regions": 3,
    "ocr_line_count": 18
  },
  "debug": {
    "detected_regions": [],
    "ocr_lines": [],
    "medicine_db_enabled": false,
    "medicine_candidates_loaded": 0
  }
}
```

## Local Test (No Medicine DB)

1. Install deps:

```powershell
cd ai_service
pip install -r requirements.txt
```

2. Start service with medicine matching disabled:

```powershell
.\scripts\run_local.ps1 -DisableMedicineMatching $true
```

3. Test with one prescription image and get full debug output:

```powershell
.\scripts\test_local_ocr.ps1 -ImagePath "C:\path\to\prescription.jpg" -Debug $true
```

## Azure Container Apps Deploy

1. Ensure local env has required variables before deploy script:

- `AZURE_OCR_ENDPOINT`
- `AZURE_OCR_KEY`
- Optional: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

2. Deploy:

```powershell
cd ai_service
.\deploy\deploy_containerapp.ps1 `
  -ResourceGroup "rg-medora-ai" `
  -Location "southeastasia" `
  -ContainerEnvName "cae-medora-ai" `
  -ContainerAppName "ocr-service" `
  -AcrName "medoraaiacr" `
  -ModelType "read" `
  -DisableMedicineMatching $true
```

3. Validate cloud behavior with same debug shape:

```powershell
.\deploy\test_containerapp_ocr.ps1 `
  -ServiceBaseUrl "https://<your-fqdn>" `
  -ImagePath "C:\path\to\prescription.jpg" `
  -Debug $true
```

## Key Env Flags

- `MODEL_TYPE=read|custom|llm`
- `YOLO_MODEL_PATH=models/Yolo26s/Yolo26s-prescription-5.onnx`
- `DISABLE_MEDICINE_MATCHING=true|false`
- `SUPABASE_DATABASE_URL` (required for DB-level trigram matching)
- `MEDICINE_DB_TABLE` (default `medicine_search_index`)
- `MEDICINE_DB_COLUMN` (default `term`)
- `MEDICINE_MATCH_TOP_K` (default `3`)
- `MEDICINE_MATCH_MIN_CONFIDENCE` (default `0.5`)
