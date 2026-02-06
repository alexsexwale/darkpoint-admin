import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

/**
 * Cron: delete orders that are still pending (status + payment) and older than 15 minutes.
 * Vercel Cron calls this every 15 minutes when CRON_SECRET is set.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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
        { error: selectError.message, deleted: 0 },
        { status: 500 }
      );
    }

    if (!staleOrders?.length) {
      return NextResponse.json({ deleted: 0 });
    }

    const ids = staleOrders.map((r) => r.id);
    const { error: deleteError } = await supabase.from('orders').delete().in('id', ids);

    if (deleteError) {
      console.error('Cleanup stale orders delete error:', deleteError);
      return NextResponse.json(
        { error: deleteError.message, deleted: 0 },
        { status: 500 }
      );
    }

    return NextResponse.json({ deleted: ids.length });
  } catch (err) {
    console.error('Cleanup stale orders error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error', deleted: 0 },
      { status: 500 }
    );
  }
}
