'use client';

import clsx from 'clsx';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
  dot?: boolean;
}

export function Badge({ children, variant = 'default', className, dot = false }: BadgeProps) {
  const variantClasses: Record<BadgeVariant, string> = {
    default: 'bg-dark-4 text-gray-1',
    success: 'bg-green-500/20 text-green-400',
    warning: 'bg-amber-500/20 text-amber-400',
    danger: 'bg-red-500/20 text-red-400',
    info: 'bg-blue-500/20 text-blue-400',
    primary: 'bg-main-1/20 text-main-1',
  };

  const dotColors: Record<BadgeVariant, string> = {
    default: 'bg-gray-1',
    success: 'bg-green-400',
    warning: 'bg-amber-400',
    danger: 'bg-red-400',
    info: 'bg-blue-400',
    primary: 'bg-main-1',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full uppercase tracking-wide',
        variantClasses[variant],
        className
      )}
    >
      {dot && <span className={clsx('w-1.5 h-1.5 rounded-full', dotColors[variant])} />}
      {children}
    </span>
  );
}

// Order status badge helper
export function OrderStatusBadge({ status }: { status: string }) {
  const variants: Record<string, BadgeVariant> = {
    pending: 'warning',
    processing: 'info',
    shipped: 'primary',
    delivered: 'success',
    cancelled: 'danger',
    refunded: 'default',
  };

  return (
    <Badge variant={variants[status] || 'default'} dot>
      {status}
    </Badge>
  );
}

// Payment status badge helper
export function PaymentStatusBadge({ status }: { status: string }) {
  const variants: Record<string, BadgeVariant> = {
    pending: 'warning',
    paid: 'success',
    failed: 'danger',
    refunded: 'default',
  };

  return (
    <Badge variant={variants[status] || 'default'} dot>
      {status}
    </Badge>
  );
}

// Return request status badge helper
export function ReturnStatusBadge({ status }: { status: string }) {
  const variants: Record<string, BadgeVariant> = {
    pending: 'warning',
    approved: 'info',
    rejected: 'danger',
    in_transit: 'info',
    received: 'primary',
    completed: 'success',
    cancelled: 'default',
  };

  return (
    <Badge variant={variants[status] || 'default'} dot>
      {status.replace(/_/g, ' ')}
    </Badge>
  );
}

// Review status badge helper
export function ReviewStatusBadge({ status }: { status: string }) {
  const variants: Record<string, BadgeVariant> = {
    pending: 'warning',
    published: 'success',
    rejected: 'danger',
  };

  return (
    <Badge variant={variants[status] || 'default'} dot>
      {status}
    </Badge>
  );
}

// VIP tier badge helper
export function VIPTierBadge({ tier }: { tier: string | null }) {
  if (!tier) return null;
  
  const variants: Record<string, BadgeVariant> = {
    bronze: 'primary',
    gold: 'warning',
    platinum: 'info',
  };

  const icons: Record<string, string> = {
    bronze: '🔥',
    gold: '👑',
    platinum: '✨',
  };

  return (
    <Badge variant={variants[tier] || 'default'}>
      {icons[tier]} {tier}
    </Badge>
  );
}

