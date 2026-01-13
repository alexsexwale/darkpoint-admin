'use client';

import { useEffect, useState } from 'react';
import { 
  HiOutlineRefresh,
  HiOutlineTrendingUp,
  HiOutlineTrendingDown,
  HiOutlineCalendar,
} from 'react-icons/hi';
import { 
  Card, 
  CardHeader, 
  CardTitle,
  CardDescription,
  Button, 
  Select,
} from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import type { RevenueDataPoint, DashboardStats } from '@/types';

const DATE_RANGE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '7', label: 'Last 7 Days' },
  { value: '14', label: 'Last 14 Days' },
  { value: '30', label: 'Last 30 Days' },
  { value: '90', label: 'Last 90 Days' },
];

const COLORS = ['#e08821', '#39a228', '#2953b1', '#7c34a8', '#c82e2e'];

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState('30');
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueDataPoint[]>([]);
  const [ordersByStatus, setOrdersByStatus] = useState<Array<{ name: string; value: number }>>([]);
  const [topProducts, setTopProducts] = useState<Array<{ name: string; sales: number; revenue: number }>>([]);
  const [memberGrowth, setMemberGrowth] = useState<Array<{ date: string; count: number }>>([]);

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      const days = parseInt(dateRange);
      const startDate = startOfDay(subDays(new Date(), days)).toISOString();
      const endDate = endOfDay(new Date()).toISOString();

      // Fetch revenue by date
      const { data: revenueResult } = await supabase
        .rpc('get_revenue_by_date', { days_back: days });

      if (revenueResult) {
        setRevenueData(revenueResult.map((r: any) => ({
          date: format(new Date(r.date), 'MMM d'),
          revenue: Number(r.revenue) || 0,
          orders: Number(r.orders) || 0,
        })));
      } else {
        // Fallback: manual calculation
        const { data: orders } = await supabase
          .from('orders')
          .select('created_at, total, payment_status')
          .gte('created_at', startDate)
          .lte('created_at', endDate);

        if (orders) {
          const grouped = orders.reduce((acc, order) => {
            const date = format(new Date(order.created_at), 'yyyy-MM-dd');
            if (!acc[date]) {
              acc[date] = { revenue: 0, orders: 0 };
            }
            acc[date].orders++;
            if (order.payment_status === 'paid') {
              acc[date].revenue += order.total || 0;
            }
            return acc;
          }, {} as Record<string, { revenue: number; orders: number }>);

          const chartData = Object.entries(grouped)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([date, data]) => ({
              date: format(new Date(date), 'MMM d'),
              revenue: data.revenue,
              orders: data.orders,
            }));
          setRevenueData(chartData);
        }
      }

      // Fetch orders by status
      const { data: ordersData } = await supabase
        .from('orders')
        .select('status')
        .gte('created_at', startDate);

      if (ordersData) {
        const statusCounts = ordersData.reduce((acc, order) => {
          acc[order.status] = (acc[order.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        setOrdersByStatus(
          Object.entries(statusCounts).map(([name, value]) => ({ name, value }))
        );
      }

      // Fetch top products
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('product_name, quantity, total_price')
        .gte('created_at', startDate);

      if (orderItems) {
        const productStats = orderItems.reduce((acc, item) => {
          if (!acc[item.product_name]) {
            acc[item.product_name] = { sales: 0, revenue: 0 };
          }
          acc[item.product_name].sales += item.quantity;
          acc[item.product_name].revenue += item.total_price;
          return acc;
        }, {} as Record<string, { sales: number; revenue: number }>);

        const sorted = Object.entries(productStats)
          .map(([name, data]) => ({ name: name.slice(0, 30), ...data }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 10);
        setTopProducts(sorted);
      }

      // Fetch member growth
      const { data: members } = await supabase
        .from('user_profiles')
        .select('created_at')
        .gte('created_at', startDate);

      if (members) {
        const grouped = members.reduce((acc, member) => {
          const date = format(new Date(member.created_at), 'yyyy-MM-dd');
          acc[date] = (acc[date] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        let cumulative = 0;
        const growthData = Object.entries(grouped)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([date, count]) => {
            cumulative += count;
            return {
              date: format(new Date(date), 'MMM d'),
              count: cumulative,
            };
          });
        setMemberGrowth(growthData);
      }

      // Fetch overall stats
      const { data: statsData } = await supabase.rpc('get_admin_dashboard_stats');
      if (statsData && statsData[0]) {
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
    } catch (err) {
      console.error('Analytics error:', err);
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

  const periodRevenue = revenueData.reduce((sum, d) => sum + d.revenue, 0);
  const periodOrders = revenueData.reduce((sum, d) => sum + d.orders, 0);
  const avgOrderValue = periodOrders > 0 ? periodRevenue / periodOrders : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl text-gray-1 tracking-wider">Analytics</h1>
          <p className="text-gray-5 text-sm mt-1">
            Track store performance and trends
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            options={DATE_RANGE_OPTIONS}
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
          />
          <Button variant="secondary" onClick={fetchAnalytics} leftIcon={<HiOutlineRefresh className="w-4 h-4" />}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-main-1/20 to-amber-500/20 border-main-1/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-5">Period Revenue</p>
              <p className="text-2xl font-heading text-gray-1">{formatCurrency(periodRevenue)}</p>
            </div>
            <HiOutlineTrendingUp className="w-8 h-8 text-main-1" />
          </div>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-green-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-5">Period Orders</p>
              <p className="text-2xl font-heading text-gray-1">{periodOrders}</p>
            </div>
            <HiOutlineCalendar className="w-8 h-8 text-green-400" />
          </div>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border-blue-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-5">Avg Order Value</p>
              <p className="text-2xl font-heading text-gray-1">{formatCurrency(avgOrderValue)}</p>
            </div>
            <HiOutlineTrendingUp className="w-8 h-8 text-blue-400" />
          </div>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500/20 to-violet-500/20 border-purple-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-5">New Members</p>
              <p className="text-2xl font-heading text-gray-1">{memberGrowth.length > 0 ? memberGrowth[memberGrowth.length - 1]?.count || 0 : 0}</p>
            </div>
            <HiOutlineTrendingUp className="w-8 h-8 text-purple-400" />
          </div>
        </Card>
      </div>

      {/* Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Over Time</CardTitle>
          <CardDescription>Daily revenue for the selected period</CardDescription>
        </CardHeader>
        <div className="h-80">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-main-1 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : revenueData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-5">
              No revenue data for this period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                <XAxis 
                  dataKey="date" 
                  stroke="#888888" 
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis 
                  stroke="#888888" 
                  fontSize={12}
                  tickLine={false}
                  tickFormatter={(value) => `R${value}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#161616',
                    border: '1px solid #262626',
                    borderRadius: '8px',
                    color: '#fafafa',
                  }}
                  formatter={(value) => [formatCurrency(value as number), 'Revenue']}
                />
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#e08821" 
                  strokeWidth={2}
                  dot={{ fill: '#e08821', strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: '#e08821' }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Orders by Status */}
        <Card>
          <CardHeader>
            <CardTitle>Orders by Status</CardTitle>
          </CardHeader>
          <div className="h-64">
            {ordersByStatus.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-5">
                No order data
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={ordersByStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {ordersByStatus.map((entry, index) => (
                      <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#161616',
                      border: '1px solid #262626',
                      borderRadius: '8px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-4 mt-4">
            {ordersByStatus.map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="text-sm text-gray-5 capitalize">
                  {entry.name}: {entry.value}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Top Products */}
        <Card>
          <CardHeader>
            <CardTitle>Top Products</CardTitle>
            <CardDescription>By revenue</CardDescription>
          </CardHeader>
          <div className="h-64">
            {topProducts.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-5">
                No product data
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProducts.slice(0, 5)} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#262626" horizontal={false} />
                  <XAxis 
                    type="number" 
                    stroke="#888888" 
                    fontSize={12}
                    tickFormatter={(value) => `R${value}`}
                  />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    stroke="#888888" 
                    fontSize={11}
                    width={100}
                    tick={{ fill: '#888888' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#161616',
                      border: '1px solid #262626',
                      borderRadius: '8px',
                    }}
                    formatter={(value) => [formatCurrency(value as number), 'Revenue']}
                  />
                  <Bar dataKey="revenue" fill="#e08821" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* Member Growth */}
      <Card>
        <CardHeader>
          <CardTitle>Member Growth</CardTitle>
          <CardDescription>Cumulative new members over time</CardDescription>
        </CardHeader>
        <div className="h-64">
          {memberGrowth.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-5">
              No member growth data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={memberGrowth} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                <XAxis dataKey="date" stroke="#888888" fontSize={12} />
                <YAxis stroke="#888888" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#161616',
                    border: '1px solid #262626',
                    borderRadius: '8px',
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#39a228" 
                  strokeWidth={2}
                  dot={{ fill: '#39a228', strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>
    </div>
  );
}

