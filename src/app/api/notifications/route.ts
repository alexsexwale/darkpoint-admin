import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export interface NotificationPayload {
  type: 'order' | 'customer' | 'inventory' | 'system';
  title: string;
  message?: string;
  icon?: string;
  link?: string;
  data?: Record<string, unknown>;
}

// GET - Fetch notifications
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const unreadOnly = searchParams.get('unread') === 'true';

    const supabase = createServerClient();

    let query = supabase
      .from('admin_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (unreadOnly) {
      query = query.eq('is_read', false);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching notifications:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Also get unread count
    const { count: unreadCount } = await supabase
      .from('admin_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('is_read', false);

    return NextResponse.json({
      success: true,
      data,
      unreadCount: unreadCount || 0,
    });
  } catch (error) {
    console.error('Notifications fetch error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

// POST - Create a new notification
export async function POST(request: NextRequest) {
  try {
    const body: NotificationPayload = await request.json();

    if (!body.type || !body.title) {
      return NextResponse.json(
        { success: false, error: 'Type and title are required' },
        { status: 400 }
      );
    }

    // Map type to default icon if not provided
    const defaultIcons: Record<string, string> = {
      order: 'HiOutlineShoppingCart',
      customer: 'HiOutlineUserAdd',
      inventory: 'HiOutlineCube',
      system: 'HiOutlineCog',
    };

    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('admin_notifications')
      .insert({
        type: body.type,
        title: body.title,
        message: body.message || null,
        icon: body.icon || defaultIcons[body.type],
        link: body.link || null,
        data: body.data || {},
        is_read: false,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating notification:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Notification create error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create notification' },
      { status: 500 }
    );
  }
}

