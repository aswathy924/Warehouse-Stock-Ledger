import React from 'react';

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (newPage: number) => void;
  onPageSizeChange: (newSize: number) => void;
  pageSizeOptions?: number[];
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [25, 50, 100, -1],
}) => {
  const isAll = pageSize === -1;
  const totalPages = isAll ? 1 : Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(currentPage, 1), totalPages);

  const startRecord = totalItems === 0 ? 0 : isAll ? 1 : (safePage - 1) * pageSize + 1;
  const endRecord = isAll ? totalItems : Math.min(safePage * pageSize, totalItems);

  return (
    <div className="pagination-bar">
      <div className="pagination-info">
        <span>
          Showing <strong>{startRecord}</strong>–<strong>{endRecord}</strong> of{' '}
          <strong>{totalItems}</strong> records
        </span>

        <div className="pagination-pagesize">
          <label htmlFor="page-size-select">Rows per page:</label>
          <select
            id="page-size-select"
            className="select-input select-sm"
            value={pageSize}
            onChange={(e) => {
              onPageChange(1);
              onPageSizeChange(Number(e.target.value));
            }}
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt === -1 ? 'All' : opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!isAll && totalPages > 1 && (
        <div className="pagination-nav">
          <button
            className="btn btn-sm"
            onClick={() => onPageChange(1)}
            disabled={safePage <= 1}
            title="First page"
          >
            « First
          </button>
          <button
            className="btn btn-sm"
            onClick={() => onPageChange(safePage - 1)}
            disabled={safePage <= 1}
            title="Previous page"
          >
            ‹ Prev
          </button>

          <span className="pagination-current">
            Page <strong>{safePage}</strong> of <strong>{totalPages}</strong>
          </span>

          <button
            className="btn btn-sm"
            onClick={() => onPageChange(safePage + 1)}
            disabled={safePage >= totalPages}
            title="Next page"
          >
            Next ›
          </button>
          <button
            className="btn btn-sm"
            onClick={() => onPageChange(totalPages)}
            disabled={safePage >= totalPages}
            title="Last page"
          >
            Last »
          </button>
        </div>
      )}
    </div>
  );
};
