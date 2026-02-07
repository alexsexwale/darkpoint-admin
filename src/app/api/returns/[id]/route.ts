import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: 'Return ID required' }, { status: 400 });
    }

    const supabase = createServerClient();

    const { data, error } = await supabase
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
          billing_name,
          billing_email
        ),
        return_request_items (
          id,
          quantity,
          reason,
          refund_amount,
          condition,
          condition_notes,
          order_items (
            id,
            product_name,
            product_image,
            variant_name,
            unit_price
          )
        )
      `
      )
      .eq('id', id)
      .single();

    if (error || !data) {
      if (error?.code === 'PGRST116') {
        return NextResponse.json({ error: 'Return not found' }, { status: 404 });
      }
      console.error('API return detail error:', error);
      return NextResponse.json({ error: error?.message || 'Not found' }, { status: error ? 500 : 404 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('API return detail error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
