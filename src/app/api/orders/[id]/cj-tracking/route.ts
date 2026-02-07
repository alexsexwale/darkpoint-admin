import { NextResponse } from 'next/server';
import { refreshOrderTracking } from '@/lib/orderTracking';

export type OrderTrackingStage =
  | 'processing'
  | 'dispatched'
  | 'en_route'
  | 'arrived_courier_facility'
  | 'out_for_delivery'
  | 'available_for_pickup'
  | 'unsuccessful_delivery'
  | 'delivered';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await context.params;
    if (!orderId) {
      return NextResponse.json({ success: false, error: 'Order ID required' }, { status: 400 });
    }

    const result = await refreshOrderTracking(orderId);

    if (!result.success) {
      const isNoTracking = result.error?.includes('No tracking number yet');
      return NextResponse.json(
        { success: false, error: result.error },
        { status: isNoTracking ? 200 : 502 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      trackNumber: result.trackNumber,
      trackingUrl: result.trackingUrl,
      saved: result.saved,
    });
  } catch (err) {
    console.error('CJ tracking API error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
