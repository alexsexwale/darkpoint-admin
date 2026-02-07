import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '25', 10)));
    const status = searchParams.get('status') || '';
    const q = (searchParams.get('q') || '').trim();

    const supabase = createServerClient();

    let orderIds: string[] = [];
    if (q) {
      const { data: orders } = await supabase
        .from('orders')
        .select('id')
        .ilike('order_number', `%${q}%`);
      orderIds = (orders || []).map((o: { id: string }) => o.id);
    }

    let query = supabase
      .from('return_requests')
      .select(
        `
        *,
        orders (
          id,
          order_number,
          total,
          status,
          created_at,
          shipping_name,
          billing_email
        )
      `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (status) {
      query = query.eq('status', status);
    }
    if (q) {
      const orParts = [`return_number.ilike.%${q}%`, `email.ilike.%${q}%`];
      if (orderIds.length > 0) {
        orParts.push(`order_id.in.(${orderIds.join(',')})`);
      }
      query = query.or(orParts.join(','));
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('API returns list error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data || [], count: count ?? 0 });
  } catch (err) {
    console.error('API returns list error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
