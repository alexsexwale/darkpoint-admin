'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  HiOutlineArrowLeft,
  HiOutlineTruck,
  HiOutlineClipboardCopy,
  HiOutlineExternalLink,
  HiOutlinePencil,
  HiOutlineCheck,
  HiOutlineX,
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
  ConfirmDialog,
} from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import type { Order, OrderStatus, CJOrder } from '@/types';

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
  
  const [newStatus, setNewStatus] = useState<OrderStatus>('pending');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [adminNotes, setAdminNotes] = useState('');

  useEffect(() => {
    fetchOrder();
  }, [orderId]);

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
      const updates: Partial<Order> = { status: newStatus };
      
      // Auto-set timestamps based on status
      if (newStatus === 'shipped' && !order.shipped_at) {
        updates.shipped_at = new Date().toISOString();
      }
      if (newStatus === 'delivered' && !order.delivered_at) {
        updates.delivered_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('orders')
        .update(updates)
        .eq('id', orderId);

      if (error) throw error;
      
      setOrder({ ...order, ...updates });
      setShowStatusModal(false);
    } catch (err) {
      console.error('Error updating status:', err);
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
      // Call the CJ order placement API
      const response = await fetch('/api/orders/place-to-cj', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Refresh order data
        await fetchOrder();
        setShowCJConfirm(false);
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
            <CardHeader>
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
              <Button variant="ghost" size="sm" onClick={() => setShowTrackingModal(true)}>
                <HiOutlinePencil className="w-4 h-4" />
              </Button>
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

      {/* CJ Confirm Dialog */}
      <ConfirmDialog
        isOpen={showCJConfirm}
        onClose={() => setShowCJConfirm(false)}
        onConfirm={placeToCJDropshipping}
        title="Place Order to CJ Dropshipping"
        message="This will create an order with CJ Dropshipping for fulfillment. Make sure the payment has been received."
        confirmText="Place Order"
        variant="info"
        isLoading={isPlacingToCJ}
      />
    </div>
  );
}

