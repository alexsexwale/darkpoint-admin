'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  HiOutlineArrowLeft,
  HiOutlineDocumentText,
  HiOutlineShoppingCart,
  HiOutlineMail,
  HiOutlineCube,
  HiOutlineExternalLink,
} from 'react-icons/hi';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  ReturnStatusBadge,
} from '@/components/ui';
import { format } from 'date-fns';

type OrderRelation = {
  id?: string;
  order_number?: string;
  total?: number;
  status?: string;
  created_at?: string;
  shipping_name?: string;
  billing_name?: string;
  billing_email?: string;
};

type OrderItemRelation = {
  id?: string;
  product_name?: string;
  product_image?: string | null;
  variant_name?: string | null;
  unit_price?: number;
};

type ReturnRequestItemRow = {
  id: string;
  quantity: number;
  reason: string;
  refund_amount: number;
  condition: string | null;
  condition_notes: string | null;
  order_items?: OrderItemRelation | OrderItemRelation[] | null;
};

type ReturnDetail = {
  id: string;
  return_number: string;
  order_id: string;
  email: string;
  status: string;
  total_refund_amount: number;
  additional_info: string | null;
  rejection_reason: string | null;
  return_tracking_number: string | null;
  return_label_url: string | null;
  created_at: string;
  reviewed_at: string | null;
  completed_at: string | null;
  orders?: OrderRelation | OrderRelation[] | null;
  return_request_items?: ReturnRequestItemRow[] | null;
};

export default function ReturnDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [data, setData] = useState<ReturnDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/returns/${id}`);
        if (cancelled) return;
        if (!res.ok) {
          if (res.status === 404) {
            setData(null);
            return;
          }
          throw new Error('Failed to load return');
        }
        const json = await res.json();
        setData(json);
      } catch {
        setData(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-48 bg-dark-2 border border-dark-4 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <Link href="/returns" className="inline-flex items-center gap-2 text-gray-5 hover:text-white">
          <HiOutlineArrowLeft className="w-4 h-4" />
          Back to Returns
        </Link>
        <div className="text-center py-12">
          <p className="text-gray-5">Return not found</p>
          <Link href="/returns">
            <Button variant="outline" className="mt-4">
              Back to Returns
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const order = Array.isArray(data.orders) ? data.orders[0] : data.orders;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/returns"
            className="inline-flex items-center gap-2 text-gray-5 hover:text-white transition-colors"
          >
            <HiOutlineArrowLeft className="w-4 h-4" />
            Back to Returns
          </Link>
          <div>
            <h1 className="font-heading text-xl md:text-2xl text-gray-1 tracking-wider">
              Return {data.return_number}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <ReturnStatusBadge status={data.status} />
              <span className="text-gray-5 text-sm">
                Created {format(new Date(data.created_at), 'MMM d, yyyy HH:mm')}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HiOutlineDocumentText className="w-5 h-5" />
              Return summary
            </CardTitle>
          </CardHeader>
          <div className="p-6 pt-0 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-5">Refund amount</span>
              <span className="font-medium text-gray-1">{formatCurrency(Number(data.total_refund_amount) || 0)}</span>
            </div>
            {data.additional_info && (
              <div>
                <span className="text-gray-5 block mb-1">Additional info</span>
                <p className="text-gray-1">{data.additional_info}</p>
              </div>
            )}
            {data.rejection_reason && (
              <div>
                <span className="text-gray-5 block mb-1">Rejection reason</span>
                <p className="text-red-400">{data.rejection_reason}</p>
              </div>
            )}
            {data.return_tracking_number && (
              <div>
                <span className="text-gray-5 block mb-1">Return tracking</span>
                {data.return_label_url ? (
                  <a
                    href={data.return_label_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-main-1 hover:underline inline-flex items-center gap-1"
                  >
                    {data.return_tracking_number} <HiOutlineExternalLink className="w-4 h-4" />
                  </a>
                ) : (
                  <span className="text-gray-1 font-mono">{data.return_tracking_number}</span>
                )}
              </div>
            )}
            {data.reviewed_at && (
              <div className="text-gray-5 text-xs">
                Reviewed {format(new Date(data.reviewed_at), 'MMM d, yyyy')}
              </div>
            )}
            {data.completed_at && (
              <div className="text-gray-5 text-xs">
                Completed {format(new Date(data.completed_at), 'MMM d, yyyy')}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HiOutlineShoppingCart className="w-5 h-5" />
              Order
            </CardTitle>
          </CardHeader>
          <div className="p-6 pt-0 space-y-3 text-sm">
            {order ? (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-5">Order #</span>
                  <span className="font-medium text-gray-1">#{order.order_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-5">Total</span>
                  <span className="text-gray-1">{formatCurrency(Number(order.total) || 0)}</span>
                </div>
                {order.created_at && (
                  <div className="flex justify-between">
                    <span className="text-gray-5">Date</span>
                    <span className="text-gray-1">{format(new Date(order.created_at), 'MMM d, yyyy')}</span>
                  </div>
                )}
                <Link href={`/orders/${data.order_id}`}>
                  <Button variant="secondary" size="sm" className="mt-2">
                    View order <HiOutlineExternalLink className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </>
            ) : (
              <p className="text-gray-5">Order data not available</p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HiOutlineMail className="w-5 h-5" />
              Customer
            </CardTitle>
          </CardHeader>
          <div className="p-6 pt-0 text-sm">
            <p className="text-gray-1">{data.email}</p>
            {order?.shipping_name && (
              <p className="text-gray-5 mt-1">{order.shipping_name}</p>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HiOutlineCube className="w-5 h-5" />
            Items
          </CardTitle>
          <CardDescription>
            {data.return_request_items?.length ?? 0} item(s) in this return
          </CardDescription>
        </CardHeader>
        <div className="p-6 pt-0">
          {!data.return_request_items?.length ? (
            <p className="text-gray-5 text-sm">No items</p>
          ) : (
            <div className="space-y-4">
              {data.return_request_items.map((item) => {
                const oi = Array.isArray(item.order_items) ? item.order_items[0] : item.order_items;
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-4 py-3 border-b border-dark-4 last:border-0"
                  >
                    {oi?.product_image && (
                      <div className="relative w-14 h-14 bg-dark-3 rounded flex-shrink-0">
                        <Image
                          src={oi.product_image}
                          alt={oi.product_name || 'Product'}
                          fill
                          className="object-contain rounded p-1"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-1">{oi?.product_name || 'Product'}</p>
                      {oi?.variant_name && (
                        <p className="text-xs text-gray-5">Variant: {oi.variant_name}</p>
                      )}
                      <p className="text-xs text-gray-5 mt-1">Qty: {item.quantity} · Reason: {item.reason}</p>
                      {item.condition && (
                        <p className="text-xs text-gray-5">Condition: {item.condition}</p>
                      )}
                      {item.condition_notes && (
                        <p className="text-xs text-gray-5">Notes: {item.condition_notes}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-medium text-gray-1">{formatCurrency(Number(item.refund_amount) || 0)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
