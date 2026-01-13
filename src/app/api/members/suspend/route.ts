import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { env } from '@/config/env';

export async function POST(request: NextRequest) {
  try {
    const { userId, suspend, reason } = await request.json();

    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID required' }, { status: 400 });
    }

    // Check if service role key is configured
    const serviceRoleKey = env.supabase.serviceRoleKey;
    if (!serviceRoleKey || serviceRoleKey.length < 100) {
      console.error('Service role key appears invalid. Length:', serviceRoleKey?.length || 0);
      return NextResponse.json({ 
        success: false, 
        error: 'Service role key not configured. Please set SUPABASE_SERVICE_ROLE_KEY in .env.local' 
      }, { status: 500 });
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

    // First check if the is_suspended column exists by selecting it
    const { data: existingUser, error: fetchError } = await supabase
      .from('user_profiles')
      .select('id, is_suspended, suspended_at, suspension_reason')
      .eq('id', userId)
      .single();

    if (fetchError) {
      console.error('Fetch error:', fetchError);
      // Check if column doesn't exist
      if (fetchError.message?.includes('is_suspended') || fetchError.code === '42703') {
        return NextResponse.json({ 
          success: false, 
          error: 'Column is_suspended does not exist. Please run migration 055_user_suspension.sql in Supabase SQL Editor.' 
        }, { status: 500 });
      }
      return NextResponse.json({ success: false, error: 'User not found: ' + fetchError.message }, { status: 404 });
    }

    if (!existingUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    console.log(`User ${userId} current state:`, existingUser);
    console.log(`Attempting to set is_suspended to ${suspend}`);

    // Update user profile using service role (bypasses RLS)
    const updatePayload = {
      is_suspended: suspend,
      suspended_at: suspend ? new Date().toISOString() : null,
      suspended_by: suspend ? adminId : null,
      suspension_reason: suspend ? (reason || 'No reason provided') : null,
    };
    
    console.log('Update payload:', updatePayload);

    const { error: updateError, count } = await supabase
      .from('user_profiles')
      .update(updatePayload)
      .eq('id', userId);

    console.log('Update result - error:', updateError, 'count:', count);

    if (updateError) {
      console.error('Suspension update error:', updateError);
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
    }

    // Verify the update took effect by fetching the user again
    const { data: verifyData, error: verifyError } = await supabase
      .from('user_profiles')
      .select('id, is_suspended, suspended_at, suspension_reason')
      .eq('id', userId)
      .single();

    console.log('Verification - data:', verifyData, 'error:', verifyError);

    if (verifyError) {
      console.error('Verification error:', verifyError);
    }
    
    // Check if update worked
    if (verifyData?.is_suspended !== suspend) {
      console.error('Update did not take effect!');
      console.error('Expected is_suspended:', suspend);
      console.error('Got is_suspended:', verifyData?.is_suspended);
      console.error('This usually means the service role key is wrong (using anon key instead)');
      return NextResponse.json({ 
        success: false, 
        error: 'Update failed. Please verify SUPABASE_SERVICE_ROLE_KEY is the service_role key (not anon key) from Supabase Dashboard > Settings > API.' 
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

