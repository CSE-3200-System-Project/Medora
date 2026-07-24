"""
Shared pagination utilities for FastAPI collection endpoints.

Canonical contract:
  Query params: limit (int, ge=1, default 20) + offset (int, ge=0, default 0).
  Aliases:      page (1-indexed) + size → resolved to limit=size, offset=(page-1)*size.
  Response:     { items, total, limit, offset, has_more, page, page_size }
"""
from __future__ import annotations

from typing import Any, Generic, List, Optional, Sequence, TypeVar

from fastapi import Query
from pydantic import BaseModel, computed_field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

T = TypeVar("T")


class PaginationParams:
    """
    FastAPI dependency that resolves limit/offset (canonical) or page/size (aliases).
    Inject as: params: PaginationParams = Depends(pagination_params())
    """

    def __init__(
        self,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
        page: Optional[int] = None,
        size: Optional[int] = None,
        _default_limit: int = 20,
        _max_limit: int = 100,
    ):
        if limit is not None or offset is not None:
            # Canonical form takes precedence
            self.limit = max(1, min(limit if limit is not None else _default_limit, _max_limit))
            self.offset = max(0, offset if offset is not None else 0)
        elif page is not None or size is not None:
            # Alias form
            _page = max(1, page if page is not None else 1)
            _size = max(1, min(size if size is not None else _default_limit, _max_limit))
            self.limit = _size
            self.offset = (_page - 1) * _size
        else:
            self.limit = _default_limit
            self.offset = 0


def pagination_params(default_limit: int = 20, max_limit: int = 100):
    """
    Factory that returns a FastAPI Depends-able callable with per-route defaults.

    Usage:
        @router.get("/")
        async def list_items(
            params: PaginationParams = Depends(pagination_params(default_limit=20, max_limit=100)),
        ):
    """

    def dependency(
        limit: Optional[int] = Query(None, ge=1, le=max_limit, description="Number of results to return"),
        offset: Optional[int] = Query(None, ge=0, description="Number of results to skip"),
        page: Optional[int] = Query(None, ge=1, description="1-indexed page number (alias for offset/limit)"),
        size: Optional[int] = Query(None, ge=1, le=max_limit, description="Page size (alias for limit)"),
    ) -> PaginationParams:
        return PaginationParams(
            limit=limit,
            offset=offset,
            page=page,
            size=size,
            _default_limit=default_limit,
            _max_limit=max_limit,
        )

    return dependency


class Page(BaseModel, Generic[T]):
    """Unified paginated response envelope."""

    items: List[T]
    total: int
    limit: int
    offset: int

    @computed_field
    @property
    def has_more(self) -> bool:
        return self.offset + len(self.items) < self.total

    @computed_field
    @property
    def page(self) -> int:
        if self.limit == 0:
            return 1
        return (self.offset // self.limit) + 1

    @computed_field
    @property
    def page_size(self) -> int:
        return self.limit

    @computed_field
    @property
    def total_pages(self) -> int:
        if self.limit == 0:
            return 1
        import math
        return max(1, math.ceil(self.total / self.limit))

    model_config = {"from_attributes": True}


def make_page(items: Sequence[Any], total: int, params: PaginationParams) -> dict:
    """
    Build the standard Page envelope dict (for constructing domain-specific response
    schemas that embed these fields alongside extra fields like unread_count).
    """
    return {
        "items": list(items),
        "total": total,
        "limit": params.limit,
        "offset": params.offset,
        "has_more": params.offset + len(items) < total,
        "page": (params.offset // params.limit) + 1 if params.limit > 0 else 1,
        "page_size": params.limit,
    }
