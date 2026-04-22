import { useMemo, useState } from "react";

export type PaginationState<T> = {
  pageItems: T[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  setPage: (page: number) => void;
  goToPrevPage: () => void;
  goToNextPage: () => void;
};

export function usePagination<T>(
  items: T[],
  pageSize: number = 8,
): PaginationState<T> {
  const [currentPage, setCurrentPage] = useState(1);
  const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : 1;
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const clampedPage = Math.min(Math.max(1, currentPage), totalPages);

  const setPage = (page: number) => {
    const next = Math.min(Math.max(1, Math.floor(page || 1)), totalPages);
    setCurrentPage(next);
  };

  const goToPrevPage = () => {
    setCurrentPage((page) => Math.max(1, page - 1));
  };

  const goToNextPage = () => {
    setCurrentPage((page) => Math.min(totalPages, page + 1));
  };

  const pageItems = useMemo(() => {
    const start = (clampedPage - 1) * safePageSize;
    return items.slice(start, start + safePageSize);
  }, [items, clampedPage, safePageSize]);

  const startIndex = totalItems === 0 ? 0 : (clampedPage - 1) * safePageSize + 1;
  const endIndex = totalItems === 0 ? 0 : Math.min(totalItems, startIndex + pageItems.length - 1);

  return {
    pageItems,
    currentPage: clampedPage,
    totalPages,
    totalItems,
    startIndex,
    endIndex,
    hasPrevPage: clampedPage > 1,
    hasNextPage: clampedPage < totalPages,
    setPage,
    goToPrevPage,
    goToNextPage,
  };
}
