from __future__ import annotations

import hashlib
import json
from typing import Any

from fastapi import Request, Response
from fastapi.responses import Response as FastAPIResponse


def build_etag(payload: Any) -> str:
    serialized = json.dumps(
        payload,
        ensure_ascii=True,
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    ).encode("utf-8")
    digest = hashlib.blake2b(serialized, digest_size=16).hexdigest()
    return f'W/"{digest}"'


def is_not_modified(request: Request, etag: str) -> bool:
    return request.headers.get("if-none-match") == etag


def set_cache_headers(
    response: Response,
    *,
    etag: str,
    max_age_seconds: int,
    stale_while_revalidate_seconds: int = 0,
    is_private: bool = True,
) -> None:
    cache_scope = "private" if is_private else "public"
    directives = [cache_scope, f"max-age={max_age_seconds}"]
    if stale_while_revalidate_seconds > 0:
        directives.append(f"stale-while-revalidate={stale_while_revalidate_seconds}")

    response.headers["Cache-Control"] = ", ".join(directives)
    response.headers["ETag"] = etag


def not_modified_response(response: Response) -> FastAPIResponse:
    return FastAPIResponse(
        status_code=304,
        headers={
            "Cache-Control": response.headers.get("Cache-Control", "private, max-age=0"),
            "ETag": response.headers.get("ETag", ""),
        },
    )
