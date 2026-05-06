export type PaginationInput = {
  totalItems: number;
  pageSize: number;
  currentPage: number;
};

export type PaginationState = {
  currentPage: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
  startItem: number;
  endItem: number;
};

export function getPagination({ totalItems, pageSize, currentPage }: PaginationInput): PaginationState {
  const safePageSize = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = totalItems === 0 ? 0 : (safePage - 1) * safePageSize;
  const endIndex = totalItems === 0 ? 0 : Math.min(startIndex + safePageSize, totalItems);

  return {
    currentPage: safePage,
    totalPages,
    startIndex,
    endIndex,
    startItem: totalItems === 0 ? 0 : startIndex + 1,
    endItem: endIndex
  };
}
