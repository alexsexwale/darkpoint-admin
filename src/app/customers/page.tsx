'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  HiOutlineSearch,
  HiOutlineRefresh,
  HiOutlineDownload,
  HiOutlineMail,
  HiOutlinePhone,
  HiOutlineLocationMarker,
  HiOutlineShoppingCart,
  HiOutlineCurrencyDollar,
  HiOutlineCalendar,
  HiOutlineUserCircle,
  HiOutlineChevronRight,
  HiOutlineSortAscending,
  HiOutlineSortDescending,
} from 'react-icons/hi';
import { 
  Card, 
  CardHeader, 
  CardTitle,
  Button, 
  Input,
  Select,
  Badge,
} from '@/components/ui';
import { Pagination } from '@/components/ui/Pagination';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import type { Customer, Order } from '@/types';

type SortField = 'totalSpent' | 'totalOrders' | 'lastOrderDate' | 'name';
type SortOrder = 'asc' | 'desc';

export default function CustomersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [sortField, setSortField] = useState<SortField>('totalSpent');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const fetchCustomers = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch all orders to aggregate customer data
      const { data: ordersData, error } = await supabase
        .from('orders')
        .select('*')
        .not('billing_email', 'is', null)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching orders:', error);
        return;
      }

      // Aggregate orders by customer email
      const customerMap = new Map<string, Customer>();

      // Exclude orders that are both pending (status) and pending (payment)
      const isPendingUnpaid = (o: Order) => o.status === 'pending' && o.payment_status === 'pending';

      (ordersData || []).forEach((order: Order) => {
        if (isPendingUnpaid(order)) return;
        const email = order.billing_email;
        if (!email) return;

        if (!customerMap.has(email)) {
          customerMap.set(email, {
            email,
            name: order.shipping_name || order.billing_name || 'Guest',
            phone: order.shipping_phone || order.billing_phone || null,
            city: order.shipping_city || order.billing_city || null,
            country: order.shipping_country || order.billing_country || null,
            totalOrders: 0,
            totalSpent: 0,
            firstOrderDate: order.created_at,
            lastOrderDate: order.created_at,
            avgOrderValue: 0,
          });
        }

        const customer = customerMap.get(email)!;
        customer.totalOrders += 1;
        customer.totalSpent += order.total || 0;

        // Track first and last order dates
        if (new Date(order.created_at) < new Date(customer.firstOrderDate)) {
          customer.firstOrderDate = order.created_at;
        }
        if (new Date(order.created_at) > new Date(customer.lastOrderDate)) {
          customer.lastOrderDate = order.created_at;
          // Update name/phone/city with most recent order info
          customer.name = order.shipping_name || order.billing_name || customer.name;
          customer.phone = order.shipping_phone || order.billing_phone || customer.phone;
          customer.city = order.shipping_city || order.billing_city || customer.city;
          customer.country = order.shipping_country || order.billing_country || customer.country;
        }
      });

      // Calculate average order value
      customerMap.forEach(customer => {
        customer.avgOrderValue = customer.totalOrders > 0 
          ? customer.totalSpent / customer.totalOrders 
          : 0;
      });

      setCustomers(Array.from(customerMap.values()));
    } catch (err) {
      console.error('Customers fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  // Filter and sort customers
  const { filteredCustomers, totalFiltered, paginatedCustomers, totalPages } = useMemo(() => {
    let result = [...customers];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(c => 
        c.email.toLowerCase().includes(query) ||
        c.name.toLowerCase().includes(query) ||
        c.city?.toLowerCase().includes(query) ||
        c.phone?.includes(query)
      );
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'totalSpent':
          comparison = a.totalSpent - b.totalSpent;
          break;
        case 'totalOrders':
          comparison = a.totalOrders - b.totalOrders;
          break;
        case 'lastOrderDate':
          comparison = new Date(a.lastOrderDate).getTime() - new Date(b.lastOrderDate).getTime();
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    const totalFiltered = result.length;
    const totalPages = Math.ceil(totalFiltered / pageSize);
    const startIndex = (page - 1) * pageSize;
    const paginatedCustomers = result.slice(startIndex, startIndex + pageSize);

    return { filteredCustomers: result, totalFiltered, paginatedCustomers, totalPages };
  }, [customers, searchQuery, sortField, sortOrder, page, pageSize]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const exportCustomers = () => {
    const headers = ['Email', 'Name', 'Phone', 'City', 'Country', 'Total Orders', 'Total Spent', 'Avg Order', 'First Order', 'Last Order'];
    const rows = filteredCustomers.map(c => [
      c.email,
      c.name,
      c.phone || '',
      c.city || '',
      c.country || '',
      c.totalOrders,
      c.totalSpent,
      c.avgOrderValue.toFixed(2),
      format(new Date(c.firstOrderDate), 'yyyy-MM-dd'),
      format(new Date(c.lastOrderDate), 'yyyy-MM-dd'),
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customers-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Stats
  const totalRevenue = customers.reduce((sum, c) => sum + c.totalSpent, 0);
  const avgOrderValue = customers.length > 0 
    ? customers.reduce((sum, c) => sum + c.avgOrderValue, 0) / customers.length 
    : 0;
  const repeatCustomers = customers.filter(c => c.totalOrders > 1).length;

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl md:text-2xl text-gray-1 tracking-wider">Customers</h1>
          <p className="text-gray-5 text-xs md:text-sm mt-1">
            {filteredCustomers.length} unique customers from your orders
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={fetchCustomers} leftIcon={<HiOutlineRefresh className="w-4 h-4" />} size="sm">
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button variant="secondary" onClick={exportCustomers} leftIcon={<HiOutlineDownload className="w-4 h-4" />} size="sm">
            <span className="hidden sm:inline">Export</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <HiOutlineUserCircle className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-1">{customers.length}</p>
              <p className="text-xs text-gray-5">Total Customers</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <HiOutlineCurrencyDollar className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-1">{formatCurrency(totalRevenue)}</p>
              <p className="text-xs text-gray-5">Total Revenue</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <HiOutlineShoppingCart className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-1">{formatCurrency(avgOrderValue)}</p>
              <p className="text-xs text-gray-5">Avg Order Value</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-main-1/10 flex items-center justify-center">
              <HiOutlineRefresh className="w-5 h-5 text-main-1" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-1">{repeatCustomers}</p>
              <p className="text-xs text-gray-5">Repeat Customers</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card padding="sm" className="md:p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              placeholder="Search by email, name, phone, or city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<HiOutlineSearch className="w-4 h-4" />}
            />
          </div>
          <Select
            options={[
              { value: 'totalSpent', label: 'Sort by: Total Spent' },
              { value: 'totalOrders', label: 'Sort by: Total Orders' },
              { value: 'lastOrderDate', label: 'Sort by: Last Order' },
              { value: 'name', label: 'Sort by: Name' },
            ]}
            value={sortField}
            onChange={(e) => setSortField(e.target.value as SortField)}
            className="w-full sm:w-48"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="flex-shrink-0"
          >
            {sortOrder === 'desc' ? (
              <HiOutlineSortDescending className="w-5 h-5" />
            ) : (
              <HiOutlineSortAscending className="w-5 h-5" />
            )}
          </Button>
        </div>
      </Card>

      {/* Customers List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-24 bg-dark-2 border border-dark-4 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : totalFiltered === 0 ? (
        <Card className="p-12 text-center">
          <HiOutlineUserCircle className="w-16 h-16 text-gray-5 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-1 mb-2">
            {searchQuery ? 'No customers found' : 'No customers yet'}
          </h3>
          <p className="text-gray-5 text-sm">
            {searchQuery 
              ? 'Try adjusting your search query' 
              : 'Customers will appear here once orders are placed'}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {paginatedCustomers.map((customer) => (
            <Link 
              key={customer.email} 
              href={`/customers/${encodeURIComponent(customer.email)}`}
            >
              <Card hover className="p-4 transition-all">
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-main-1/20 to-amber-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-lg font-bold text-main-1">
                      {customer.name.charAt(0).toUpperCase()}
                    </span>
                  </div>

                  {/* Customer Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-gray-1 truncate">{customer.name}</h3>
                      {customer.totalOrders > 1 && (
                        <Badge variant="success" className="text-xs flex-shrink-0">
                          Repeat
                        </Badge>
                      )}
                      {customer.totalOrders >= 5 && (
                        <Badge variant="warning" className="text-xs flex-shrink-0">
                          VIP
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-5">
                      <span className="flex items-center gap-1">
                        <HiOutlineMail className="w-4 h-4" />
                        <span className="truncate max-w-[200px]">{customer.email}</span>
                      </span>
                      {customer.city && (
                        <span className="flex items-center gap-1 hidden sm:flex">
                          <HiOutlineLocationMarker className="w-4 h-4" />
                          {customer.city}, {customer.country}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="hidden md:flex items-center gap-6 flex-shrink-0">
                    <div className="text-center">
                      <p className="text-lg font-bold text-gray-1">{customer.totalOrders}</p>
                      <p className="text-xs text-gray-5">Orders</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-green-400">{formatCurrency(customer.totalSpent)}</p>
                      <p className="text-xs text-gray-5">Total Spent</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-1">{format(new Date(customer.lastOrderDate), 'MMM d')}</p>
                      <p className="text-xs text-gray-5">Last Order</p>
                    </div>
                  </div>

                  {/* Mobile Stats */}
                  <div className="flex md:hidden items-center gap-4 flex-shrink-0">
                    <div className="text-right">
                      <p className="font-bold text-green-400">{formatCurrency(customer.totalSpent)}</p>
                      <p className="text-xs text-gray-5">{customer.totalOrders} orders</p>
                    </div>
                  </div>

                  {/* Arrow */}
                  <HiOutlineChevronRight className="w-5 h-5 text-gray-5 flex-shrink-0 hidden sm:block" />
                </div>
              </Card>
            </Link>
          ))}

          {/* Pagination */}
          <Card padding="none" className="mt-4">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={totalFiltered}
              itemsPerPage={pageSize}
              onPageChange={(newPage) => setPage(newPage)}
              onItemsPerPageChange={(newSize) => {
                setPageSize(newSize);
                setPage(1);
              }}
            />
          </Card>
        </div>
      )}
    </div>
  );
}

