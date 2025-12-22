from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from app.core.config import settings
from supabase import create_client, Client
import uuid
import os

router = APIRouter()

# Initialize Supabase client
supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

@router.post("/")
async def upload_file(file: UploadFile = File(...)):
    try:
        # Generate a unique filename
        file_ext = file.filename.split(".")[-1]
        file_name = f"{uuid.uuid4()}.{file_ext}"
        
        # Read file content
        file_content = await file.read()
        
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
        
    except Exception as e:
        print(f"Upload error: {e}")
        raise HTTPException(status_code=500, detail=f"File upload failed: {str(e)}")
