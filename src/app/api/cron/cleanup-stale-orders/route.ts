import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import {
  refreshOrderTracking,
  mapTrackingStageToOrderStatus,
  isForwardStatusTransition,
} from '@/lib/orderTracking';
import { sendOrderStatusEmail } from '@/lib/orderStatusEmail';
import type { OrderStatus } from '@/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const TRACKING_BATCH_LIMIT = 50;

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient();
    const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    const { data: staleOrders, error: selectError } = await supabase
      .from('orders')
      .select('id')
      .eq('status', 'pending')
      .eq('payment_status', 'pending')
      .lt('created_at', cutoff);

    if (selectError) {
      console.error('Cleanup stale orders select error:', selectError);
      return NextResponse.json(
        { error: selectError.message, deleted: 0, trackingUpdated: 0, statusEmailsSent: 0, abandonedCartSent: 0 },
        { status: 500 }
      );
    }

    let deleted = 0;
    if (staleOrders?.length) {
      const ids = staleOrders.map((r) => r.id);
      const { error: deleteError } = await supabase.from('orders').delete().in('id', ids);
      if (deleteError) {
        console.error('Cleanup stale orders delete error:', deleteError);
        return NextResponse.json(
          { error: deleteError.message, deleted: 0, trackingUpdated: 0, statusEmailsSent: 0, abandonedCartSent: 0 },
          { status: 500 }
        );
      }
      deleted = ids.length;
    }

    // Refresh order tracking for orders with status processing or shipped (only; ignore all other statuses)
    const { data: trackingOrders, error: trackingSelectError } = await supabase
      .from('orders')
      .select('id')
      .in('status', ['processing', 'shipped'])
      .limit(TRACKING_BATCH_LIMIT);

    let trackingUpdated = 0;
    let statusEmailsSent = 0;
    if (!trackingSelectError && trackingOrders?.length) {
      for (const row of trackingOrders) {
        try {
          const result = await refreshOrderTracking(row.id);
          if (result.success) {
            trackingUpdated += 1;
            const newOrderStatus = mapTrackingStageToOrderStatus(result.trackingStage ?? null);
            if (newOrderStatus === null) continue;
            const { data: order } = await supabase
              .from('orders')
              .select('id, status, shipped_at, delivered_at')
              .eq('id', row.id)
              .single();
            if (!order) continue;
            const currentStatus = (order as { status: string }).status;
            if (
              newOrderStatus !== currentStatus &&
              isForwardStatusTransition(currentStatus as OrderStatus, newOrderStatus as OrderStatus)
            ) {
              const updates: Record<string, unknown> = {
                status: newOrderStatus,
                updated_at: new Date().toISOString(),
              };
              if (
                newOrderStatus === 'shipped' &&
                !(order as { shipped_at?: string | null }).shipped_at
              ) {
                updates.shipped_at = new Date().toISOString();
              }
              if (
                newOrderStatus === 'delivered' &&
                !(order as { delivered_at?: string | null }).delivered_at
              ) {
                updates.delivered_at = new Date().toISOString();
              }
              const { error: updateErr } = await supabase
                .from('orders')
                .update(updates)
                .eq('id', row.id);
              if (!updateErr) {
                const sent = await sendOrderStatusEmail(row.id, newOrderStatus);
                if (sent) statusEmailsSent += 1;
              }
            }
          }
        } catch (err) {
          console.error('Cron refreshOrderTracking failed for order', row.id, err);
        }
      }
    }

    // Trigger abandoned-cart job on main site (no new cron path; reuse this run)
    let abandonedCartSent = 0;
    const mainSiteUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
    if (mainSiteUrl && cronSecret) {
      try {
        const res = await fetch(`${mainSiteUrl}/api/cron/abandoned-cart`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${cronSecret}` },
        });
        if (res.ok) {
          const data = (await res.json()) as { sent?: number };
          abandonedCartSent = data.sent ?? 0;
        } else {
          const text = await res.text();
          console.error('Abandoned cart cron request failed:', res.status, text);
        }
      } catch (err) {
        console.error('Abandoned cart cron request error:', err);
      }
    }

    return NextResponse.json({ deleted, trackingUpdated, statusEmailsSent, abandonedCartSent });
  } catch (err) {
    console.error('Cleanup stale orders error:', err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Unknown error',
        deleted: 0,
        trackingUpdated: 0,
        statusEmailsSent: 0,
        abandonedCartSent: 0,
      },
      { status: 500 }
    );
  }
}
