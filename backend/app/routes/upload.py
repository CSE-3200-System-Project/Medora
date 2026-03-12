from fastapi import APIRouter, UploadFile, File, HTTPException
from app.core.config import settings
from supabase import create_client, Client
import uuid

router = APIRouter()

# Initialize Supabase client
supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10MB
ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
}

@router.post("/")
async def upload_file(file: UploadFile = File(...)):
    try:
        if not file.filename:
            raise HTTPException(status_code=400, detail="Invalid file name")

        if file.content_type and file.content_type not in ALLOWED_CONTENT_TYPES:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {file.content_type}")

        # Generate a unique filename
        file_ext = file.filename.split(".")[-1]
        file_name = f"{uuid.uuid4()}.{file_ext}"
        
        # Read file content with hard size bound.
        chunks = []
        total_read = 0
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            total_read += len(chunk)
            if total_read > MAX_UPLOAD_BYTES:
                raise HTTPException(status_code=413, detail="File too large. Maximum size is 10MB.")
            chunks.append(chunk)

        file_content = b"".join(chunks)
        if not file_content:
            raise HTTPException(status_code=400, detail="Empty file")
        
        # Upload to Supabase Storage
        # Assuming a bucket named 'uploads' exists. 
        # If not, you might need to create it in Supabase dashboard.
        bucket_name = "medora-storage"
        
        res = supabase.storage.from_(bucket_name).upload(
            path=file_name,
            file=file_content,
            file_options={"content-type": file.content_type}
        )
        
        # Get public URL
        public_url = supabase.storage.from_(bucket_name).get_public_url(file_name)
        
        return {"url": public_url}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File upload failed: {str(e)}")
