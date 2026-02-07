import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { refreshOrderTracking } from '@/lib/orderTracking';

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
        { error: selectError.message, deleted: 0, trackingUpdated: 0 },
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
          { error: deleteError.message, deleted: 0, trackingUpdated: 0 },
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
    if (!trackingSelectError && trackingOrders?.length) {
      for (const row of trackingOrders) {
        try {
          const result = await refreshOrderTracking(row.id);
          if (result.success) trackingUpdated += 1;
        } catch (err) {
          console.error('Cron refreshOrderTracking failed for order', row.id, err);
        }
      }
    }

    return NextResponse.json({ deleted, trackingUpdated });
  } catch (err) {
    console.error('Cleanup stale orders error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error', deleted: 0, trackingUpdated: 0 },
      { status: 500 }
    );
  }
}
