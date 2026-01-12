'use client';

import { useEffect, useState } from 'react';
import { 
  HiOutlineCog,
  HiOutlineTruck,
  HiOutlineCurrencyDollar,
  HiOutlineBell,
  HiOutlineUser,
  HiOutlineKey,
  HiOutlineGlobe,
} from 'react-icons/hi';
import { 
  Card, 
  CardHeader, 
  CardTitle,
  CardDescription,
  Button, 
  Input,
} from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

interface StoreSettings {
  shipping: {
    free_threshold: number;
    flat_rate: number;
    express_rate: number;
  };
  markup: {
    default_percent: number;
    featured_percent: number;
  };
  currency: {
    code: string;
    symbol: string;
    locale: string;
  };
  notifications: {
    low_stock_email: boolean;
    new_order_email: boolean;
  };
}

export default function SettingsPage() {
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<StoreSettings>({
    shipping: { free_threshold: 500, flat_rate: 75, express_rate: 150 },
    markup: { default_percent: 150, featured_percent: 200 },
    currency: { code: 'ZAR', symbol: 'R', locale: 'en-ZA' },
    notifications: { low_stock_email: true, new_order_email: true },
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('store_settings')
        .select('id, value');

      if (error) {
        console.error('Error fetching settings:', error);
      } else if (data) {
        const newSettings = { ...settings };
        data.forEach((row) => {
          if (row.id in newSettings) {
            (newSettings as any)[row.id] = row.value;
          }
        });
        setSettings(newSettings);
      }
    } catch (err) {
      console.error('Settings fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSetting = async (settingId: string, value: any) => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('store_settings')
        .upsert({
          id: settingId,
          value,
          updated_at: new Date().toISOString(),
          updated_by: user?.id,
        });

      if (error) throw error;
    } catch (err) {
      console.error('Save error:', err);
      alert('Failed to save setting');
    } finally {
      setIsSaving(false);
    }
  };

  const updateShipping = (field: keyof typeof settings.shipping, value: string) => {
    const newShipping = { ...settings.shipping, [field]: parseFloat(value) || 0 };
    setSettings({ ...settings, shipping: newShipping });
  };

  const updateMarkup = (field: keyof typeof settings.markup, value: string) => {
    const newMarkup = { ...settings.markup, [field]: parseInt(value) || 0 };
    setSettings({ ...settings, markup: newMarkup });
  };

  const toggleNotification = (field: keyof typeof settings.notifications) => {
    const newNotifications = { ...settings.notifications, [field]: !settings.notifications[field] };
    setSettings({ ...settings, notifications: newNotifications });
    saveSetting('notifications', newNotifications);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-dark-3 rounded animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-48 bg-dark-2 border border-dark-4 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl text-gray-1 tracking-wider">Settings</h1>
        <p className="text-gray-5 text-sm mt-1">
          Configure store settings and preferences
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Shipping Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <HiOutlineTruck className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <CardTitle>Shipping</CardTitle>
                <CardDescription>Configure shipping rates</CardDescription>
              </div>
            </div>
          </CardHeader>
          <div className="space-y-4">
            <Input
              label="Free Shipping Threshold (R)"
              type="number"
              value={settings.shipping.free_threshold}
              onChange={(e) => updateShipping('free_threshold', e.target.value)}
              hint="Orders above this amount get free shipping"
            />
            <Input
              label="Flat Rate Shipping (R)"
              type="number"
              value={settings.shipping.flat_rate}
              onChange={(e) => updateShipping('flat_rate', e.target.value)}
            />
            <Input
              label="Express Shipping (R)"
              type="number"
              value={settings.shipping.express_rate}
              onChange={(e) => updateShipping('express_rate', e.target.value)}
            />
            <Button 
              onClick={() => saveSetting('shipping', settings.shipping)}
              isLoading={isSaving}
            >
              Save Shipping Settings
            </Button>
          </div>
        </Card>

        {/* Markup Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <HiOutlineCurrencyDollar className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <CardTitle>Product Markup</CardTitle>
                <CardDescription>Default pricing markup percentages</CardDescription>
              </div>
            </div>
          </CardHeader>
          <div className="space-y-4">
            <Input
              label="Default Markup (%)"
              type="number"
              value={settings.markup.default_percent}
              onChange={(e) => updateMarkup('default_percent', e.target.value)}
              hint="Applied to all new products"
            />
            <Input
              label="Featured Product Markup (%)"
              type="number"
              value={settings.markup.featured_percent}
              onChange={(e) => updateMarkup('featured_percent', e.target.value)}
              hint="Applied to featured products"
            />
            <Button 
              onClick={() => saveSetting('markup', settings.markup)}
              isLoading={isSaving}
            >
              Save Markup Settings
            </Button>
          </div>
        </Card>

        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <HiOutlineBell className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>Email notification preferences</CardDescription>
              </div>
            </div>
          </CardHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-gray-1 font-medium">New Order Notifications</p>
                <p className="text-sm text-gray-5">Get notified when a new order is placed</p>
              </div>
              <button
                onClick={() => toggleNotification('new_order_email')}
                className={`w-12 h-6 rounded-full transition-colors ${
                  settings.notifications.new_order_email ? 'bg-main-1' : 'bg-dark-4'
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  settings.notifications.new_order_email ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-gray-1 font-medium">Low Stock Alerts</p>
                <p className="text-sm text-gray-5">Get notified when product stock is low</p>
              </div>
              <button
                onClick={() => toggleNotification('low_stock_email')}
                className={`w-12 h-6 rounded-full transition-colors ${
                  settings.notifications.low_stock_email ? 'bg-main-1' : 'bg-dark-4'
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  settings.notifications.low_stock_email ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
          </div>
        </Card>

        {/* Account Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <HiOutlineUser className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <CardTitle>Account</CardTitle>
                <CardDescription>Your admin account settings</CardDescription>
              </div>
            </div>
          </CardHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-1 mb-1.5">Email Address</label>
              <p className="text-gray-5 bg-dark-3 px-4 py-2.5 rounded-md">{user?.email}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-1 mb-1.5">Role</label>
              <p className="text-gray-5 bg-dark-3 px-4 py-2.5 rounded-md capitalize">
                {user?.role?.replace('_', ' ')}
              </p>
            </div>
            <Button variant="secondary" leftIcon={<HiOutlineKey className="w-4 h-4" />}>
              Change Password
            </Button>
          </div>
        </Card>

        {/* API Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-main-1/20 rounded-lg">
                <HiOutlineGlobe className="w-5 h-5 text-main-1" />
              </div>
              <div>
                <CardTitle>API Configuration</CardTitle>
                <CardDescription>External service connections</CardDescription>
              </div>
            </div>
          </CardHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-dark-4">
              <div>
                <p className="text-gray-1 font-medium">Supabase</p>
                <p className="text-sm text-gray-5">Database connection</p>
              </div>
              <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">Connected</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-dark-4">
              <div>
                <p className="text-gray-1 font-medium">CJ Dropshipping</p>
                <p className="text-sm text-gray-5">Product & fulfillment API</p>
              </div>
              <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">Connected</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-gray-1 font-medium">Yoco</p>
                <p className="text-sm text-gray-5">Payment processing</p>
              </div>
              <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">Connected</span>
            </div>
          </div>
        </Card>

        {/* Danger Zone */}
        <Card className="border-red-500/30">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/20 rounded-lg">
                <HiOutlineCog className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <CardTitle className="text-red-400">Danger Zone</CardTitle>
                <CardDescription>Irreversible actions</CardDescription>
              </div>
            </div>
          </CardHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-1 font-medium">Clear Analytics Data</p>
                <p className="text-sm text-gray-5">Remove all historical analytics</p>
              </div>
              <Button variant="danger" size="sm">Clear</Button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-1 font-medium">Reset Store Settings</p>
                <p className="text-sm text-gray-5">Restore default configuration</p>
              </div>
              <Button variant="danger" size="sm">Reset</Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

