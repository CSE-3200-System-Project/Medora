"use client";

import { useCallback, useState } from "react";

export interface ServerPaginationState {
  currentPage: number;
  limit: number;
  offset: number;
  totalPages: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  setPage: (page: number) => void;
  goToPrevPage: () => void;
  goToNextPage: () => void;
  /** Call after a fetch completes to update derived state. */
  setTotal: (total: number) => void;
}

/**
 * Hook for server-side paginated lists using limit/offset.
 * Drives the existing PaginationControls component.
 *
 * Usage:
 *   const pagination = useServerPagination({ pageSize: 20 });
 *   // pass pagination.limit + pagination.offset to your server action
 *   // call pagination.setTotal(data.total) after fetch
 */
export function useServerPagination({
  pageSize = 20,
  initialPage = 1,
}: {
  pageSize?: number;
  initialPage?: number;
} = {}): ServerPaginationState {
  const [currentPage, setCurrentPage] = useState(Math.max(1, initialPage));
  const [totalItems, setTotalItems] = useState(0);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const clampedPage = Math.min(Math.max(1, currentPage), totalPages);
  const offset = (clampedPage - 1) * pageSize;

  const setPage = useCallback(
    (page: number) => {
      setCurrentPage(Math.min(Math.max(1, Math.floor(page)), Math.max(1, totalPages)));
    },
    [totalPages]
  );

  const goToPrevPage = useCallback(() => {
    setCurrentPage((p) => Math.max(1, p - 1));
  }, []);

  const goToNextPage = useCallback(() => {
    setCurrentPage((p) => Math.min(totalPages, p + 1));
  }, [totalPages]);

  const setTotal = useCallback((total: number) => {
    setTotalItems(total);
  }, []);

  const startIndex = totalItems === 0 ? 0 : offset + 1;
  const endIndex = totalItems === 0 ? 0 : Math.min(totalItems, offset + pageSize);

  return {
    currentPage: clampedPage,
    limit: pageSize,
    offset,
    totalPages,
    totalItems,
    startIndex,
    endIndex,
    hasPrevPage: clampedPage > 1,
    hasNextPage: clampedPage < totalPages,
    setPage,
    goToPrevPage,
    goToNextPage,
    setTotal,
  };
}
