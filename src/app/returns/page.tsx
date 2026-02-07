'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  HiOutlineSearch,
  HiOutlineFilter,
  HiOutlineRefresh,
  HiOutlineEye,
} from 'react-icons/hi';
import {
  Card,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Select,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty,
  TableSkeleton,
  ReturnStatusBadge,
} from '@/components/ui';
import { Pagination } from '@/components/ui/Pagination';
import { format } from 'date-fns';
import type { ReturnRequest } from '@/types';

const RETURN_STATUSES: Array<{ value: string; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'in_transit', label: 'In transit' },
  { value: 'received', label: 'Received' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function ReturnsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [returnsList, setReturnsList] = useState<ReturnRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const fetchReturns = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (statusFilter) params.set('status', statusFilter);
      if (searchQuery) params.set('q', searchQuery);

      const res = await fetch(`/api/returns?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to fetch returns');
      }
      const json = await res.json();
      setReturnsList(json.data || []);
      setTotalCount(json.count ?? 0);
    } catch (err) {
      console.error('Returns fetch error:', err);
      setReturnsList([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, statusFilter, searchQuery]);

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (statusFilter) params.set('status', statusFilter);
    const newUrl = params.toString() ? `?${params.toString()}` : '/returns';
    router.replace(newUrl, { scroll: false });
  }, [searchQuery, statusFilter, router]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchReturns();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl md:text-2xl text-gray-1 tracking-wider">Returns</h1>
          <p className="text-gray-5 text-xs md:text-sm mt-1">
            View and manage return requests
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => fetchReturns()}
          leftIcon={<HiOutlineRefresh className="w-4 h-4" />}
          size="sm"
        >
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>

      <Card padding="sm" className="md:p-4">
        <form onSubmit={handleSearch} className="space-y-3">
          <div className="w-full">
            <Input
              placeholder="Search by return #, email, or order #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<HiOutlineSearch className="w-4 h-4" />}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex-1 min-w-[140px]">
              <Select
                options={RETURN_STATUSES}
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <Button type="submit" leftIcon={<HiOutlineFilter className="w-4 h-4" />} className="flex-shrink-0">
              <span className="hidden sm:inline">Filter</span>
            </Button>
          </div>
        </form>
      </Card>

      <Card padding="none">
        <CardHeader className="px-6 py-4 border-b border-dark-4">
          <CardTitle>
            {totalCount} Return{totalCount !== 1 ? 's' : ''}
          </CardTitle>
        </CardHeader>

        <Table>
          <TableHeader>
            <TableRow hover={false}>
              <TableHead>Return #</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead align="right">Refund</TableHead>
              <TableHead>Date</TableHead>
              <TableHead align="center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeleton rows={10} colSpan={7} />
            ) : returnsList.length === 0 ? (
              <TableEmpty
                colSpan={7}
                message="No returns found"
                description="Try adjusting your filters"
              />
            ) : (
              returnsList.map((r) => {
                const raw = r as ReturnRequest & { orders?: { order_number?: string; shipping_name?: string } | { order_number?: string; shipping_name?: string }[] };
                const order = Array.isArray(raw.orders) ? raw.orders[0] : raw.orders;
                return (
                  <TableRow
                    key={r.id}
                    onClick={() => router.push(`/returns/${r.id}`)}
                  >
                    <TableCell>
                      <span className="font-medium text-main-1">{r.return_number}</span>
                    </TableCell>
                    <TableCell>
                      {order?.order_number ? (
                        <span className="text-gray-1">#{order.order_number}</span>
                      ) : (
                        <span className="text-gray-5">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-gray-1">{order?.shipping_name || r.email}</p>
                        <p className="text-xs text-gray-5">{r.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <ReturnStatusBadge status={r.status} />
                    </TableCell>
                    <TableCell align="right">
                      <span className="font-medium text-gray-1">
                        {formatCurrency(Number(r.total_refund_amount) || 0)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-gray-5 text-sm">
                        {format(new Date(r.created_at), 'MMM d, HH:mm')}
                      </span>
                    </TableCell>
                    <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                      <Link href={`/returns/${r.id}`}>
                        <Button variant="ghost" size="sm">
                          <HiOutlineEye className="w-4 h-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        <div className="border-t border-dark-4">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalCount}
            itemsPerPage={pageSize}
            onPageChange={(newPage) => setPage(newPage)}
            onItemsPerPageChange={(newSize) => {
              setPageSize(newSize);
              setPage(1);
            }}
          />
        </div>
      </Card>
    </div>
  );
}
