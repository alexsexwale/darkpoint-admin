'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  HiOutlineArrowLeft,
  HiOutlineUser,
  HiOutlineMail,
  HiOutlineKey,
  HiOutlineShieldCheck,
} from 'react-icons/hi';
import { 
  Card, 
  CardHeader, 
  CardTitle,
  CardDescription,
  Button, 
  Input,
} from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';

export default function ProfilePage() {
  const { user } = useAuthStore();
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setMessage({ type: 'error', text: error.message });
      } else {
        setMessage({ type: 'success', text: 'Password updated successfully!' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setIsChangingPassword(false);
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update password' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link 
          href="/settings"
          className="p-2 rounded-lg text-gray-5 hover:bg-dark-3 hover:text-gray-1 transition-colors"
        >
          <HiOutlineArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-heading text-xl md:text-2xl text-gray-1 tracking-wider">Profile</h1>
          <p className="text-gray-5 text-xs md:text-sm mt-1">
            Manage your admin account
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Profile Info */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-main-1/20 rounded-lg">
                <HiOutlineUser className="w-5 h-5 text-main-1" />
              </div>
              <div>
                <CardTitle>Account Information</CardTitle>
                <CardDescription>Your admin account details</CardDescription>
              </div>
            </div>
          </CardHeader>
          <div className="space-y-4">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-main-1 to-amber-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-2xl md:text-3xl">
                  {user?.email?.charAt(0).toUpperCase() || 'A'}
                </span>
              </div>
              <div>
                <p className="text-lg font-medium text-gray-1">
                  {user?.email?.split('@')[0] || 'Admin'}
                </p>
                <p className="text-sm text-gray-5">{user?.email}</p>
              </div>
            </div>

            <div className="border-t border-dark-4 pt-4 space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <HiOutlineMail className="w-4 h-4 text-gray-5" />
                <span className="text-gray-5">Email:</span>
                <span className="text-gray-1">{user?.email}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <HiOutlineShieldCheck className="w-4 h-4 text-gray-5" />
                <span className="text-gray-5">Role:</span>
                <span className="text-gray-1 capitalize">{user?.role?.replace('_', ' ') || 'Admin'}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Change Password */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <HiOutlineKey className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <CardTitle>Security</CardTitle>
                <CardDescription>Manage your password</CardDescription>
              </div>
            </div>
          </CardHeader>
          
          {message && (
            <div className={`mb-4 p-3 rounded-lg text-sm ${
              message.type === 'success' 
                ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                : 'bg-red-500/20 text-red-400 border border-red-500/30'
            }`}>
              {message.text}
            </div>
          )}

          {isChangingPassword ? (
            <form onSubmit={handleChangePassword} className="space-y-4">
              <Input
                label="New Password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                required
              />
              <Input
                label="Confirm New Password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
              />
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setIsChangingPassword(false);
                    setNewPassword('');
                    setConfirmPassword('');
                    setMessage(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" isLoading={isSaving}>
                  Update Password
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-5">
                Your password was last changed recently. It&apos;s recommended to change your password periodically for security.
              </p>
              <Button 
                variant="secondary"
                onClick={() => setIsChangingPassword(true)}
                leftIcon={<HiOutlineKey className="w-4 h-4" />}
              >
                Change Password
              </Button>
            </div>
          )}
        </Card>

        {/* Session Info */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Active Session</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-4">
                  <th className="text-left py-2 px-3 text-gray-5 font-normal">Device</th>
                  <th className="text-left py-2 px-3 text-gray-5 font-normal">Location</th>
                  <th className="text-left py-2 px-3 text-gray-5 font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-3 px-3 text-gray-1">Current Browser</td>
                  <td className="py-3 px-3 text-gray-1">Current Session</td>
                  <td className="py-3 px-3">
                    <span className="inline-flex items-center gap-1.5 text-green-400">
                      <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                      Active
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

