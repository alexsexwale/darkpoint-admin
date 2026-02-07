'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  HiOutlineArrowLeft,
  HiOutlineTruck,
  HiOutlineClipboardCopy,
  HiOutlineExternalLink,
  HiOutlinePencil,
  HiOutlineRefresh,
  HiOutlineDocumentText,
} from 'react-icons/hi';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription,
  Button, 
  Input,
  Textarea,
  Select,
  Badge,
  OrderStatusBadge,
  PaymentStatusBadge,
  Modal,
} from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import type { Order, OrderStatus, CJOrder } from '@/types';

type CJShippingOption = { logisticName: string; logisticPrice: number; logisticTime: string };

const ORDER_STATUS_OPTIONS: Array<{ value: OrderStatus; label: string }> = [
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'refunded', label: 'Refunded' },
];

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;
  
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPlacingToCJ, setIsPlacingToCJ] = useState(false);
  
  // Edit states
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showCJConfirm, setShowCJConfirm] = useState(false);

  // CJ Place Order modal: shipping options and selection
  const [cjShippingOptions, setCjShippingOptions] = useState<CJShippingOption[]>([]);
  const [cjShippingLoading, setCjShippingLoading] = useState(false);
  const [cjShippingError, setCjShippingError] = useState<string | null>(null);
  const [selectedCjLogistic, setSelectedCjLogistic] = useState<CJShippingOption | null>(null);
  const [cjOrderTotalZar, setCjOrderTotalZar] = useState<number>(0);
  const [cjProductCostZar, setCjProductCostZar] = useState<number | null>(null);
  const [usdZarRate, setUsdZarRate] = useState<number>(18.5);
  const [exchangeRateLoading, setExchangeRateLoading] = useState(false);
  
  const [newStatus, setNewStatus] = useState<OrderStatus>('pending');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [adminNotes, setAdminNotes] = useState('');

  // CJ tracking modal (view tracking info from CJ API)
  const [showCjTrackingModal, setShowCjTrackingModal] = useState(false);
  const [cjTrackingData, setCjTrackingData] = useState<Array<{
    trackingNumber: string;
    logisticName: string;
    trackingFrom: string;
    trackingTo: string;
    deliveryDay: string;
    deliveryTime: string;
    trackingStatus: string;
    lastMileCarrier: string;
    lastTrackNumber: string;
  }> | null>(null);
  const [cjTrackingLoading, setCjTrackingLoading] = useState(false);
  const [cjTrackingError, setCjTrackingError] = useState<string | null>(null);
  const [cjTrackingNumberQueried, setCjTrackingNumberQueried] = useState('');
  const [cjTrackingUrl, setCjTrackingUrl] = useState('');

  // CJ order detail modal (full order from CJ getOrderDetail)
  const [showCjOrderDetailModal, setShowCjOrderDetailModal] = useState(false);
  const [cjOrderDetail, setCjOrderDetail] = useState<{
    orderId: string;
    orderNum?: string;
    platformOrderId?: string;
    cjOrderId?: string | null;
    orderStatus?: string;
    trackNumber?: string | null;
    trackingUrl?: string | null;
    logisticName?: string | null;
    orderAmount?: number;
    productAmount?: number;
    postageAmount?: number | null;
    createDate?: string;
    paymentDate?: string | null;
    outWarehouseTime?: string | null;
    shippingCountryCode?: string;
    shippingProvince?: string;
    shippingCity?: string;
    shippingAddress?: string;
    shippingCustomerName?: string;
    shippingPhone?: string;
    fromCountryCode?: string;
    storageId?: string | null;
    storageName?: string | null;
    productList?: Array<{
      vid: string;
      quantity: number;
      sellPrice?: number;
      lineItemId?: string;
      storeLineItemId?: string;
      productionOrderStatus?: number;
    }>;
  } | null>(null);
  const [cjOrderDetailLoading, setCjOrderDetailLoading] = useState(false);
  const [cjOrderDetailError, setCjOrderDetailError] = useState<string | null>(null);

  useEffect(() => {
    fetchOrder();
  }, [orderId]);

  const fetchCjShippingOptions = useCallback(async () => {
    if (!orderId) return;
    setCjShippingLoading(true);
    setCjShippingError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/cj-shipping-options`);
      const json = await res.json();
      if (!res.ok) {
        setCjShippingError(json.error || 'Failed to load shipping options');
        setCjShippingOptions([]);
        return;
      }
      setCjShippingOptions(json.data ?? []);
      setCjOrderTotalZar(Number(json.orderTotalZar) || 0);
      setCjProductCostZar(json.cjProductCostZar != null ? Number(json.cjProductCostZar) : null);
      if (!json.data?.length) setSelectedCjLogistic(null);
    } catch (err) {
      setCjShippingError(err instanceof Error ? err.message : 'Failed to load shipping options');
      setCjShippingOptions([]);
    } finally {
      setCjShippingLoading(false);
    }
  }, [orderId]);

  const fetchExchangeRate = useCallback(async () => {
    setExchangeRateLoading(true);
    try {
      const res = await fetch('/api/exchange-rate');
      const result = await res.json();
      if (result.success && result.data?.rate != null) {
        setUsdZarRate(Number(result.data.rate));
      }
    } catch {
      // Keep existing usdZarRate (fallback 18.5)
    } finally {
      setExchangeRateLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showCJConfirm && orderId) {
      fetchCjShippingOptions();
      fetchExchangeRate();
    }
  }, [showCJConfirm, orderId, fetchCjShippingOptions, fetchExchangeRate]);

  // Fetch CJ tracking when "View CJ tracking" modal is opened (API may pull & save from CJ order details if missing)
  useEffect(() => {
    const hasCjOrder = order?.cj_orders?.[0];
    if (!showCjTrackingModal || !orderId || !order) return;
    if (!hasCjOrder) {
      setCjTrackingError('This order has not been placed with CJ Dropshipping');
      setCjTrackingData(null);
      setCjTrackingLoading(false);
      return;
    }
    let cancelled = false;
    setCjTrackingNumberQueried('');
    setCjTrackingUrl('');
    setCjTrackingError(null);
    setCjTrackingData(null);
    setCjTrackingLoading(true);
    fetch(`/api/orders/${orderId}/cj-tracking`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        setCjTrackingLoading(false);
        if (json.success && json.data) {
          setCjTrackingData(json.data);
          setCjTrackingError(null);
          setCjTrackingNumberQueried(json.trackNumber || '');
          setCjTrackingUrl(json.trackingUrl || '');
          // If API pulled and saved tracking, update local order and edit form so UI reflects it
          if (json.saved && json.trackNumber && order) {
            setOrder({
              ...order,
              tracking_number: json.trackNumber,
              tracking_url: json.trackingUrl || order.tracking_url || null,
              cj_orders: order.cj_orders?.map((cj, i) =>
                i === 0 ? { ...cj, cj_tracking_number: json.trackNumber } : cj
              ) ?? order.cj_orders,
            });
            setTrackingNumber(json.trackNumber);
            setTrackingUrl(json.trackingUrl || '');
          }
        } else {
          setCjTrackingError(json.error || 'Failed to load tracking information');
          setCjTrackingData(null);
          setCjTrackingNumberQueried(json.trackNumber || '');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setCjTrackingLoading(false);
          setCjTrackingError(err?.message || 'Failed to load tracking');
          setCjTrackingData(null);
        }
      });
    return () => { cancelled = true; };
  }, [showCjTrackingModal, orderId, order?.cj_orders, order]);

  // Fetch CJ order detail when "View CJ order details" modal is opened
  useEffect(() => {
    const hasCjOrder = order?.cj_orders?.[0];
    if (!showCjOrderDetailModal || !orderId || !hasCjOrder) return;
    let cancelled = false;
    setCjOrderDetailError(null);
    setCjOrderDetail(null);
    setCjOrderDetailLoading(true);
    fetch(`/api/orders/${orderId}/cj-order-detail`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        setCjOrderDetailLoading(false);
        if (json.success && json.data) {
          setCjOrderDetail(json.data);
          setCjOrderDetailError(null);
        } else {
          setCjOrderDetailError(json.error || 'Failed to load CJ order details');
          setCjOrderDetail(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setCjOrderDetailLoading(false);
          setCjOrderDetailError(err?.message || 'Failed to load order details');
          setCjOrderDetail(null);
        }
      });
    return () => { cancelled = true; };
  }, [showCjOrderDetailModal, orderId, order?.cj_orders]);

  const closeCjModal = useCallback(() => {
    setShowCJConfirm(false);
    setSelectedCjLogistic(null);
    setCjShippingError(null);
    setCjShippingOptions([]);
    setCjOrderTotalZar(0);
    setCjProductCostZar(null);
  }, []);

  const fetchOrder = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (*),
          cj_orders (*)
        `)
        .eq('id', orderId)
        .single();

      if (error) {
        console.error('Error fetching order:', error);
        router.push('/orders');
      } else {
        setOrder(data);
        setNewStatus(data.status);
        setTrackingNumber(data.tracking_number || '');
        setTrackingUrl(data.tracking_url || '');
        setAdminNotes(data.admin_notes || '');
      }
    } catch (err) {
      console.error('Order fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const updateOrderStatus = async () => {
    if (!order) return;
    setIsSaving(true);

    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update status');
      }

      const updates: Partial<Order> = { status: newStatus };
      if (newStatus === 'shipped' && !order.shipped_at) {
        updates.shipped_at = new Date().toISOString();
      }
      if (newStatus === 'delivered' && !order.delivered_at) {
        updates.delivered_at = new Date().toISOString();
      }
      setOrder({ ...order, ...updates });
      setShowStatusModal(false);
      if (data.emailSent === false && data.success) {
        // Status updated but email may not have been sent (e.g. no recipient)
        // Optionally show a subtle toast in the future
      }
    } catch (err) {
      console.error('Error updating status:', err);
      alert(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setIsSaving(false);
    }
  };

  const updateTracking = async () => {
    if (!order) return;
    setIsSaving(true);
    
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          tracking_number: trackingNumber || null,
          tracking_url: trackingUrl || null,
        })
        .eq('id', orderId);

      if (error) throw error;
      
      setOrder({ ...order, tracking_number: trackingNumber, tracking_url: trackingUrl });
      setShowTrackingModal(false);
    } catch (err) {
      console.error('Error updating tracking:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const updateNotes = async () => {
    if (!order) return;
    setIsSaving(true);
    
    try {
      const { error } = await supabase
        .from('orders')
        .update({ admin_notes: adminNotes || null })
        .eq('id', orderId);

      if (error) throw error;
      
      setOrder({ ...order, admin_notes: adminNotes });
      setShowNotesModal(false);
    } catch (err) {
      console.error('Error updating notes:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const placeToCJDropshipping = async () => {
    if (!order) return;
    setIsPlacingToCJ(true);
    try {
      const body: { orderId: string; logisticName?: string } = { orderId: order.id };
      if (selectedCjLogistic?.logisticName) body.logisticName = selectedCjLogistic.logisticName;
      const response = await fetch('/api/orders/place-to-cj', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (result.success) {
        await fetchOrder();
        closeCjModal();
      } else {
        console.error('Failed to place order to CJ:', result.error);
        alert(`Failed to place order: ${result.error}`);
      }
    } catch (err) {
      console.error('CJ placement error:', err);
      alert('An error occurred while placing the order');
    } finally {
      setIsPlacingToCJ(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
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

  if (!order) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-5">Order not found</p>
        <Link href="/orders" className="text-main-1 hover:underline mt-2 inline-block">
          Back to Orders
        </Link>
      </div>
    );
  }

  const cjOrder = order.cj_orders?.[0];
  const cjFailed = cjOrder?.cj_status === 'failed';
  const canPlaceToCJ = order.payment_status === 'paid' && (!cjOrder || cjFailed);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/orders">
            <Button variant="ghost" size="sm">
              <HiOutlineArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-heading text-2xl text-gray-1 tracking-wider">
                Order #{order.order_number}
              </h1>
              <button 
                onClick={() => copyToClipboard(order.order_number)}
                className="text-gray-5 hover:text-main-1 transition-colors"
                title="Copy order number"
              >
                <HiOutlineClipboardCopy className="w-4 h-4" />
              </button>
            </div>
            <p className="text-gray-5 text-sm mt-1">
              Placed on {format(new Date(order.created_at), 'MMMM d, yyyy \'at\' HH:mm')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {canPlaceToCJ && (
            <Button 
              onClick={() => setShowCJConfirm(true)}
              leftIcon={<HiOutlineTruck className="w-4 h-4" />}
            >
              Place to CJ
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items */}
          <Card>
            <CardHeader>
              <CardTitle>Order Items</CardTitle>
              <CardDescription>{order.order_items?.length || 0} items</CardDescription>
            </CardHeader>
            <div className="divide-y divide-dark-4">
              {order.order_items?.map((item) => (
                <div key={item.id} className="flex items-center gap-4 py-4">
                  <div className="w-16 h-16 bg-dark-3 rounded-lg overflow-hidden flex-shrink-0">
                    {item.product_image ? (
                      <img 
                        src={item.product_image} 
                        alt={item.product_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-5 text-xs">
                        No image
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-1 truncate">{item.product_name}</p>
                    {item.variant_name && (
                      <p className="text-sm text-gray-5">{item.variant_name}</p>
                    )}
                    <p className="text-sm text-gray-5">SKU: {item.sku || 'N/A'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-1">{formatCurrency(item.unit_price)} × {item.quantity}</p>
                    <p className="font-medium text-main-1">{formatCurrency(item.total_price)}</p>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Order Summary */}
            <div className="border-t border-dark-4 pt-4 mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-5">Subtotal</span>
                <span className="text-gray-1">{formatCurrency(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-5">Shipping</span>
                <span className="text-gray-1">{formatCurrency(order.shipping_cost)}</span>
              </div>
              {order.discount_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-5">Discount</span>
                  <span className="text-green-400">-{formatCurrency(order.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-medium pt-2 border-t border-dark-4">
                <span className="text-gray-1">Total</span>
                <span className="text-main-1">{formatCurrency(order.total)}</span>
              </div>
            </div>
          </Card>

          {/* Shipping Address */}
          <Card>
            <CardHeader>
              <CardTitle>Shipping Address</CardTitle>
            </CardHeader>
            <div className="text-gray-1">
              <p className="font-medium">{order.shipping_name}</p>
              <p className="text-gray-5">{order.shipping_address_line1}</p>
              {order.shipping_address_line2 && (
                <p className="text-gray-5">{order.shipping_address_line2}</p>
              )}
              <p className="text-gray-5">
                {order.shipping_city}, {order.shipping_province} {order.shipping_postal_code}
              </p>
              <p className="text-gray-5">{order.shipping_country}</p>
              {order.shipping_phone && (
                <p className="text-gray-5 mt-2">Phone: {order.shipping_phone}</p>
              )}
              {order.billing_email && (
                <p className="text-gray-5 mt-1">Email: {order.billing_email}</p>
              )}
            </div>
          </Card>

          {/* Customer Notes */}
          {order.customer_notes && (
            <Card>
              <CardHeader>
                <CardTitle>Customer Notes</CardTitle>
              </CardHeader>
              <p className="text-gray-5 whitespace-pre-wrap">{order.customer_notes}</p>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Card */}
          <Card>
            <CardHeader action={
              <Button variant="ghost" size="sm" onClick={() => setShowStatusModal(true)}>
                <HiOutlinePencil className="w-4 h-4" />
              </Button>
            }>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-5">Order Status</span>
                <OrderStatusBadge status={order.status} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-5">Payment</span>
                <PaymentStatusBadge status={order.payment_status} />
              </div>
            </div>
          </Card>

          {/* CJ Dropshipping Status */}
          <Card>
            <CardHeader action={
              cjOrder ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCjOrderDetailModal(true)}
                  className="flex items-center gap-1.5"
                >
                  <HiOutlineDocumentText className="w-4 h-4" />
                  View order details
                </Button>
              ) : undefined
            }>
              <CardTitle>CJ Dropshipping</CardTitle>
            </CardHeader>
            {cjOrder ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-5">CJ Order ID</span>
                  <span className="text-gray-1 font-mono text-sm">{cjOrder.cj_order_id || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-5">Status</span>
                  <Badge variant={cjFailed ? 'danger' : 'success'}>{cjOrder.cj_status || 'Placed'}</Badge>
                </div>
                {cjFailed && cjOrder.error_message && (
                  <p className="text-sm text-red-400/90 bg-red-500/10 rounded px-2 py-1.5" title={cjOrder.error_message}>
                    {cjOrder.error_message}
                  </p>
                )}
                {cjOrder.cj_tracking_number && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-5">Tracking</span>
                    <span className="text-main-1">{cjOrder.cj_tracking_number}</span>
                  </div>
                )}
                {cjOrder.placed_at && !cjFailed && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-5">Placed At</span>
                    <span className="text-gray-1 text-sm">
                      {format(new Date(cjOrder.placed_at), 'MMM d, HH:mm')}
                    </span>
                  </div>
                )}
                {canPlaceToCJ && (
                  <div className="pt-2">
                    <Button
                      size="sm"
                      onClick={() => setShowCJConfirm(true)}
                      leftIcon={<HiOutlineTruck className="w-4 h-4" />}
                    >
                      {cjFailed ? 'Retry Place Order' : 'Place Order'}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-5 text-sm mb-3">Order not placed to CJ yet</p>
                {canPlaceToCJ && (
                  <Button 
                    size="sm" 
                    onClick={() => setShowCJConfirm(true)}
                    leftIcon={<HiOutlineTruck className="w-4 h-4" />}
                  >
                    Place Order
                  </Button>
                )}
              </div>
            )}
          </Card>

          {/* Tracking */}
          <Card>
            <CardHeader action={
              <div className="flex items-center gap-1">
                {cjOrder && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowCjTrackingModal(true)}
                    className="flex items-center gap-1.5"
                  >
                    <HiOutlineTruck className="w-4 h-4" />
                    View CJ tracking
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setShowTrackingModal(true)}>
                  <HiOutlinePencil className="w-4 h-4" />
                </Button>
              </div>
            }>
              <CardTitle>Tracking</CardTitle>
            </CardHeader>
            {order.tracking_number ? (
              <div className="space-y-3">
                <div>
                  <span className="text-gray-5 text-sm">Tracking Number</span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-1 font-mono">{order.tracking_number}</span>
                    <button 
                      onClick={() => copyToClipboard(order.tracking_number!)}
                      className="text-gray-5 hover:text-main-1"
                    >
                      <HiOutlineClipboardCopy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {order.tracking_url && (
                  <a 
                    href={order.tracking_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-main-1 hover:underline text-sm"
                  >
                    Track Package <HiOutlineExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            ) : (
              <p className="text-gray-5 text-sm">No tracking information yet</p>
            )}
          </Card>

          {/* Admin Notes */}
          <Card>
            <CardHeader action={
              <Button variant="ghost" size="sm" onClick={() => setShowNotesModal(true)}>
                <HiOutlinePencil className="w-4 h-4" />
              </Button>
            }>
              <CardTitle>Admin Notes</CardTitle>
            </CardHeader>
            {order.admin_notes ? (
              <p className="text-gray-5 text-sm whitespace-pre-wrap">{order.admin_notes}</p>
            ) : (
              <p className="text-gray-5 text-sm italic">No notes added</p>
            )}
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 mt-2 rounded-full bg-main-1" />
                <div>
                  <p className="text-gray-1 text-sm">Order Created</p>
                  <p className="text-gray-5 text-xs">
                    {format(new Date(order.created_at), 'MMM d, yyyy HH:mm')}
                  </p>
                </div>
              </div>
              {order.shipped_at && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 mt-2 rounded-full bg-blue-400" />
                  <div>
                    <p className="text-gray-1 text-sm">Shipped</p>
                    <p className="text-gray-5 text-xs">
                      {format(new Date(order.shipped_at), 'MMM d, yyyy HH:mm')}
                    </p>
                  </div>
                </div>
              )}
              {order.delivered_at && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 mt-2 rounded-full bg-green-400" />
                  <div>
                    <p className="text-gray-1 text-sm">Delivered</p>
                    <p className="text-gray-5 text-xs">
                      {format(new Date(order.delivered_at), 'MMM d, yyyy HH:mm')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Status Modal */}
      <Modal
        isOpen={showStatusModal}
        onClose={() => setShowStatusModal(false)}
        title="Update Order Status"
      >
        <div className="space-y-4">
          <Select
            label="Order Status"
            options={ORDER_STATUS_OPTIONS}
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value as OrderStatus)}
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowStatusModal(false)}>
              Cancel
            </Button>
            <Button onClick={updateOrderStatus} isLoading={isSaving}>
              Update Status
            </Button>
          </div>
        </div>
      </Modal>

      {/* Tracking Modal */}
      <Modal
        isOpen={showTrackingModal}
        onClose={() => setShowTrackingModal(false)}
        title="Update Tracking Information"
      >
        <div className="space-y-4">
          <Input
            label="Tracking Number"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            placeholder="Enter tracking number"
          />
          <Input
            label="Tracking URL"
            value={trackingUrl}
            onChange={(e) => setTrackingUrl(e.target.value)}
            placeholder="https://..."
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowTrackingModal(false)}>
              Cancel
            </Button>
            <Button onClick={updateTracking} isLoading={isSaving}>
              Save
            </Button>
          </div>
        </div>
      </Modal>

      {/* CJ Tracking Info Modal */}
      <Modal
        isOpen={showCjTrackingModal}
        onClose={() => setShowCjTrackingModal(false)}
        title="CJ Dropshipping Tracking"
        size="md"
      >
        <div className="space-y-4">
          {cjTrackingNumberQueried && (
            <div className="space-y-1">
              <p className="text-gray-5 text-sm">
                Tracking number: <span className="font-mono text-gray-1">{cjTrackingNumberQueried}</span>
              </p>
              {cjTrackingUrl && (
                <a
                  href={cjTrackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-main-1 hover:underline text-sm"
                >
                  Track package on CJPacket <HiOutlineExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          )}
          {cjTrackingLoading && (
            <div className="flex items-center gap-3 py-6 text-gray-5">
              <span className="inline-block h-5 w-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Loading tracking information from CJ…
            </div>
          )}
          {!cjTrackingLoading && cjTrackingError && (
            <p className="text-red-400 text-sm py-2">{cjTrackingError}</p>
          )}
          {!cjTrackingLoading && cjTrackingData && cjTrackingData.length > 0 && (
            <div className="space-y-4">
              {cjTrackingData.map((item, idx) => (
                <div key={idx} className="rounded-lg border border-dark-4 bg-dark-3/50 p-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div>
                      <span className="text-gray-5 block">Carrier</span>
                      <span className="text-gray-1">{item.logisticName || '—'}</span>
                    </div>
                    <div>
                      <span className="text-gray-5 block">Status</span>
                      <span className="text-gray-1">{item.trackingStatus || '—'}</span>
                    </div>
                    <div>
                      <span className="text-gray-5 block">From → To</span>
                      <span className="text-gray-1">{item.trackingFrom || '—'} → {item.trackingTo || '—'}</span>
                    </div>
                    <div>
                      <span className="text-gray-5 block">Delivery (days)</span>
                      <span className="text-gray-1">{item.deliveryDay || '—'}</span>
                    </div>
                    {item.deliveryTime && (
                      <div className="sm:col-span-2">
                        <span className="text-gray-5 block">Delivery time</span>
                        <span className="text-gray-1">{item.deliveryTime}</span>
                      </div>
                    )}
                    {item.lastMileCarrier && (
                      <div>
                        <span className="text-gray-5 block">Last mile carrier</span>
                        <span className="text-gray-1">{item.lastMileCarrier}</span>
                      </div>
                    )}
                    {item.lastTrackNumber && (
                      <div>
                        <span className="text-gray-5 block">Last mile tracking</span>
                        <span className="text-gray-1 font-mono">{item.lastTrackNumber}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {!cjTrackingLoading && cjTrackingData && cjTrackingData.length === 0 && !cjTrackingError && (
            <p className="text-gray-5 text-sm">No tracking details returned from CJ.</p>
          )}
          <div className="flex justify-end pt-2">
            <Button variant="secondary" onClick={() => setShowCjTrackingModal(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* CJ Order Detail Modal */}
      <Modal
        isOpen={showCjOrderDetailModal}
        onClose={() => setShowCjOrderDetailModal(false)}
        title="CJ Dropshipping Order Details"
        size="lg"
      >
        <div className="space-y-4">
          {cjOrderDetailLoading && (
            <div className="flex items-center gap-3 py-6 text-gray-5">
              <span className="inline-block h-5 w-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Loading order details from CJ…
            </div>
          )}
          {!cjOrderDetailLoading && cjOrderDetailError && (
            <p className="text-red-400 text-sm py-2">{cjOrderDetailError}</p>
          )}
          {!cjOrderDetailLoading && cjOrderDetail && (
            <div className="space-y-5">
              <div className="rounded-lg border border-dark-4 bg-dark-3/50 p-4 space-y-3">
                <h4 className="text-xs font-heading uppercase tracking-wider text-gray-5 mb-2">Order &amp; status</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <span className="text-gray-5 block">CJ Order ID</span>
                    <span className="text-gray-1 font-mono">{cjOrderDetail.orderId}</span>
                  </div>
                  {cjOrderDetail.orderNum && (
                    <div>
                      <span className="text-gray-5 block">Order number</span>
                      <span className="text-gray-1">{cjOrderDetail.orderNum}</span>
                    </div>
                  )}
                  {cjOrderDetail.platformOrderId && (
                    <div>
                      <span className="text-gray-5 block">Platform order ID</span>
                      <span className="text-gray-1">{cjOrderDetail.platformOrderId}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-5 block">Status</span>
                    <Badge variant="success">{cjOrderDetail.orderStatus || '—'}</Badge>
                  </div>
                  {cjOrderDetail.logisticName && (
                    <div className="sm:col-span-2">
                      <span className="text-gray-5 block">Logistics</span>
                      <span className="text-gray-1">{cjOrderDetail.logisticName}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-dark-4 bg-dark-3/50 p-4 space-y-3">
                <h4 className="text-xs font-heading uppercase tracking-wider text-gray-5 mb-2">Shipping</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  {cjOrderDetail.shippingCustomerName && (
                    <div>
                      <span className="text-gray-5 block">Recipient</span>
                      <span className="text-gray-1">{cjOrderDetail.shippingCustomerName}</span>
                    </div>
                  )}
                  {cjOrderDetail.shippingPhone && (
                    <div>
                      <span className="text-gray-5 block">Phone</span>
                      <span className="text-gray-1">{cjOrderDetail.shippingPhone}</span>
                    </div>
                  )}
                  {(cjOrderDetail.shippingAddress || cjOrderDetail.shippingCity) && (
                    <div className="sm:col-span-2">
                      <span className="text-gray-5 block">Address</span>
                      <span className="text-gray-1">
                        {[cjOrderDetail.shippingAddress, cjOrderDetail.shippingCity, cjOrderDetail.shippingProvince, cjOrderDetail.shippingCountryCode]
                          .filter(Boolean)
                          .join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-dark-4 bg-dark-3/50 p-4 space-y-3">
                <h4 className="text-xs font-heading uppercase tracking-wider text-gray-5 mb-2">Amounts &amp; dates</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  {cjOrderDetail.orderAmount != null && (
                    <div>
                      <span className="text-gray-5 block">Order amount (USD)</span>
                      <span className="text-gray-1">${Number(cjOrderDetail.orderAmount).toFixed(2)}</span>
                    </div>
                  )}
                  {cjOrderDetail.productAmount != null && (
                    <div>
                      <span className="text-gray-5 block">Product amount (USD)</span>
                      <span className="text-gray-1">${Number(cjOrderDetail.productAmount).toFixed(2)}</span>
                    </div>
                  )}
                  {cjOrderDetail.postageAmount != null && (
                    <div>
                      <span className="text-gray-5 block">Postage (USD)</span>
                      <span className="text-gray-1">${Number(cjOrderDetail.postageAmount).toFixed(2)}</span>
                    </div>
                  )}
                  {cjOrderDetail.createDate && (
                    <div>
                      <span className="text-gray-5 block">Created</span>
                      <span className="text-gray-1">{cjOrderDetail.createDate}</span>
                    </div>
                  )}
                  {cjOrderDetail.paymentDate && (
                    <div>
                      <span className="text-gray-5 block">Payment date</span>
                      <span className="text-gray-1">{cjOrderDetail.paymentDate}</span>
                    </div>
                  )}
                  {cjOrderDetail.outWarehouseTime && (
                    <div>
                      <span className="text-gray-5 block">Out of warehouse</span>
                      <span className="text-gray-1">{cjOrderDetail.outWarehouseTime}</span>
                    </div>
                  )}
                </div>
              </div>

              {(cjOrderDetail.trackNumber || cjOrderDetail.trackingUrl) && (
                <div className="rounded-lg border border-dark-4 bg-dark-3/50 p-4 space-y-2">
                  <h4 className="text-xs font-heading uppercase tracking-wider text-gray-5 mb-2">Tracking</h4>
                  {cjOrderDetail.trackNumber && (
                    <p className="text-sm">
                      <span className="text-gray-5">Number: </span>
                      <span className="text-gray-1 font-mono">{cjOrderDetail.trackNumber}</span>
                    </p>
                  )}
                  {cjOrderDetail.trackingUrl && (
                    <a
                      href={cjOrderDetail.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-main-1 hover:underline text-sm"
                    >
                      Open tracking URL <HiOutlineExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              )}

              {cjOrderDetail.productList && cjOrderDetail.productList.length > 0 && (
                <div className="rounded-lg border border-dark-4 bg-dark-3/50 p-4 space-y-2">
                  <h4 className="text-xs font-heading uppercase tracking-wider text-gray-5 mb-2">Products</h4>
                  <ul className="space-y-2">
                    {cjOrderDetail.productList.map((p, idx) => (
                      <li key={idx} className="flex justify-between items-center text-sm py-1.5 border-b border-dark-4 last:border-0">
                        <span className="text-gray-1 font-mono text-xs">{p.vid}</span>
                        <span className="text-gray-1">qty {p.quantity}</span>
                        {p.sellPrice != null && (
                          <span className="text-gray-5">${Number(p.sellPrice).toFixed(2)}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(cjOrderDetail.storageName || cjOrderDetail.fromCountryCode) && (
                <div className="rounded-lg border border-dark-4 bg-dark-3/50 p-4 text-sm">
                  <h4 className="text-xs font-heading uppercase tracking-wider text-gray-5 mb-2">Origin</h4>
                  <p className="text-gray-1">
                    {[cjOrderDetail.storageName, cjOrderDetail.fromCountryCode].filter(Boolean).join(' • ')}
                  </p>
                </div>
              )}
            </div>
          )}
          <div className="flex justify-end pt-2">
            <Button variant="secondary" onClick={() => setShowCjOrderDetailModal(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* Notes Modal */}
      <Modal
        isOpen={showNotesModal}
        onClose={() => setShowNotesModal(false)}
        title="Admin Notes"
      >
        <div className="space-y-4">
          <Textarea
            label="Notes"
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            placeholder="Add internal notes about this order..."
            rows={4}
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowNotesModal(false)}>
              Cancel
            </Button>
            <Button onClick={updateNotes} isLoading={isSaving}>
              Save Notes
            </Button>
          </div>
        </div>
      </Modal>

      {/* Place Order to CJ Modal with shipping selection */}
      <Modal
        isOpen={showCJConfirm}
        onClose={closeCjModal}
        title="Place Order to CJ Dropshipping"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-5">
            This will create an order with CJ Dropshipping for fulfillment. Select a shipping method and confirm. Make sure the payment has been received.
          </p>

          {cjShippingLoading && (
            <div className="flex items-center gap-3 py-4 text-gray-5">
              <span className="inline-block h-5 w-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Loading shipping options…
            </div>
          )}

          {!cjShippingLoading && cjShippingError && (
            <div className="space-y-3 rounded-lg bg-red-500/10 border border-red-500/20 p-3">
              <p className="text-sm text-red-400">{cjShippingError}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" leftIcon={<HiOutlineRefresh className="w-4 h-4" />} onClick={fetchCjShippingOptions}>
                  Retry
                </Button>
                <span className="text-xs text-gray-5 self-center">Or place without selecting a method (CJ may choose default).</span>
              </div>
            </div>
          )}

          {!cjShippingLoading && !cjShippingError && cjShippingOptions.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-1">Shipping method</p>
              <div className="space-y-2 max-h-48 overflow-y-auto border border-dark-4 rounded-lg p-2 bg-dark-2/50">
                {cjShippingOptions.map((opt) => {
                  const isSelected = selectedCjLogistic?.logisticName === opt.logisticName;
                  return (
                    <label
                      key={opt.logisticName}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border-2 transition-all ${isSelected ? 'bg-main-1/10 border-main-1 shadow-[0_0_0_1px_rgba(224,136,33,0.3)]' : 'bg-dark-3 border-dark-4 hover:border-dark-5 hover:bg-dark-4'}`}
                    >
                      <span className={`relative flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors ${isSelected ? 'border-main-1 bg-main-1/10' : 'border-dark-5 bg-dark-2'}`}>
                        <input
                          type="radio"
                          name="cjShipping"
                          checked={isSelected}
                          onChange={() => setSelectedCjLogistic(opt)}
                          className="sr-only"
                        />
                        {isSelected && <span className="absolute h-2 w-2 rounded-full bg-main-1" />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-gray-1">{opt.logisticName}</span>
                        <span className="text-gray-5 text-sm ml-2">{opt.logisticTime || '—'}</span>
                      </div>
                      <span className="text-main-1 font-medium whitespace-nowrap">${Number(opt.logisticPrice).toFixed(2)} USD</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {!cjShippingLoading && !cjShippingError && cjShippingOptions.length === 0 && (
            <p className="text-sm text-gray-5">No shipping options available for this order. You can still place the order and CJ may assign a default method.</p>
          )}

          {order && (
            <div className="border-t border-dark-4 pt-4 space-y-3 text-sm">
              <p className="text-gray-5 text-xs">
                Rate: 1 USD = R {usdZarRate.toFixed(2)} ZAR
                {exchangeRateLoading && <span className="ml-2 text-gray-5">(updating…)</span>}
              </p>
              {cjProductCostZar != null && (
                <div className="flex justify-between text-gray-1">
                  <span>CJ product cost</span>
                  <span>{formatCurrency(cjProductCostZar)} ZAR (${(cjProductCostZar / usdZarRate).toFixed(2)} USD)</span>
                </div>
              )}
              {selectedCjLogistic && (
                <div className="flex justify-between text-gray-1">
                  <span>CJ shipping</span>
                  <span>${Number(selectedCjLogistic.logisticPrice).toFixed(2)} USD ({formatCurrency(selectedCjLogistic.logisticPrice * usdZarRate)} ZAR)</span>
                </div>
              )}
              {selectedCjLogistic && (
                <>
                  <div className="flex justify-between font-medium text-gray-1 pt-1 border-t border-dark-4">
                    <span>Your total cost (CJ)</span>
                    <span>
                      {cjProductCostZar != null
                        ? `${formatCurrency(cjProductCostZar + selectedCjLogistic.logisticPrice * usdZarRate)} ZAR ($${(cjProductCostZar / usdZarRate + selectedCjLogistic.logisticPrice).toFixed(2)} USD)`
                        : `$${Number(selectedCjLogistic.logisticPrice).toFixed(2)} USD (${formatCurrency(selectedCjLogistic.logisticPrice * usdZarRate)} ZAR)`}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-1">
                    <span>Order received (customer)</span>
                    <span>{formatCurrency(cjOrderTotalZar || order.total)}</span>
                  </div>
                  <div className="flex justify-between font-medium text-green-400 pt-1 border-t border-dark-4">
                    <span>Your profit</span>
                    <span>
                      {formatCurrency((cjOrderTotalZar || order.total) - (cjProductCostZar != null ? cjProductCostZar + selectedCjLogistic.logisticPrice * usdZarRate : selectedCjLogistic.logisticPrice * usdZarRate))}
                    </span>
                  </div>
                </>
              )}
              {(!selectedCjLogistic || cjShippingOptions.length === 0) && (
                <div className="flex justify-between text-gray-1">
                  <span>Order received (customer)</span>
                  <span>{formatCurrency(cjOrderTotalZar || order.total)}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" onClick={closeCjModal} disabled={isPlacingToCJ}>
              Cancel
            </Button>
            <Button
              onClick={placeToCJDropshipping}
              isLoading={isPlacingToCJ}
              leftIcon={<HiOutlineTruck className="w-4 h-4" />}
              disabled={cjShippingOptions.length > 0 && !selectedCjLogistic}
            >
              Place Order
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

