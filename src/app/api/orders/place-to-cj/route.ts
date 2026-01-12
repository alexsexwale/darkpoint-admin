import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { cjDropshipping } from '@/lib/cjdropshipping';

export async function POST(request: NextRequest) {
  try {
    const { orderId } = await request.json();

    if (!orderId) {
      return NextResponse.json({ success: false, error: 'Order ID required' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Fetch order with items
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (*)
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    // Check if already placed
    const { data: existingCJOrder } = await supabase
      .from('cj_orders')
      .select('id')
      .eq('order_id', orderId)
      .single();

    if (existingCJOrder) {
      return NextResponse.json({ success: false, error: 'Order already placed to CJ' }, { status: 400 });
    }

    // Check payment status
    if (order.payment_status !== 'paid') {
      return NextResponse.json({ success: false, error: 'Order not paid' }, { status: 400 });
    }

    // Prepare CJ order data
    const cjProducts = order.order_items.map((item: { product_id: string; variant_id: string | null; quantity: number }) => ({
      vid: item.variant_id || item.product_id,
      quantity: item.quantity,
    }));

    // Map country to CJ country code (simplified - expand as needed)
    const countryCodeMap: Record<string, string> = {
      'South Africa': 'ZA',
      'SA': 'ZA',
      'United States': 'US',
      'USA': 'US',
      'United Kingdom': 'GB',
      'UK': 'GB',
    };

    const countryCode = countryCodeMap[order.shipping_country || ''] || 'ZA';

    // Create order with CJ
    const cjResult = await cjDropshipping.createOrder({
      orderNumber: order.order_number,
      shippingAddress: {
        countryCode,
        province: order.shipping_province || '',
        city: order.shipping_city || '',
        address: `${order.shipping_address_line1 || ''} ${order.shipping_address_line2 || ''}`.trim(),
        zip: order.shipping_postal_code || '',
        phone: order.shipping_phone || '',
        fullName: order.shipping_name || '',
      },
      products: cjProducts,
      remark: order.customer_notes || '',
    });

    if (!cjResult.success) {
      // Log the error but still create a tracking record
      console.error('CJ order placement failed:', cjResult.error);
      
      // Create CJ order record with error
      await supabase.from('cj_orders').insert({
        order_id: orderId,
        cj_status: 'failed',
        error_message: cjResult.error,
        created_at: new Date().toISOString(),
      });

      return NextResponse.json({ success: false, error: cjResult.error }, { status: 500 });
    }

    // Create CJ order record
    const { error: insertError } = await supabase.from('cj_orders').insert({
      order_id: orderId,
      cj_order_id: cjResult.data?.orderId,
      cj_order_number: cjResult.data?.orderNumber,
      cj_status: cjResult.data?.orderStatus || 'Created',
      cj_tracking_number: cjResult.data?.trackingNumber,
      cj_logistic_name: cjResult.data?.logisticName,
      placed_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
    });

    if (insertError) {
      console.error('Error saving CJ order record:', insertError);
    }

    // Update main order status to processing
    await supabase
      .from('orders')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', orderId);

    return NextResponse.json({
      success: true,
      data: {
        cjOrderId: cjResult.data?.orderId,
        cjStatus: cjResult.data?.orderStatus,
      },
    });
  } catch (error) {
    console.error('Place to CJ error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

