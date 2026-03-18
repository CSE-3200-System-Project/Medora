import base64
import json
from supabase import Client, create_client

from app.core.config import settings


def _normalize_supabase_url(url: str) -> str:
    return url.rstrip("/")


def _decode_supabase_key_role(key: str | None) -> str | None:
    if not key or key.count(".") != 2:
        return None

    try:
        payload = key.split(".")[1]
        padding = "=" * (-len(payload) % 4)
        data = base64.urlsafe_b64decode(payload + padding).decode("utf-8")
        return json.loads(data).get("role")
    except Exception:
        return None


supabase: Client = create_client(_normalize_supabase_url(settings.SUPABASE_URL), settings.SUPABASE_KEY)

_storage_key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_KEY
storage_supabase: Client = create_client(_normalize_supabase_url(settings.SUPABASE_URL), _storage_key)
storage_key_role = _decode_supabase_key_role(_storage_key)
