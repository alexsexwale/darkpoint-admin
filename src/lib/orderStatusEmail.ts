import { createServerClient } from '@/lib/supabase';
import { env } from '@/config/env';

/**
 * Load order, resolve customer email, and POST to the store's order-status-email endpoint.
 * Used by PATCH /api/orders/[id]/status and by the cleanup cron when status is synced from tracking.
 */
export async function sendOrderStatusEmail(
  orderId: string,
  newStatus: string
): Promise<boolean> {
  const secret = env.app.orderStatusEmailSecret;
  const storeUrl = (env.app.mainSiteUrl || '').replace(/\/$/, '');
  if (!secret || !storeUrl) return false;

  const supabase = createServerClient();
  const { data: order, error } = await supabase
    .from('orders')
    .select('id, user_id, billing_email, billing_name, order_number')
    .eq('id', orderId)
    .single();

  if (error || !order) return false;

  let customerEmail: string | null = (order as { billing_email?: string | null }).billing_email ?? null;
  const userId = (order as { user_id?: string | null }).user_id;
  if (userId && !customerEmail) {
    const { data: authUser } = await supabase.auth.admin.getUserById(userId);
    customerEmail = authUser?.user?.email ?? null;
  }
  if (!customerEmail) return false;

  const customerName =
    ((order as { billing_name?: string | null }).billing_name || 'Customer').trim() || 'Customer';
  const orderNumber = (order as { order_number: string }).order_number;

  try {
    const res = await fetch(`${storeUrl}/api/internal/order-status-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-order-status-secret': secret,
      },
      body: JSON.stringify({
        orderId,
        orderNumber,
        newStatus,
        customerEmail,
        customerName,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error('Order status email request failed:', res.status, text);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Order status email request error:', err);
    return false;
  }
}
