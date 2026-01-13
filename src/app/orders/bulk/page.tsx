'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { 
  HiOutlineArrowLeft,
  HiOutlineTruck,
  HiOutlineLocationMarker,
  HiOutlineClipboardCheck,
  HiOutlineRefresh,
  HiOutlineCheckCircle,
  HiOutlineExclamationCircle,
  HiOutlineCube,
  HiOutlineCurrencyDollar,
  HiOutlineUserGroup,
} from 'react-icons/hi';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription,
  Button, 
  Badge,
  Modal,
  Checkbox,
} from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import type { Order } from '@/types';

interface OrderGroup {
  country: string;
  countryCode: string;
  region: string;
  orders: Order[];
  totalItems: number;
  totalValue: number;
  estimatedShipping: number;
  potentialSavings: number;
}

const COUNTRY_CODE_MAP: Record<string, string> = {
  'South Africa': 'ZA',
  'ZA': 'ZA',
  'United States': 'US',
  'USA': 'US',
  'US': 'US',
  'United Kingdom': 'GB',
  'UK': 'GB',
  'GB': 'GB',
  'Canada': 'CA',
  'CA': 'CA',
  'Australia': 'AU',
  'AU': 'AU',
  'Germany': 'DE',
  'DE': 'DE',
  'Nigeria': 'NG',
  'NG': 'NG',
};

const REGION_MAP: Record<string, string> = {
  'ZA': 'Africa',
  'NG': 'Africa',
  'KE': 'Africa',
  'GH': 'Africa',
  'US': 'North America',
  'CA': 'North America',
  'GB': 'Europe',
  'DE': 'Europe',
  'FR': 'Europe',
  'NL': 'Europe',
  'AU': 'Oceania',
  'NZ': 'Oceania',
};

export default function BulkOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [isPlacingOrders, setIsPlacingOrders] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [placementResults, setPlacementResults] = useState<Array<{ orderId: string; orderNumber: string; success: boolean; error?: string }>>([]);
  const [showResultsModal, setShowResultsModal] = useState(false);

  useEffect(() => {
    fetchEligibleOrders();
  }, []);

  const fetchEligibleOrders = async () => {
    setIsLoading(true);
    try {
      // Fetch paid orders that haven't been placed to CJ yet
      const { data: allOrders, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (*),
          cj_orders (id)
        `)
        .eq('payment_status', 'paid')
        .in('status', ['pending', 'processing'])
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching orders:', error);
        return;
      }

      // Filter out orders that already have CJ orders
      const eligibleOrders = (allOrders || []).filter(
        order => !order.cj_orders || order.cj_orders.length === 0
      );

      setOrders(eligibleOrders);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Group orders by country/region
  const orderGroups = useMemo(() => {
    const groups: Record<string, OrderGroup> = {};

    orders.forEach(order => {
      const country = order.shipping_country || 'Unknown';
      const countryCode = COUNTRY_CODE_MAP[country] || COUNTRY_CODE_MAP[country.toUpperCase()] || country.slice(0, 2).toUpperCase();
      const region = REGION_MAP[countryCode] || 'Other';

      if (!groups[country]) {
        groups[country] = {
          country,
          countryCode,
          region,
          orders: [],
          totalItems: 0,
          totalValue: 0,
          estimatedShipping: 0,
          potentialSavings: 0,
        };
      }

      groups[country].orders.push(order);
      groups[country].totalItems += order.order_items?.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0) || 0;
      groups[country].totalValue += order.total || 0;
      
      // Estimate shipping cost per order (simplified)
      const baseShipping = 50; // Base shipping per order
      groups[country].estimatedShipping += baseShipping;
    });

    // Calculate potential savings (bulk shipping discount)
    Object.values(groups).forEach(group => {
      if (group.orders.length > 1) {
        // Estimate 15-30% savings when grouping orders
        const individualCost = group.orders.length * 50;
        const bulkCost = 50 + (group.orders.length - 1) * 30; // First order full price, subsequent orders discounted
        group.potentialSavings = individualCost - bulkCost;
      }
    });

    return Object.values(groups).sort((a, b) => b.orders.length - a.orders.length);
  }, [orders]);

  const selectedOrders = useMemo(() => {
    return orders.filter(order => selectedOrderIds.has(order.id));
  }, [orders, selectedOrderIds]);

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrderIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  const selectAllInGroup = (group: OrderGroup) => {
    setSelectedOrderIds(prev => {
      const newSet = new Set(prev);
      group.orders.forEach(order => newSet.add(order.id));
      return newSet;
    });
  };

  const deselectAllInGroup = (group: OrderGroup) => {
    setSelectedOrderIds(prev => {
      const newSet = new Set(prev);
      group.orders.forEach(order => newSet.delete(order.id));
      return newSet;
    });
  };

  const isGroupFullySelected = (group: OrderGroup) => {
    return group.orders.every(order => selectedOrderIds.has(order.id));
  };

  const isGroupPartiallySelected = (group: OrderGroup) => {
    const selectedCount = group.orders.filter(order => selectedOrderIds.has(order.id)).length;
    return selectedCount > 0 && selectedCount < group.orders.length;
  };

  const placeBulkOrders = async () => {
    if (selectedOrders.length === 0) return;
    
    setIsPlacingOrders(true);
    setShowConfirmModal(false);
    const results: Array<{ orderId: string; orderNumber: string; success: boolean; error?: string }> = [];

    // Place orders sequentially to avoid rate limiting
    for (const order of selectedOrders) {
      try {
        const response = await fetch('/api/orders/place-to-cj', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: order.id }),
        });

        const result = await response.json();
        
        results.push({
          orderId: order.id,
          orderNumber: order.order_number,
          success: result.success,
          error: result.error,
        });

        // Small delay between orders to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        results.push({
          orderId: order.id,
          orderNumber: order.order_number,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    setPlacementResults(results);
    setShowResultsModal(true);
    setIsPlacingOrders(false);
    setSelectedOrderIds(new Set());
    
    // Refresh orders list
    fetchEligibleOrders();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const successCount = placementResults.filter(r => r.success).length;
  const failCount = placementResults.filter(r => !r.success).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/orders">
            <Button variant="ghost" size="sm">
              <HiOutlineArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="font-heading text-2xl md:text-3xl text-gray-1 tracking-wider">
              Bulk Order Fulfillment
            </h1>
            <p className="text-gray-5 text-sm mt-1">
              Group orders by destination to save on shipping costs
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={fetchEligibleOrders} disabled={isLoading}>
            <HiOutlineRefresh className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {selectedOrderIds.size > 0 && (
            <Button 
              onClick={() => setShowConfirmModal(true)}
              disabled={isPlacingOrders}
              leftIcon={<HiOutlineTruck className="w-4 h-4" />}
            >
              Place {selectedOrderIds.size} Order{selectedOrderIds.size > 1 ? 's' : ''} to CJ
            </Button>
          )}
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <HiOutlineCube className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-1">{orders.length}</p>
              <p className="text-xs text-gray-5">Ready Orders</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <HiOutlineCheckCircle className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-1">{selectedOrderIds.size}</p>
              <p className="text-xs text-gray-5">Selected</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <HiOutlineLocationMarker className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-1">{orderGroups.length}</p>
              <p className="text-xs text-gray-5">Destinations</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-main-1/10 flex items-center justify-center">
              <HiOutlineCurrencyDollar className="w-5 h-5 text-main-1" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-400">
                {formatCurrency(orderGroups.reduce((sum, g) => sum + g.potentialSavings, 0))}
              </p>
              <p className="text-xs text-gray-5">Potential Savings</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 bg-dark-2 border border-dark-4 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-dark-3 flex items-center justify-center mx-auto mb-4">
            <HiOutlineClipboardCheck className="w-8 h-8 text-gray-5" />
          </div>
          <h3 className="text-lg font-medium text-gray-1 mb-2">No Orders Ready for Fulfillment</h3>
          <p className="text-gray-5 text-sm max-w-md mx-auto">
            All paid orders have been placed to CJ Dropshipping, or there are no paid orders waiting to be fulfilled.
          </p>
          <Link href="/orders" className="mt-4 inline-block">
            <Button variant="secondary">View All Orders</Button>
          </Link>
        </Card>
      ) : (
        <>
          {/* Order Groups by Country */}
          <div className="space-y-6">
            {orderGroups.map(group => (
              <Card key={group.country}>
                <CardHeader 
                  className="cursor-pointer"
                  action={
                    <div className="flex items-center gap-2">
                      {group.potentialSavings > 0 && (
                        <Badge variant="success" className="text-xs">
                          Save {formatCurrency(group.potentialSavings)}
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (isGroupFullySelected(group)) {
                            deselectAllInGroup(group);
                          } else {
                            selectAllInGroup(group);
                          }
                        }}
                      >
                        {isGroupFullySelected(group) ? 'Deselect All' : 'Select All'}
                      </Button>
                    </div>
                  }
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-dark-3 flex items-center justify-center text-lg">
                      {group.countryCode === 'ZA' ? '🇿🇦' : 
                       group.countryCode === 'US' ? '🇺🇸' : 
                       group.countryCode === 'GB' ? '🇬🇧' : 
                       group.countryCode === 'CA' ? '🇨🇦' : 
                       group.countryCode === 'AU' ? '🇦🇺' : 
                       group.countryCode === 'DE' ? '🇩🇪' : 
                       group.countryCode === 'NG' ? '🇳🇬' : '🌍'}
                    </div>
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {group.country}
                        <span className="text-sm font-normal text-gray-5">({group.region})</span>
                      </CardTitle>
                      <CardDescription>
                        {group.orders.length} order{group.orders.length > 1 ? 's' : ''} • {group.totalItems} items • {formatCurrency(group.totalValue)} total
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                {/* Orders Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-dark-3/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-5 uppercase tracking-wider w-12">
                          <span className="sr-only">Select</span>
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-5 uppercase tracking-wider">
                          Order
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-5 uppercase tracking-wider hidden sm:table-cell">
                          Customer
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-5 uppercase tracking-wider hidden md:table-cell">
                          City
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-5 uppercase tracking-wider">
                          Items
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-5 uppercase tracking-wider">
                          Total
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-5 uppercase tracking-wider hidden lg:table-cell">
                          Date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dark-4">
                      {group.orders.map(order => (
                        <tr 
                          key={order.id} 
                          className={`hover:bg-dark-3/30 transition-colors cursor-pointer ${
                            selectedOrderIds.has(order.id) ? 'bg-main-1/5' : ''
                          }`}
                          onClick={() => toggleOrderSelection(order.id)}
                        >
                          <td className="px-4 py-3">
                            <Checkbox
                              checked={selectedOrderIds.has(order.id)}
                              onChange={() => toggleOrderSelection(order.id)}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <Link 
                              href={`/orders/${order.id}`}
                              className="text-main-1 hover:underline font-mono text-sm"
                              onClick={e => e.stopPropagation()}
                            >
                              #{order.order_number}
                            </Link>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <span className="text-gray-1 text-sm">{order.shipping_name}</span>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <span className="text-gray-5 text-sm">{order.shipping_city}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-gray-1 text-sm">
                              {order.order_items?.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0) || 0}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-gray-1 text-sm font-medium">
                              {formatCurrency(order.total)}
                            </span>
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            <span className="text-gray-5 text-sm">
                              {format(new Date(order.created_at), 'MMM d')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ))}
          </div>

          {/* Tip Card */}
          <Card className="p-4 bg-gradient-to-r from-main-1/5 to-amber-500/5 border-main-1/20">
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-lg bg-main-1/10 flex items-center justify-center flex-shrink-0">
                <HiOutlineUserGroup className="w-5 h-5 text-main-1" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-1 mb-1">💡 Tip: Group Orders for Savings</h3>
                <p className="text-xs text-gray-5">
                  Orders going to the same country can often be shipped together to reduce costs. 
                  Select multiple orders from the same destination and place them together for potential shipping discounts.
                  CJ Dropshipping may combine shipments automatically when orders have similar destinations.
                </p>
              </div>
            </div>
          </Card>
        </>
      )}

      {/* Confirm Modal */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Confirm Bulk Order Placement"
      >
        <div className="space-y-4">
          <p className="text-gray-5">
            You are about to place <span className="text-main-1 font-medium">{selectedOrderIds.size}</span> order{selectedOrderIds.size > 1 ? 's' : ''} to CJ Dropshipping.
          </p>
          
          <div className="bg-dark-3 rounded-lg p-4 space-y-2">
            <h4 className="text-sm font-medium text-gray-1">Selected Orders:</h4>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {selectedOrders.map(order => (
                <div key={order.id} className="flex justify-between text-sm">
                  <span className="text-gray-5">#{order.order_number}</span>
                  <span className="text-gray-1">{order.shipping_city}, {order.shipping_country}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
            <p className="text-xs text-amber-200">
              ⚠️ Make sure all orders have valid shipping information. Orders will be placed sequentially to avoid rate limiting.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowConfirmModal(false)}>
              Cancel
            </Button>
            <Button onClick={placeBulkOrders} isLoading={isPlacingOrders}>
              Place Orders to CJ
            </Button>
          </div>
        </div>
      </Modal>

      {/* Results Modal */}
      <Modal
        isOpen={showResultsModal}
        onClose={() => setShowResultsModal(false)}
        title="Order Placement Results"
        size="lg"
      >
        <div className="space-y-4">
          {/* Summary */}
          <div className="flex gap-4">
            <div className="flex-1 bg-green-500/10 border border-green-500/20 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-green-400">{successCount}</p>
              <p className="text-sm text-green-300">Successful</p>
            </div>
            {failCount > 0 && (
              <div className="flex-1 bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-red-400">{failCount}</p>
                <p className="text-sm text-red-300">Failed</p>
              </div>
            )}
          </div>

          {/* Details */}
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {placementResults.map(result => (
              <div 
                key={result.orderId}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  result.success ? 'bg-green-500/5' : 'bg-red-500/5'
                }`}
              >
                <div className="flex items-center gap-3">
                  {result.success ? (
                    <HiOutlineCheckCircle className="w-5 h-5 text-green-400" />
                  ) : (
                    <HiOutlineExclamationCircle className="w-5 h-5 text-red-400" />
                  )}
                  <span className="font-mono text-sm text-gray-1">#{result.orderNumber}</span>
                </div>
                {result.error && (
                  <span className="text-xs text-red-400 max-w-[200px] truncate">{result.error}</span>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={() => setShowResultsModal(false)}>
              Done
            </Button>
          </div>
        </div>
      </Modal>

      {/* Placing Orders Overlay */}
      {isPlacingOrders && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-dark-2 border border-dark-4 rounded-xl p-8 text-center max-w-sm mx-4">
            <div className="w-16 h-16 mx-auto mb-4 relative">
              <div className="absolute inset-0 border-4 border-main-1/20 rounded-full" />
              <div className="absolute inset-0 border-4 border-main-1 rounded-full border-t-transparent animate-spin" />
            </div>
            <h3 className="text-lg font-medium text-gray-1 mb-2">Placing Orders to CJ...</h3>
            <p className="text-sm text-gray-5">
              Processing {selectedOrderIds.size} orders. Please wait...
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

