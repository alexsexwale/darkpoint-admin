import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

const LIMIT_PER_TYPE = 8;

export async function GET(request: NextRequest) {
  try {
    const q = (request.nextUrl.searchParams.get('q') || '').trim();
    if (!q) {
      return NextResponse.json({ orders: [], members: [], products: [] });
    }

    const supabase = createServerClient();
    const pattern = `%${q}%`;

    const [ordersRes, membersRes, productsRes] = await Promise.all([
      supabase
        .from('orders')
        .select('id, order_number, status, total, created_at, shipping_name, billing_email')
        .or(`order_number.ilike.${pattern},shipping_name.ilike.${pattern},billing_email.ilike.${pattern}`)
        .order('created_at', { ascending: false })
        .limit(LIMIT_PER_TYPE),
      supabase
        .from('user_profiles')
        .select('id, email, username, display_name, created_at')
        .or(`email.ilike.${pattern},username.ilike.${pattern},display_name.ilike.${pattern}`)
        .order('created_at', { ascending: false })
        .limit(LIMIT_PER_TYPE),
      supabase
        .from('admin_products')
        .select('id, name, sell_price, is_active, created_at')
        .ilike('name', pattern)
        .order('created_at', { ascending: false })
        .limit(LIMIT_PER_TYPE),
    ]);

    return NextResponse.json({
      orders: ordersRes.data || [],
      members: membersRes.data || [],
      products: productsRes.data || [],
    });
  } catch (err) {
    console.error('Search API error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Search failed', orders: [], members: [], products: [] },
      { status: 500 }
    );
  }
}
