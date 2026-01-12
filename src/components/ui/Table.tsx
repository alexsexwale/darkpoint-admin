'use client';

import clsx from 'clsx';

interface TableProps {
  children: React.ReactNode;
  className?: string;
}

export function Table({ children, className }: TableProps) {
  return (
    <div className={clsx('overflow-x-auto rounded-lg border border-dark-4', className)}>
      <table className="w-full">
        {children}
      </table>
    </div>
  );
}

interface TableHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function TableHeader({ children, className }: TableHeaderProps) {
  return (
    <thead className={clsx('bg-dark-3', className)}>
      {children}
    </thead>
  );
}

interface TableBodyProps {
  children: React.ReactNode;
  className?: string;
}

export function TableBody({ children, className }: TableBodyProps) {
  return (
    <tbody className={clsx('bg-dark-2', className)}>
      {children}
    </tbody>
  );
}

interface TableRowProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
}

export function TableRow({ children, className, onClick, hover = true }: TableRowProps) {
  return (
    <tr 
      className={clsx(
        'border-b border-dark-4 last:border-b-0 transition-colors',
        hover && 'hover:bg-dark-3',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}

interface TableHeadProps {
  children: React.ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  sorted?: 'asc' | 'desc' | false;
  onSort?: () => void;
}

export function TableHead({ 
  children, 
  className, 
  align = 'left',
  sortable = false,
  sorted = false,
  onSort,
}: TableHeadProps) {
  const alignClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  return (
    <th 
      className={clsx(
        'px-4 py-3 font-heading font-normal text-xs uppercase tracking-widest text-gray-5',
        alignClasses[align],
        sortable && 'cursor-pointer hover:text-gray-1 select-none',
        className
      )}
      onClick={sortable ? onSort : undefined}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sortable && sorted && (
          <span className="text-main-1">
            {sorted === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </span>
    </th>
  );
}

interface TableCellProps {
  children: React.ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right';
}

export function TableCell({ children, className, align = 'left' }: TableCellProps) {
  const alignClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  return (
    <td className={clsx('px-4 py-3 text-sm', alignClasses[align], className)}>
      {children}
    </td>
  );
}

// Empty state for tables
interface TableEmptyProps {
  message?: string;
  description?: string;
  colSpan: number;
}

export function TableEmpty({ message = 'No data found', description, colSpan }: TableEmptyProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12 text-center">
        <p className="text-gray-5">{message}</p>
        {description && <p className="text-sm text-gray-5/60 mt-1">{description}</p>}
      </td>
    </tr>
  );
}

// Loading skeleton for tables
interface TableSkeletonProps {
  rows?: number;
  colSpan: number;
}

export function TableSkeleton({ rows = 5, colSpan }: TableSkeletonProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-b border-dark-4 last:border-b-0">
          <td colSpan={colSpan} className="px-4 py-3">
            <div className="h-4 bg-dark-4 rounded animate-pulse" />
          </td>
        </tr>
      ))}
    </>
  );
}

