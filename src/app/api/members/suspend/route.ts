import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { userId, suspend, reason } = await request.json();

    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID required' }, { status: 400 });
    }

    let supabase;
    try {
      supabase = createServerClient();
    } catch (err) {
      console.error('Failed to create Supabase client:', err);
      return NextResponse.json({ 
        success: false, 
        error: 'Server configuration error. Please check SUPABASE_SERVICE_ROLE_KEY.' 
      }, { status: 500 });
    }

    // Get current admin user from auth header or session
    const authHeader = request.headers.get('authorization');
    let adminId: string | null = null;
    
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: { user } } = await supabase.auth.getUser(token);
      adminId = user?.id || null;
    }

    // First verify the user exists
    const { data: existingUser, error: fetchError } = await supabase
      .from('user_profiles')
      .select('id, is_suspended')
      .eq('id', userId)
      .single();

    if (fetchError || !existingUser) {
      console.error('User not found:', fetchError);
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    console.log(`Attempting to ${suspend ? 'suspend' : 'unsuspend'} user ${userId}. Current status:`, existingUser.is_suspended);

    // Update user profile using service role (bypasses RLS)
    const { data: updateData, error: updateError } = await supabase
      .from('user_profiles')
      .update({
        is_suspended: suspend,
        suspended_at: suspend ? new Date().toISOString() : null,
        suspended_by: suspend ? adminId : null,
        suspension_reason: suspend ? (reason || 'No reason provided') : null,
      })
      .eq('id', userId)
      .select('id, is_suspended')
      .single();

    if (updateError) {
      console.error('Suspension update error:', updateError);
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
    }

    console.log('Update result:', updateData);

    // Verify the update took effect
    if (updateData?.is_suspended !== suspend) {
      console.error('Update did not take effect. Expected:', suspend, 'Got:', updateData?.is_suspended);
      return NextResponse.json({ 
        success: false, 
        error: 'Update failed to persist. This may be a database permission issue.' 
      }, { status: 500 });
    }

    // Log the action (best effort, don't fail if this errors)
    try {
      await supabase
        .from('suspension_log')
        .insert({
          user_id: userId,
          action: suspend ? 'suspend' : 'unsuspend',
          reason: reason || null,
          admin_id: adminId,
        });
    } catch (logError) {
      console.error('Suspension log error (non-fatal):', logError);
    }

    return NextResponse.json({ 
      success: true, 
      message: suspend ? 'User suspended successfully' : 'User unsuspended successfully' 
    });
  } catch (error) {
    console.error('Suspension error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Suspension failed' },
      { status: 500 }
    );
  }
}

