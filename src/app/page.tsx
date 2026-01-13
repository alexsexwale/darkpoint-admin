'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  HiOutlineCurrencyDollar,
  HiOutlineShoppingCart,
  HiOutlineUsers,
  HiOutlineClock,
  HiOutlineArrowRight,
  HiOutlineTrendingUp,
  HiOutlineTrendingDown,
  HiOutlineUserCircle,
} from 'react-icons/hi';
import { Card, CardHeader, CardTitle, Badge, OrderStatusBadge } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import type { Order, DashboardStats } from '@/types';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: { value: number; isPositive: boolean };
  subtitle?: string;
  color: 'orange' | 'green' | 'blue' | 'purple';
}

function StatCard({ title, value, icon: Icon, trend, subtitle, color }: StatCardProps) {
  const colorClasses = {
    orange: 'from-main-1/20 to-amber-500/20 border-main-1/30',
    green: 'from-green-500/20 to-emerald-500/20 border-green-500/30',
    blue: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30',
    purple: 'from-purple-500/20 to-violet-500/20 border-purple-500/30',
  };

  const iconColors = {
    orange: 'text-main-1',
    green: 'text-green-400',
    blue: 'text-blue-400',
    purple: 'text-purple-400',
  };

  return (
    <Card className={`bg-gradient-to-br ${colorClasses[color]} border hover:shadow-lg transition-all`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs md:text-sm text-gray-5 mb-1">{title}</p>
          <p className="text-xl md:text-2xl font-heading text-gray-1 tracking-wide truncate">{value}</p>
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              {trend.isPositive ? (
                <HiOutlineTrendingUp className="w-4 h-4 text-green-400 flex-shrink-0" />
              ) : (
                <HiOutlineTrendingDown className="w-4 h-4 text-red-400 flex-shrink-0" />
              )}
              <span className={`text-xs ${trend.isPositive ? 'text-green-400' : 'text-red-400'} truncate`}>
                {trend.value}% from last period
              </span>
            </div>
          )}
          {subtitle && (
            <p className="text-xs text-gray-5 mt-2 truncate">{subtitle}</p>
          )}
        </div>
        <div className={`p-2 md:p-3 rounded-lg bg-dark-2/50 ${iconColors[color]} flex-shrink-0`}>
          <Icon className="w-5 h-5 md:w-6 md:h-6" />
        </div>
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch dashboard stats using the helper function
      const { data: statsData, error: statsError } = await supabase
        .rpc('get_admin_dashboard_stats');

      if (statsError) {
        console.error('Error fetching stats:', statsError);
        // Fallback to manual calculation if function doesn't exist
        await fetchStatsFallback();
      } else if (statsData && statsData[0]) {
        // Also fetch unique customer count
        const { count: customerCount } = await supabase
          .from('orders')
          .select('billing_email', { count: 'exact', head: true })
          .not('billing_email', 'is', null);
        
        setStats({
          totalRevenue: Number(statsData[0].total_revenue) || 0,
          totalOrders: Number(statsData[0].total_orders) || 0,
          totalMembers: Number(statsData[0].total_members) || 0,
          totalCustomers: customerCount || 0,
          pendingOrders: Number(statsData[0].pending_orders) || 0,
          todayRevenue: Number(statsData[0].today_revenue) || 0,
          todayOrders: Number(statsData[0].today_orders) || 0,
          weekRevenue: Number(statsData[0].week_revenue) || 0,
          weekOrders: Number(statsData[0].week_orders) || 0,
          monthRevenue: Number(statsData[0].month_revenue) || 0,
          monthOrders: Number(statsData[0].month_orders) || 0,
        });
      }

      // Fetch recent orders
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (*)
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      if (ordersError) {
        console.error('Error fetching orders:', ordersError);
      } else {
        setRecentOrders(ordersData || []);
      }
    } catch (err) {
      console.error('Dashboard error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStatsFallback = async () => {
    // Manual stats calculation if RPC function not available
    const [ordersResult, membersResult] = await Promise.all([
      supabase.from('orders').select('*'),
      supabase.from('user_profiles').select('id', { count: 'exact' }),
    ]);

    const orders = ordersResult.data || [];
    const totalMembers = membersResult.count || 0;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const paidOrders = orders.filter(o => o.payment_status === 'paid');
    const pendingOrders = orders.filter(o => o.status === 'pending');
    
    // Count unique customers by billing email
    const uniqueEmails = new Set(orders.map(o => o.billing_email).filter(Boolean));
    const totalCustomers = uniqueEmails.size;

    setStats({
      totalRevenue: paidOrders.reduce((sum, o) => sum + (o.total || 0), 0),
      totalOrders: orders.length,
      totalMembers,
      totalCustomers,
      pendingOrders: pendingOrders.length,
      todayRevenue: paidOrders
        .filter(o => new Date(o.created_at) >= today)
        .reduce((sum, o) => sum + (o.total || 0), 0),
      todayOrders: orders.filter(o => new Date(o.created_at) >= today).length,
      weekRevenue: paidOrders
        .filter(o => new Date(o.created_at) >= weekAgo)
        .reduce((sum, o) => sum + (o.total || 0), 0),
      weekOrders: orders.filter(o => new Date(o.created_at) >= weekAgo).length,
      monthRevenue: paidOrders
        .filter(o => new Date(o.created_at) >= monthAgo)
        .reduce((sum, o) => sum + (o.total || 0), 0),
      monthOrders: orders.filter(o => new Date(o.created_at) >= monthAgo).length,
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 w-48 bg-dark-3 rounded animate-pulse" />
            <div className="h-4 w-32 bg-dark-3 rounded animate-pulse mt-2" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-32 bg-dark-2 border border-dark-4 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-xl md:text-2xl text-gray-1 tracking-wider">Dashboard</h1>
          <p className="text-gray-5 text-xs md:text-sm mt-1">
            Welcome back! Here&apos;s what&apos;s happening with your store.
          </p>
        </div>
        <Link
          href="/orders"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-main-1 text-white rounded-lg hover:bg-main-1/90 transition-colors text-sm w-full sm:w-auto"
        >
          View Orders
          <HiOutlineArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
        <StatCard
          title="Total Revenue"
          value={formatCurrency(stats?.totalRevenue || 0)}
          icon={HiOutlineCurrencyDollar}
          subtitle={`${formatCurrency(stats?.monthRevenue || 0)} this month`}
          color="orange"
        />
        <StatCard
          title="Total Orders"
          value={stats?.totalOrders || 0}
          icon={HiOutlineShoppingCart}
          subtitle={`${stats?.monthOrders || 0} this month`}
          color="green"
        />
        <StatCard
          title="Customers"
          value={stats?.totalCustomers || 0}
          icon={HiOutlineUserCircle}
          subtitle="Unique buyers"
          color="blue"
        />
        <StatCard
          title="Members"
          value={stats?.totalMembers || 0}
          icon={HiOutlineUsers}
          subtitle="Registered accounts"
          color="purple"
        />
        <StatCard
          title="Pending"
          value={stats?.pendingOrders || 0}
          icon={HiOutlineClock}
          subtitle="Requires attention"
          color="orange"
        />
      </div>

      {/* Today's Stats */}
      <div className="grid grid-cols-3 gap-3 md:gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm md:text-base">Today</CardTitle>
          </CardHeader>
          <div>
            <p className="text-lg md:text-3xl font-heading text-main-1 truncate">{formatCurrency(stats?.todayRevenue || 0)}</p>
            <p className="text-xs md:text-sm text-gray-5 mt-1">{stats?.todayOrders || 0} orders</p>
          </div>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm md:text-base">This Week</CardTitle>
          </CardHeader>
          <div>
            <p className="text-lg md:text-3xl font-heading text-green-400 truncate">{formatCurrency(stats?.weekRevenue || 0)}</p>
            <p className="text-xs md:text-sm text-gray-5 mt-1">{stats?.weekOrders || 0} orders</p>
          </div>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm md:text-base">This Month</CardTitle>
          </CardHeader>
          <div>
            <p className="text-lg md:text-3xl font-heading text-blue-400 truncate">{formatCurrency(stats?.monthRevenue || 0)}</p>
            <p className="text-xs md:text-sm text-gray-5 mt-1">{stats?.monthOrders || 0} orders</p>
          </div>
        </Card>
      </div>

      {/* Recent Orders */}
      <Card>
        <CardHeader 
          action={
            <Link href="/orders" className="text-sm text-main-1 hover:text-main-1/80 transition-colors">
              View All →
            </Link>
          }
        >
          <CardTitle>Recent Orders</CardTitle>
        </CardHeader>
        
        {recentOrders.length === 0 ? (
          <div className="text-center py-8">
            <HiOutlineShoppingCart className="w-12 h-12 text-gray-5 mx-auto mb-3" />
            <p className="text-gray-5">No orders yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-4">
                  <th className="text-left py-3 px-4 text-xs font-heading uppercase tracking-wider text-gray-5">Order</th>
                  <th className="text-left py-3 px-4 text-xs font-heading uppercase tracking-wider text-gray-5">Customer</th>
                  <th className="text-left py-3 px-4 text-xs font-heading uppercase tracking-wider text-gray-5">Status</th>
                  <th className="text-left py-3 px-4 text-xs font-heading uppercase tracking-wider text-gray-5">Total</th>
                  <th className="text-left py-3 px-4 text-xs font-heading uppercase tracking-wider text-gray-5">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id} className="border-b border-dark-4 last:border-b-0 hover:bg-dark-3 transition-colors">
                    <td className="py-3 px-4">
                      <Link href={`/orders/${order.id}`} className="text-main-1 hover:underline font-medium">
                        #{order.order_number}
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-gray-1">{order.shipping_name || order.billing_name || 'Guest'}</p>
                      <p className="text-xs text-gray-5">{order.billing_email}</p>
                    </td>
                    <td className="py-3 px-4">
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td className="py-3 px-4 text-gray-1">
                      {formatCurrency(order.total)}
                    </td>
                    <td className="py-3 px-4 text-gray-5 text-sm">
                      {format(new Date(order.created_at), 'MMM d, HH:mm')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
        <Link href="/orders?status=pending" className="group">
          <Card hover className="h-full">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 rounded-lg group-hover:bg-amber-500/30 transition-colors">
                <HiOutlineClock className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="font-medium text-gray-1 text-sm">Process Orders</p>
                <p className="text-xs text-gray-5">{stats?.pendingOrders || 0} pending</p>
              </div>
            </div>
          </Card>
        </Link>
        
        <Link href="/customers" className="group">
          <Card hover className="h-full">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-500/20 rounded-lg group-hover:bg-cyan-500/30 transition-colors">
                <HiOutlineUserCircle className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <p className="font-medium text-gray-1 text-sm">Customers</p>
                <p className="text-xs text-gray-5">{stats?.totalCustomers || 0} buyers</p>
              </div>
            </div>
          </Card>
        </Link>
        
        <Link href="/products" className="group">
          <Card hover className="h-full">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg group-hover:bg-blue-500/30 transition-colors">
                <HiOutlineShoppingCart className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="font-medium text-gray-1 text-sm">Products</p>
                <p className="text-xs text-gray-5">Add or edit</p>
              </div>
            </div>
          </Card>
        </Link>
        
        <Link href="/members" className="group">
          <Card hover className="h-full">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg group-hover:bg-green-500/30 transition-colors">
                <HiOutlineUsers className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="font-medium text-gray-1 text-sm">Members</p>
                <p className="text-xs text-gray-5">{stats?.totalMembers || 0} registered</p>
              </div>
            </div>
          </Card>
        </Link>
        
        <Link href="/analytics" className="group">
          <Card hover className="h-full">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg group-hover:bg-purple-500/30 transition-colors">
                <HiOutlineTrendingUp className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="font-medium text-gray-1 text-sm">Analytics</p>
                <p className="text-xs text-gray-5">View reports</p>
              </div>
            </div>
          </Card>
        </Link>
      </div>
    </div>
  );
}
