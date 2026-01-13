'use client';

import { HiOutlineChevronLeft, HiOutlineChevronRight, HiOutlineChevronDoubleLeft, HiOutlineChevronDoubleRight } from 'react-icons/hi';
import clsx from 'clsx';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange?: (itemsPerPage: number) => void;
  showItemsPerPage?: boolean;
  itemsPerPageOptions?: number[];
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  showItemsPerPage = true,
  itemsPerPageOptions = [10, 25, 50, 100],
}: PaginationProps) {
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages + 2) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      
      if (currentPage > 3) {
        pages.push('...');
      }
      
      // Show pages around current page
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      
      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) {
          pages.push(i);
        }
      }
      
      if (currentPage < totalPages - 2) {
        pages.push('...');
      }
      
      // Always show last page
      if (!pages.includes(totalPages)) {
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  if (totalPages <= 1 && !showItemsPerPage) {
    return null;
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-2">
      {/* Items info and per page selector */}
      <div className="flex items-center gap-4 text-sm text-gray-5">
        <span>
          Showing <span className="font-medium text-gray-3">{startItem}</span> to{' '}
          <span className="font-medium text-gray-3">{endItem}</span> of{' '}
          <span className="font-medium text-gray-3">{totalItems}</span> results
        </span>
        
        {showItemsPerPage && onItemsPerPageChange && (
          <div className="flex items-center gap-2">
            <span>Show:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
              className="bg-dark-3 border border-dark-4 rounded px-2 py-1 text-gray-3 focus:border-main-1 focus:outline-none cursor-pointer"
            >
              {itemsPerPageOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          {/* First page */}
          <button
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            className={clsx(
              'p-2 rounded-lg transition-colors',
              currentPage === 1
                ? 'text-gray-6 cursor-not-allowed'
                : 'text-gray-3 hover:bg-dark-3 hover:text-gray-1'
            )}
            title="First page"
          >
            <HiOutlineChevronDoubleLeft className="w-4 h-4" />
          </button>

          {/* Previous page */}
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className={clsx(
              'p-2 rounded-lg transition-colors',
              currentPage === 1
                ? 'text-gray-6 cursor-not-allowed'
                : 'text-gray-3 hover:bg-dark-3 hover:text-gray-1'
            )}
            title="Previous page"
          >
            <HiOutlineChevronLeft className="w-4 h-4" />
          </button>

          {/* Page numbers */}
          <div className="flex items-center gap-1 mx-2">
            {getPageNumbers().map((page, index) => (
              typeof page === 'number' ? (
                <button
                  key={index}
                  onClick={() => onPageChange(page)}
                  className={clsx(
                    'min-w-[36px] h-9 px-3 rounded-lg text-sm font-medium transition-colors',
                    currentPage === page
                      ? 'bg-main-1 text-white'
                      : 'text-gray-3 hover:bg-dark-3 hover:text-gray-1'
                  )}
                >
                  {page}
                </button>
              ) : (
                <span key={index} className="px-2 text-gray-5">
                  {page}
                </span>
              )
            ))}
          </div>

          {/* Next page */}
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className={clsx(
              'p-2 rounded-lg transition-colors',
              currentPage === totalPages
                ? 'text-gray-6 cursor-not-allowed'
                : 'text-gray-3 hover:bg-dark-3 hover:text-gray-1'
            )}
            title="Next page"
          >
            <HiOutlineChevronRight className="w-4 h-4" />
          </button>

          {/* Last page */}
          <button
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
            className={clsx(
              'p-2 rounded-lg transition-colors',
              currentPage === totalPages
                ? 'text-gray-6 cursor-not-allowed'
                : 'text-gray-3 hover:bg-dark-3 hover:text-gray-1'
            )}
            title="Last page"
          >
            <HiOutlineChevronDoubleRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

