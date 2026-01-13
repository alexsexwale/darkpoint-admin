'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  HiOutlineArrowLeft,
  HiOutlineMail,
  HiOutlinePhone,
  HiOutlineLocationMarker,
  HiOutlineCalendar,
  HiOutlineShoppingCart,
  HiOutlineCurrencyDollar,
  HiOutlineRefresh,
  HiOutlineExternalLink,
  HiOutlineUser,
  HiOutlineTrendingUp,
  HiOutlineChartBar,
} from 'react-icons/hi';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription,
  Button, 
  Badge,
  OrderStatusBadge,
  PaymentStatusBadge,
} from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { format, formatDistanceToNow } from 'date-fns';
import type { Order, UserProfile, Customer } from '@/types';

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const customerEmail = decodeURIComponent(params.email as string);
  
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [linkedMember, setLinkedMember] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchCustomerData();
  }, [customerEmail]);

  const fetchCustomerData = async () => {
    setIsLoading(true);
    try {
      // Fetch all orders for this email
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (*)
        `)
        .eq('billing_email', customerEmail)
        .order('created_at', { ascending: false });

      if (ordersError) {
        console.error('Error fetching orders:', ordersError);
        router.push('/customers');
        return;
      }

      if (!ordersData || ordersData.length === 0) {
        router.push('/customers');
        return;
      }

      setOrders(ordersData);

      // Build customer data from orders
      const firstOrder = ordersData[ordersData.length - 1];
      const lastOrder = ordersData[0];
      const totalSpent = ordersData.reduce((sum, o) => sum + (o.total || 0), 0);

      setCustomer({
        email: customerEmail,
        name: lastOrder.shipping_name || lastOrder.billing_name || 'Guest',
        phone: lastOrder.shipping_phone || lastOrder.billing_phone || null,
        city: lastOrder.shipping_city || lastOrder.billing_city || null,
        country: lastOrder.shipping_country || lastOrder.billing_country || null,
        totalOrders: ordersData.length,
        totalSpent,
        firstOrderDate: firstOrder.created_at,
        lastOrderDate: lastOrder.created_at,
        avgOrderValue: totalSpent / ordersData.length,
      });

      // Check if customer has a linked member account
      const { data: memberData } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('email', customerEmail)
        .single();

      if (memberData) {
        setLinkedMember(memberData);
      }
    } catch (err) {
      console.error('Customer fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-dark-3 rounded animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {[1, 2].map(i => (
              <div key={i} className="h-48 bg-dark-2 border border-dark-4 rounded-lg animate-pulse" />
            ))}
          </div>
          <div className="space-y-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-dark-2 border border-dark-4 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-5">Customer not found</p>
        <Link href="/customers" className="text-main-1 hover:underline mt-2 inline-block">
          Back to Customers
        </Link>
      </div>
    );
  }

  // Calculate additional stats
  const paidOrders = orders.filter(o => o.payment_status === 'paid');
  const pendingOrders = orders.filter(o => o.status === 'pending');
  const completedOrders = orders.filter(o => o.status === 'delivered');

  // Get most ordered products (simplified)
  const productCounts = new Map<string, { name: string; count: number; image: string | null }>();
  orders.forEach(order => {
    order.order_items?.forEach(item => {
      const key = item.product_id;
      if (!productCounts.has(key)) {
        productCounts.set(key, { name: item.product_name, count: 0, image: item.product_image });
      }
      productCounts.get(key)!.count += item.quantity;
    });
  });
  const topProducts = Array.from(productCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/customers">
            <Button variant="ghost" size="sm">
              <HiOutlineArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-main-1 to-amber-500 flex items-center justify-center">
              <span className="text-2xl font-bold text-white">
                {customer.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-heading text-xl md:text-2xl text-gray-1 tracking-wider">
                  {customer.name}
                </h1>
                {customer.totalOrders >= 5 && (
                  <Badge variant="warning">VIP Customer</Badge>
                )}
                {customer.totalOrders > 1 && customer.totalOrders < 5 && (
                  <Badge variant="success">Repeat</Badge>
                )}
              </div>
              <p className="text-gray-5 text-sm flex items-center gap-2">
                <HiOutlineMail className="w-4 h-4" />
                {customer.email}
              </p>
            </div>
          </div>
        </div>
        {linkedMember && (
          <Link href={`/members/${linkedMember.id}`}>
            <Button variant="secondary" leftIcon={<HiOutlineUser className="w-4 h-4" />}>
              View Member Profile
            </Button>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4 text-center">
              <HiOutlineShoppingCart className="w-6 h-6 text-blue-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-1">{customer.totalOrders}</p>
              <p className="text-xs text-gray-5">Total Orders</p>
            </Card>
            <Card className="p-4 text-center">
              <HiOutlineCurrencyDollar className="w-6 h-6 text-green-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-green-400">{formatCurrency(customer.totalSpent)}</p>
              <p className="text-xs text-gray-5">Total Spent</p>
            </Card>
            <Card className="p-4 text-center">
              <HiOutlineChartBar className="w-6 h-6 text-purple-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-purple-400">{formatCurrency(customer.avgOrderValue)}</p>
              <p className="text-xs text-gray-5">Avg Order</p>
            </Card>
            <Card className="p-4 text-center">
              <HiOutlineCalendar className="w-6 h-6 text-main-1 mx-auto mb-2" />
              <p className="text-lg font-bold text-gray-1">
                {formatDistanceToNow(new Date(customer.firstOrderDate), { addSuffix: false })}
              </p>
              <p className="text-xs text-gray-5">Customer For</p>
            </Card>
          </div>

          {/* Order History */}
          <Card>
            <CardHeader>
              <CardTitle>Order History</CardTitle>
              <CardDescription>{orders.length} orders total</CardDescription>
            </CardHeader>
            
            <div className="divide-y divide-dark-4">
              {orders.map((order) => (
                <Link 
                  key={order.id} 
                  href={`/orders/${order.id}`}
                  className="flex items-center justify-between p-4 hover:bg-dark-3/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="hidden sm:flex flex-col items-center justify-center w-12 h-12 bg-dark-3 rounded-lg">
                      <span className="text-xs font-bold text-gray-1">
                        {format(new Date(order.created_at), 'MMM')}
                      </span>
                      <span className="text-lg font-bold text-main-1">
                        {format(new Date(order.created_at), 'd')}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-main-1">#{order.order_number}</p>
                      <p className="text-sm text-gray-5">
                        {order.order_items?.length || 0} items • {format(new Date(order.created_at), 'HH:mm')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                      <OrderStatusBadge status={order.status} />
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-1">{formatCurrency(order.total)}</p>
                      <PaymentStatusBadge status={order.payment_status} />
                    </div>
                    <HiOutlineExternalLink className="w-4 h-4 text-gray-5" />
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Contact Info */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <HiOutlineMail className="w-5 h-5 text-gray-5 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-5">Email</p>
                  <a href={`mailto:${customer.email}`} className="text-main-1 hover:underline break-all">
                    {customer.email}
                  </a>
                </div>
              </div>
              {customer.phone && (
                <div className="flex items-start gap-3">
                  <HiOutlinePhone className="w-5 h-5 text-gray-5 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-5">Phone</p>
                    <a href={`tel:${customer.phone}`} className="text-gray-1 hover:text-main-1">
                      {customer.phone}
                    </a>
                  </div>
                </div>
              )}
              {customer.city && (
                <div className="flex items-start gap-3">
                  <HiOutlineLocationMarker className="w-5 h-5 text-gray-5 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-5">Location</p>
                    <p className="text-gray-1">{customer.city}, {customer.country}</p>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Linked Member */}
          {linkedMember && (
            <Card>
              <CardHeader>
                <CardTitle>Linked Member Account</CardTitle>
              </CardHeader>
              <Link 
                href={`/members/${linkedMember.id}`}
                className="flex items-center gap-3 p-3 bg-dark-3/50 rounded-lg hover:bg-dark-3 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
                  <HiOutlineUser className="w-5 h-5 text-green-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-1">
                    {linkedMember.display_name || linkedMember.username || 'Member'}
                  </p>
                  <p className="text-xs text-gray-5">
                    Level {linkedMember.current_level} • {linkedMember.total_xp.toLocaleString()} XP
                  </p>
                </div>
                <HiOutlineExternalLink className="w-4 h-4 text-gray-5" />
              </Link>
            </Card>
          )}

          {/* Order Status Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Order Status</CardTitle>
            </CardHeader>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-5">Pending</span>
                <Badge variant="warning">{pendingOrders.length}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-5">Paid</span>
                <Badge variant="success">{paidOrders.length}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-5">Delivered</span>
                <Badge variant="info">{completedOrders.length}</Badge>
              </div>
            </div>
          </Card>

          {/* Top Products */}
          {topProducts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Frequently Ordered</CardTitle>
              </CardHeader>
              <div className="space-y-3">
                {topProducts.map((product, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-dark-3 rounded-lg overflow-hidden flex-shrink-0">
                      {product.image ? (
                        <img 
                          src={product.image} 
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-5 text-xs">
                          <HiOutlineShoppingCart className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-1 truncate">{product.name}</p>
                      <p className="text-xs text-gray-5">{product.count}x ordered</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Timeline</CardTitle>
            </CardHeader>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 mt-2 rounded-full bg-main-1" />
                <div>
                  <p className="text-gray-1 text-sm">First Order</p>
                  <p className="text-gray-5 text-xs">
                    {format(new Date(customer.firstOrderDate), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 mt-2 rounded-full bg-green-400" />
                <div>
                  <p className="text-gray-1 text-sm">Last Order</p>
                  <p className="text-gray-5 text-xs">
                    {format(new Date(customer.lastOrderDate), 'MMM d, yyyy')} ({formatDistanceToNow(new Date(customer.lastOrderDate), { addSuffix: true })})
                  </p>
                </div>
              </div>
              {linkedMember && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 mt-2 rounded-full bg-blue-400" />
                  <div>
                    <p className="text-gray-1 text-sm">Registered Account</p>
                    <p className="text-gray-5 text-xs">
                      {format(new Date(linkedMember.created_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

