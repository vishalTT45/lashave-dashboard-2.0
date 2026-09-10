'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

export const TABLE_PAGE_SIZE = 8;

export function getPageItems<T>(items: T[], page: number, pageSize = TABLE_PAGE_SIZE) {
  const safePage = Math.max(1, page);
  const start = (safePage - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export function getTotalPages(totalItems: number, pageSize = TABLE_PAGE_SIZE) {
  return Math.max(1, Math.ceil(totalItems / pageSize));
}

export function TablePagination({
  page,
  totalItems,
  onPageChange,
  pageSize = TABLE_PAGE_SIZE,
}: {
  page: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
}) {
  const totalPages = getTotalPages(totalItems, pageSize);
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const pages = Array.from({ length: Math.min(3, totalPages) }, (_, index) =>
    Math.min(Math.max(currentPage - 1, 1) + index, totalPages),
  ).filter((value, index, arr) => arr.indexOf(value) === index);

  if (totalItems <= pageSize) return null;

  return (
    <div className='flex flex-col gap-3 border-t border-gray-100 px-5 py-4 dark:border-white/5 sm:flex-row sm:items-center sm:justify-between'>
      <p className='type-small text-gray-500 dark:text-gray-400'>
        Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalItems)} of {totalItems}
      </p>
      <div className='flex items-center'>
        <button
          type='button'
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className='mr-2.5 flex h-10 items-center justify-center gap-2 rounded-(--radius-control) border border-gray-300 bg-white px-3.5 py-2 type-small text-gray-700 shadow-theme-xs hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/3'
        >
          <ChevronLeft className='h-4 w-4' />
          Previous
        </button>
        <div className='flex items-center gap-2'>
          {pages.map((item) => (
            <button
              key={item}
              type='button'
              onClick={() => onPageChange(item)}
              className={`flex h-10 w-10 items-center justify-center rounded-(--radius-control) type-small font-medium ${
                currentPage === item
                  ? 'bg-brand-500 text-white'
                  : 'text-gray-700 hover:bg-blue-500/8 hover:text-brand-500 dark:text-gray-400 dark:hover:text-brand-500'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
        <button
          type='button'
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className='ml-2.5 flex h-10 items-center justify-center gap-2 rounded-(--radius-control) border border-gray-300 bg-white px-3.5 py-2 type-small text-gray-700 shadow-theme-xs hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/3'
        >
          Next
          <ChevronRight className='h-4 w-4' />
        </button>
      </div>
    </div>
  );
}
