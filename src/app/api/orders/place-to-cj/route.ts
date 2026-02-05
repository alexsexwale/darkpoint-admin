import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { cjDropshipping } from '@/lib/cjdropshipping';

// Helper to create a notification
async function createNotification(supabase: ReturnType<typeof createServerClient>, payload: {
  type: 'order' | 'customer' | 'inventory' | 'system';
  title: string;
  message?: string;
  icon?: string;
  link?: string;
  data?: Record<string, unknown>;
}) {
  try {
    await supabase.from('admin_notifications').insert({
      type: payload.type,
      title: payload.title,
      message: payload.message || null,
      icon: payload.icon || 'HiOutlineShoppingCart',
      link: payload.link || null,
      data: payload.data || {},
      is_read: false,
    });
  } catch (err) {
    console.error('Failed to create notification:', err);
  }
}

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

    // Map country to CJ country code (comprehensive mapping)
    const countryCodeMap: Record<string, string> = {
      // South Africa variations
      'South Africa': 'ZA',
      'south africa': 'ZA',
      'SA': 'ZA',
      'ZA': 'ZA',
      'RSA': 'ZA',
      // US variations
      'United States': 'US',
      'United States of America': 'US',
      'USA': 'US',
      'US': 'US',
      'America': 'US',
      // UK variations
      'United Kingdom': 'GB',
      'UK': 'GB',
      'GB': 'GB',
      'Great Britain': 'GB',
      'England': 'GB',
      // Other common countries
      'Canada': 'CA',
      'CA': 'CA',
      'Australia': 'AU',
      'AU': 'AU',
      'Germany': 'DE',
      'DE': 'DE',
      'France': 'FR',
      'FR': 'FR',
      'Netherlands': 'NL',
      'NL': 'NL',
      'Nigeria': 'NG',
      'NG': 'NG',
      'Kenya': 'KE',
      'KE': 'KE',
      'Ghana': 'GH',
      'GH': 'GH',
      'Zimbabwe': 'ZW',
      'ZW': 'ZW',
      'Botswana': 'BW',
      'BW': 'BW',
      'Namibia': 'NA',
      'NA': 'NA',
      'Mozambique': 'MZ',
      'MZ': 'MZ',
    };

    // Get country code - use shipping_country or fall back to billing_country; never send empty
    const rawCountry = (order.shipping_country ?? order.billing_country ?? '').trim();
    let countryCode = countryCodeMap[rawCountry] || countryCodeMap[rawCountry.toLowerCase()];

    if (!countryCode && rawCountry.length === 2) {
      countryCode = rawCountry.toUpperCase();
    }
    if (!countryCode || countryCode.length !== 2) {
      console.warn(`Unknown or missing country: "${rawCountry}", defaulting to ZA`);
      countryCode = 'ZA';
    }

    // Validate required shipping fields
    const shippingName = (order.shipping_name || '').trim();
    const shippingCity = (order.shipping_city || '').trim();
    const shippingAddress = `${order.shipping_address_line1 || ''} ${order.shipping_address_line2 || ''}`.trim();
    
    if (!shippingName) {
      return NextResponse.json({ success: false, error: 'Shipping name is required' }, { status: 400 });
    }
    if (!shippingCity) {
      return NextResponse.json({ success: false, error: 'Shipping city is required' }, { status: 400 });
    }
    if (!shippingAddress) {
      return NextResponse.json({ success: false, error: 'Shipping address is required' }, { status: 400 });
    }

    // Create order with CJ
    const cjResult = await cjDropshipping.createOrder({
      orderNumber: order.order_number,
      shippingAddress: {
        countryCode,
        province: (order.shipping_province || shippingCity).trim(), // Fallback to city if province is empty
        city: shippingCity,
        address: shippingAddress,
        zip: (order.shipping_postal_code || '0000').trim(), // Default zip if empty
        phone: (order.shipping_phone || '0000000000').trim(), // Default phone if empty
        fullName: shippingName,
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

      // Create failure notification
      await createNotification(supabase, {
        type: 'order',
        title: 'CJ Order Failed',
        message: `Order #${order.order_number} failed to place with CJ Dropshipping: ${cjResult.error}`,
        icon: 'HiOutlineExclamation',
        link: `/orders/${orderId}`,
        data: { orderId, orderNumber: order.order_number, error: cjResult.error },
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

    // Create success notification
    await createNotification(supabase, {
      type: 'order',
      title: 'Order Placed to CJ',
      message: `Order #${order.order_number} has been successfully placed with CJ Dropshipping`,
      icon: 'HiOutlineCheckCircle',
      link: `/orders/${orderId}`,
        data: { 
        orderId, 
        orderNumber: order.order_number, 
        cjOrderId: cjResult.data?.orderId,
        amount: order.total,
      },
    });

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

