'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  HiOutlineSearch,
  HiOutlineFilter,
  HiOutlineDownload,
  HiOutlineRefresh,
  HiOutlineEye,
  HiOutlineTruck,
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
  OrderStatusBadge,
  PaymentStatusBadge,
} from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import type { Order, OrderStatus } from '@/types';

const ORDER_STATUSES: Array<{ value: string; label: string }> = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'refunded', label: 'Refunded' },
];

const PAYMENT_STATUSES: Array<{ value: string; label: string }> = [
  { value: '', label: 'All Payments' },
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'failed', label: 'Failed' },
  { value: 'refunded', label: 'Refunded' },
];

export default function OrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [paymentFilter, setPaymentFilter] = useState(searchParams.get('payment') || '');
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('orders')
        .select(`
          *,
          order_items (*),
          cj_orders (*)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      // Apply filters
      if (statusFilter) {
        query = query.eq('status', statusFilter as OrderStatus);
      }
      if (paymentFilter) {
        query = query.eq('payment_status', paymentFilter);
      }
      if (searchQuery) {
        query = query.or(`order_number.ilike.%${searchQuery}%,shipping_name.ilike.%${searchQuery}%,billing_email.ilike.%${searchQuery}%`);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error('Error fetching orders:', error);
      } else {
        setOrders(data || []);
        setTotalCount(count || 0);
      }
    } catch (err) {
      console.error('Orders fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter, paymentFilter, searchQuery]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Update URL params when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (statusFilter) params.set('status', statusFilter);
    if (paymentFilter) params.set('payment', paymentFilter);
    
    const newUrl = params.toString() ? `?${params.toString()}` : '/orders';
    router.replace(newUrl, { scroll: false });
  }, [searchQuery, statusFilter, paymentFilter, router]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchOrders();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const exportOrders = () => {
    // Create CSV content
    const headers = ['Order Number', 'Customer', 'Email', 'Status', 'Payment', 'Total', 'Date'];
    const rows = orders.map(order => [
      order.order_number,
      order.shipping_name || order.billing_name || 'Guest',
      order.billing_email || '',
      order.status,
      order.payment_status,
      order.total,
      format(new Date(order.created_at), 'yyyy-MM-dd HH:mm'),
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl md:text-2xl text-gray-1 tracking-wider">Orders</h1>
          <p className="text-gray-5 text-xs md:text-sm mt-1">
            Manage and track all customer orders
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={fetchOrders} leftIcon={<HiOutlineRefresh className="w-4 h-4" />} size="sm">
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button variant="secondary" onClick={exportOrders} leftIcon={<HiOutlineDownload className="w-4 h-4" />} size="sm">
            <span className="hidden sm:inline">Export</span>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card padding="sm" className="md:p-4">
        <form onSubmit={handleSearch} className="space-y-3">
          {/* Search input */}
          <div className="w-full">
            <Input
              placeholder="Search by order #, customer, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<HiOutlineSearch className="w-4 h-4" />}
            />
          </div>
          {/* Filters row */}
          <div className="flex flex-wrap gap-2">
            <div className="flex-1 min-w-[120px]">
              <Select
                options={ORDER_STATUSES}
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="flex-1 min-w-[120px]">
              <Select
                options={PAYMENT_STATUSES}
                value={paymentFilter}
                onChange={(e) => {
                  setPaymentFilter(e.target.value);
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

      {/* Orders Table */}
      <Card padding="none">
        <CardHeader className="px-6 py-4 border-b border-dark-4">
          <CardTitle>
            {totalCount} Order{totalCount !== 1 ? 's' : ''}
          </CardTitle>
        </CardHeader>
        
        <Table>
          <TableHeader>
            <TableRow hover={false}>
              <TableHead>Order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>CJ Status</TableHead>
              <TableHead align="right">Total</TableHead>
              <TableHead>Date</TableHead>
              <TableHead align="center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeleton rows={10} colSpan={9} />
            ) : orders.length === 0 ? (
              <TableEmpty 
                colSpan={9} 
                message="No orders found"
                description="Try adjusting your filters"
              />
            ) : (
              orders.map((order) => (
                <TableRow key={order.id} onClick={() => router.push(`/orders/${order.id}`)}>
                  <TableCell>
                    <span className="font-medium text-main-1">#{order.order_number}</span>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="text-gray-1">{order.shipping_name || order.billing_name || 'Guest'}</p>
                      <p className="text-xs text-gray-5">{order.billing_email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-gray-5">
                      {order.order_items?.length || 0} item{(order.order_items?.length || 0) !== 1 ? 's' : ''}
                    </span>
                  </TableCell>
                  <TableCell>
                    <OrderStatusBadge status={order.status} />
                  </TableCell>
                  <TableCell>
                    <PaymentStatusBadge status={order.payment_status} />
                  </TableCell>
                  <TableCell>
                    {order.cj_orders && order.cj_orders.length > 0 ? (
                      <span className="text-xs text-green-400">
                        {order.cj_orders[0].cj_status || 'Placed'}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-5">Not placed</span>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <span className="font-medium text-gray-1">{formatCurrency(order.total)}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-gray-5 text-sm">
                      {format(new Date(order.created_at), 'MMM d, HH:mm')}
                    </span>
                  </TableCell>
                  <TableCell align="center">
                    <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <Link href={`/orders/${order.id}`}>
                        <Button variant="ghost" size="sm">
                          <HiOutlineEye className="w-4 h-4" />
                        </Button>
                      </Link>
                      {order.payment_status === 'paid' && order.status === 'pending' && (
                        <Button variant="ghost" size="sm" title="Place to CJ">
                          <HiOutlineTruck className="w-4 h-4 text-green-400" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-dark-4">
            <p className="text-sm text-gray-5">
              Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, totalCount)} of {totalCount}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-5 px-3">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

