'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  HiOutlineSearch,
  HiOutlineShoppingCart,
  HiOutlineUserCircle,
  HiOutlineCube,
  HiOutlineArrowRight,
} from 'react-icons/hi';
import { Card, CardHeader, CardTitle, OrderStatusBadge } from '@/components/ui';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function SearchContent() {
  const searchParams = useSearchParams();
  const q = searchParams.get('q') || '';

  const [results, setResults] = useState<{
    orders: Array<{ id: string; order_number: string; status: string; total: number; created_at: string; shipping_name?: string; billing_email?: string }>;
    members: Array<{ id: string; email: string | null; username: string | null; display_name: string | null; created_at: string }>;
    products: Array<{ id: string; name: string; sell_price?: number; is_active?: boolean; created_at: string }>;
  }>({ orders: [], members: [], products: [] });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!q.trim()) {
      setResults({ orders: [], members: [], products: [] });
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
        if (cancelled) return;
        const data = await res.json();
        setResults({
          orders: data.orders ?? [],
          members: data.members ?? [],
          products: data.products ?? [],
        });
      } catch {
        if (!cancelled) setResults({ orders: [], members: [], products: [] });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [q]);

  if (!q.trim()) {
    return (
      <div className="space-y-6">
        <h1 className="font-heading text-xl md:text-2xl text-gray-1 tracking-wider">Search</h1>
        <p className="text-gray-5 text-sm">Enter a search term in the header to find orders, members, and products.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="font-heading text-xl md:text-2xl text-gray-1 tracking-wider">Search</h1>
        <p className="text-gray-5 text-sm">Searching for &quot;{q}&quot;...</p>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-dark-2 border border-dark-4 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const hasAny = results.orders.length > 0 || results.members.length > 0 || results.products.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <HiOutlineSearch className="w-6 h-6 text-main-1 flex-shrink-0" />
        <div>
          <h1 className="font-heading text-xl md:text-2xl text-gray-1 tracking-wider">Search results</h1>
          <p className="text-gray-5 text-sm mt-0.5">Results for &quot;{q}&quot;</p>
        </div>
      </div>

      {!hasAny ? (
        <Card className="p-8 text-center">
          <p className="text-gray-5">No orders, members, or products match your search.</p>
          <p className="text-gray-5 text-sm mt-2">Try a different term or check spelling.</p>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <HiOutlineShoppingCart className="w-5 h-5 text-green-400" />
                Orders
              </CardTitle>
              {results.orders.length > 0 && (
                <Link
                  href={`/orders?q=${encodeURIComponent(q)}`}
                  className="text-xs text-main-1 hover:underline"
                >
                  View all
                </Link>
              )}
            </CardHeader>
            <div className="divide-y divide-dark-4">
              {results.orders.length === 0 ? (
                <p className="py-4 text-sm text-gray-5">No matching orders</p>
              ) : (
                results.orders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/orders/${order.id}`}
                    className="flex items-center justify-between gap-2 py-3 first:pt-0 hover:bg-dark-3/50 transition-colors -mx-4 px-4"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-gray-1 truncate">#{order.order_number}</p>
                      <p className="text-xs text-gray-5 truncate">{order.shipping_name || order.billing_email || '—'}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <OrderStatusBadge status={order.status} />
                      <span className="text-sm text-gray-1">{formatCurrency(order.total ?? 0)}</span>
                      <HiOutlineArrowRight className="w-4 h-4 text-gray-5" />
                    </div>
                  </Link>
                ))
              )}
            </div>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <HiOutlineUserCircle className="w-5 h-5 text-blue-400" />
                Members
              </CardTitle>
              {results.members.length > 0 && (
                <Link
                  href={`/members?q=${encodeURIComponent(q)}`}
                  className="text-xs text-main-1 hover:underline"
                >
                  View all
                </Link>
              )}
            </CardHeader>
            <div className="divide-y divide-dark-4">
              {results.members.length === 0 ? (
                <p className="py-4 text-sm text-gray-5">No matching members</p>
              ) : (
                results.members.map((member) => (
                  <Link
                    key={member.id}
                    href={`/members/${member.id}`}
                    className="flex items-center justify-between gap-2 py-3 first:pt-0 hover:bg-dark-3/50 transition-colors -mx-4 px-4"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-gray-1 truncate">
                        {member.display_name || member.username || member.email || '—'}
                      </p>
                      <p className="text-xs text-gray-5 truncate">{member.email || '—'}</p>
                    </div>
                    <HiOutlineArrowRight className="w-4 h-4 text-gray-5 flex-shrink-0" />
                  </Link>
                ))
              )}
            </div>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <HiOutlineCube className="w-5 h-5 text-amber-400" />
                Products
              </CardTitle>
              {results.products.length > 0 && (
                <Link
                  href={`/products?q=${encodeURIComponent(q)}`}
                  className="text-xs text-main-1 hover:underline"
                >
                  View all
                </Link>
              )}
            </CardHeader>
            <div className="divide-y divide-dark-4">
              {results.products.length === 0 ? (
                <p className="py-4 text-sm text-gray-5">No matching products</p>
              ) : (
                results.products.map((product) => (
                  <Link
                    key={product.id}
                    href={`/products/${product.id}`}
                    className="flex items-center justify-between gap-2 py-3 first:pt-0 hover:bg-dark-3/50 transition-colors -mx-4 px-4"
                  >
                    <p className="font-medium text-gray-1 truncate flex-1">{product.name}</p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {product.sell_price != null && (
                        <span className="text-sm text-gray-1">{formatCurrency(product.sell_price)}</span>
                      )}
                      <HiOutlineArrowRight className="w-4 h-4 text-gray-5" />
                    </div>
                  </Link>
                ))
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="h-8 w-48 bg-dark-3 rounded animate-pulse" />
          <div className="h-64 bg-dark-2 border border-dark-4 rounded-lg animate-pulse" />
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
