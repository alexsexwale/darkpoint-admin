import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// POST - Mark all notifications as read
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();

    const { error } = await supabase
      .from('admin_notifications')
      .update({ is_read: true })
      .eq('is_read', false);

    if (error) {
      console.error('Error marking all as read:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Mark all read error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to mark all as read' },
      { status: 500 }
    );
  }
}

