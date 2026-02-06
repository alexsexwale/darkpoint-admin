import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { cjDropshipping } from '@/lib/cjdropshipping';

const COUNTRY_CODE_MAP: Record<string, string> = {
  'South Africa': 'ZA', 'south africa': 'ZA', 'SA': 'ZA', 'ZA': 'ZA', 'RSA': 'ZA',
  'United States': 'US', 'United States of America': 'US', 'USA': 'US', 'US': 'US', 'America': 'US',
  'United Kingdom': 'GB', 'UK': 'GB', 'GB': 'GB', 'Great Britain': 'GB', 'England': 'GB',
  'Canada': 'CA', 'CA': 'CA', 'Australia': 'AU', 'AU': 'AU', 'Germany': 'DE', 'DE': 'DE',
  'France': 'FR', 'FR': 'FR', 'Netherlands': 'NL', 'NL': 'NL', 'Nigeria': 'NG', 'NG': 'NG',
  'Kenya': 'KE', 'KE': 'KE', 'Ghana': 'GH', 'GH': 'GH', 'Zimbabwe': 'ZW', 'ZW': 'ZW',
  'Botswana': 'BW', 'BW': 'BW', 'Namibia': 'NA', 'NA': 'NA', 'Mozambique': 'MZ', 'MZ': 'MZ',
};

function getOrderCountryCode(order: { shipping_country?: string | null; billing_country?: string | null }): string {
  const raw = String(order.shipping_country ?? order.billing_country ?? '').trim();
  let code = COUNTRY_CODE_MAP[raw] || COUNTRY_CODE_MAP[raw.toLowerCase()];
  if (!code && raw.length === 2) code = raw.toUpperCase();
  if (!code || code.length !== 2) code = 'ZA';
  return code;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await context.params;
    if (!orderId) {
      return NextResponse.json({ success: false, error: 'Order ID required' }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, total, shipping_country, billing_country, order_items(*)')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    const items = order.order_items as Array<{ product_id: string; variant_id: string | null; quantity: number }> | null;
    if (!items?.length) {
      return NextResponse.json({ success: false, error: 'Order has no items' }, { status: 400 });
    }

    const productIds = [...new Set(items.map((i) => i.product_id))];
    const { data: byIdRows } = await supabase
      .from('admin_products')
      .select('id, base_price')
      .in('id', productIds);
    const { data: byCjIdRows } = await supabase
      .from('admin_products')
      .select('cj_product_id, base_price')
      .in('cj_product_id', productIds);

    const costById = new Map<string, number>();
    if (byIdRows) for (const p of byIdRows) { if (p.base_price != null) costById.set(p.id, Number(p.base_price)); }
    if (byCjIdRows) for (const p of byCjIdRows) { if (p.cj_product_id && p.base_price != null) costById.set(p.cj_product_id, Number(p.base_price)); }

    let cjProductCostUsd: number | null = null;
    let sum = 0;
    for (const item of items) {
      const cost = costById.get(item.product_id) ?? null;
      if (cost == null) {
        sum = -1;
        break;
      }
      sum += cost * item.quantity;
    }
    if (sum >= 0) cjProductCostUsd = sum;

    const products = items.map((item) => ({
      vid: item.variant_id || item.product_id,
      quantity: item.quantity,
    }));
    const endCountryCode = getOrderCountryCode(order);

    const result = await cjDropshipping.getShippingMethodsForOrder({
      products,
      endCountryCode,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, data: [], error: result.error || 'Failed to fetch shipping options' },
        { status: 500 }
      );
    }

    const orderTotalZar = Number(order.total) || 0;
    return NextResponse.json({
      success: true,
      data: result.data ?? [],
      orderTotalZar,
      cjProductCostUsd: cjProductCostUsd ?? null,
    });
  } catch (error) {
    console.error('CJ shipping options error:', error);
    return NextResponse.json(
      { success: false, data: [], error: error instanceof Error ? error.message : 'Failed to fetch shipping options' },
      { status: 500 }
    );
  }
}
