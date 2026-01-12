'use client';

import { useEffect, useState, useCallback } from 'react';
import { 
  HiOutlineSearch,
  HiOutlineRefresh,
  HiOutlinePlus,
  HiOutlineTrash,
  HiOutlineClipboardCopy,
} from 'react-icons/hi';
import { 
  Card, 
  CardHeader, 
  CardTitle,
  Button, 
  Input,
  Select,
  Badge,
  Modal,
  ConfirmDialog,
} from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import type { UserCoupon, DiscountType, CouponSource } from '@/types';

const SOURCE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All Sources' },
  { value: 'manual', label: 'Manual' },
  { value: 'promotion', label: 'Promotion' },
  { value: 'spin', label: 'Spin Wheel' },
  { value: 'reward', label: 'Reward' },
  { value: 'referral', label: 'Referral' },
  { value: 'achievement', label: 'Achievement' },
];

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'used', label: 'Used' },
  { value: 'expired', label: 'Expired' },
];

const DISCOUNT_TYPE_OPTIONS: Array<{ value: DiscountType; label: string }> = [
  { value: 'percent', label: 'Percentage' },
  { value: 'fixed', label: 'Fixed Amount' },
  { value: 'shipping', label: 'Free Shipping' },
];

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<UserCoupon[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<UserCoupon | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Create form state
  const [newCoupon, setNewCoupon] = useState({
    code: '',
    discountType: 'percent' as DiscountType,
    discountValue: '',
    minOrderValue: '0',
    expiresInDays: '30',
    userEmail: '',
  });

  const fetchCoupons = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('user_coupons')
        .select(`
          *,
          user_profiles:user_id (id, email, username, display_name)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (sourceFilter) {
        query = query.eq('source', sourceFilter as CouponSource);
      }
      if (statusFilter === 'active') {
        query = query.eq('is_used', false).or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());
      } else if (statusFilter === 'used') {
        query = query.eq('is_used', true);
      } else if (statusFilter === 'expired') {
        query = query.eq('is_used', false).lt('expires_at', new Date().toISOString());
      }
      if (searchQuery) {
        query = query.ilike('code', `%${searchQuery}%`);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error('Error fetching coupons:', error);
      } else {
        setCoupons(data || []);
        setTotalCount(count || 0);
      }
    } catch (err) {
      console.error('Coupons fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, sourceFilter, statusFilter, searchQuery]);

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  const generateCouponCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'DP-';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewCoupon({ ...newCoupon, code });
  };

  const createCoupon = async () => {
    if (!newCoupon.code || !newCoupon.discountValue) {
      alert('Please fill in required fields');
      return;
    }
    
    setIsSaving(true);
    try {
      // Get user ID if email provided
      let userId = null;
      if (newCoupon.userEmail) {
        const { data: user } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('email', newCoupon.userEmail)
          .single();
        
        if (!user) {
          alert('User not found with that email');
          setIsSaving(false);
          return;
        }
        userId = user.id;
      }

      const expiresAt = newCoupon.expiresInDays 
        ? new Date(Date.now() + parseInt(newCoupon.expiresInDays) * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const { error } = await supabase
        .from('user_coupons')
        .insert({
          user_id: userId,
          code: newCoupon.code.toUpperCase(),
          discount_type: newCoupon.discountType,
          discount_value: parseFloat(newCoupon.discountValue),
          min_order_value: parseFloat(newCoupon.minOrderValue) || 0,
          source: 'manual',
          is_used: false,
          expires_at: expiresAt,
        });

      if (error) throw error;
      
      await fetchCoupons();
      setShowCreateModal(false);
      setNewCoupon({
        code: '',
        discountType: 'percent',
        discountValue: '',
        minOrderValue: '0',
        expiresInDays: '30',
        userEmail: '',
      });
    } catch (err) {
      console.error('Create error:', err);
      alert('Failed to create coupon');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteCoupon = async () => {
    if (!selectedCoupon) return;
    setIsSaving(true);
    
    try {
      const { error } = await supabase
        .from('user_coupons')
        .delete()
        .eq('id', selectedCoupon.id);

      if (error) throw error;
      
      setCoupons(coupons.filter(c => c.id !== selectedCoupon.id));
      setShowDeleteConfirm(false);
      setSelectedCoupon(null);
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
  };

  const formatDiscount = (coupon: UserCoupon) => {
    if (coupon.discount_type === 'percent') {
      return `${coupon.discount_value}% off`;
    } else if (coupon.discount_type === 'fixed') {
      return `R${coupon.discount_value} off`;
    } else {
      return 'Free Shipping';
    }
  };

  const getCouponStatus = (coupon: UserCoupon) => {
    if (coupon.is_used) return { label: 'Used', variant: 'default' as const };
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      return { label: 'Expired', variant: 'danger' as const };
    }
    return { label: 'Active', variant: 'success' as const };
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl text-gray-1 tracking-wider">Coupons</h1>
          <p className="text-gray-5 text-sm mt-1">
            Manage discount coupons and promotions
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={fetchCoupons} leftIcon={<HiOutlineRefresh className="w-4 h-4" />}>
            Refresh
          </Button>
          <Button onClick={() => setShowCreateModal(true)} leftIcon={<HiOutlinePlus className="w-4 h-4" />}>
            Create Coupon
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card padding="sm">
          <div className="text-center">
            <p className="text-2xl font-heading text-gray-1">{totalCount}</p>
            <p className="text-xs text-gray-5">Total Coupons</p>
          </div>
        </Card>
        <Card padding="sm">
          <div className="text-center">
            <p className="text-2xl font-heading text-green-400">
              {coupons.filter(c => !c.is_used && (!c.expires_at || new Date(c.expires_at) > new Date())).length}
            </p>
            <p className="text-xs text-gray-5">Active</p>
          </div>
        </Card>
        <Card padding="sm">
          <div className="text-center">
            <p className="text-2xl font-heading text-gray-5">
              {coupons.filter(c => c.is_used).length}
            </p>
            <p className="text-xs text-gray-5">Used</p>
          </div>
        </Card>
        <Card padding="sm">
          <div className="text-center">
            <p className="text-2xl font-heading text-red-400">
              {coupons.filter(c => !c.is_used && c.expires_at && new Date(c.expires_at) < new Date()).length}
            </p>
            <p className="text-xs text-gray-5">Expired</p>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card padding="md">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="Search by coupon code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<HiOutlineSearch className="w-4 h-4" />}
            />
          </div>
          <div className="w-40">
            <Select
              options={SOURCE_OPTIONS}
              value={sourceFilter}
              onChange={(e) => {
                setSourceFilter(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="w-40">
            <Select
              options={STATUS_OPTIONS}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
      </Card>

      {/* Coupons List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-20 bg-dark-2 border border-dark-4 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : coupons.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-gray-5 mb-4">No coupons found</p>
          <Button onClick={() => setShowCreateModal(true)} leftIcon={<HiOutlinePlus className="w-4 h-4" />}>
            Create First Coupon
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {coupons.map((coupon) => {
            const status = getCouponStatus(coupon);
            return (
              <Card key={coupon.id} padding="md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <code className="text-lg font-mono text-main-1 bg-dark-3 px-3 py-1 rounded">
                        {coupon.code}
                      </code>
                      <button
                        onClick={() => copyCode(coupon.code)}
                        className="text-gray-5 hover:text-main-1 transition-colors"
                        title="Copy code"
                      >
                        <HiOutlineClipboardCopy className="w-4 h-4" />
                      </button>
                    </div>
                    <div>
                      <p className="font-medium text-gray-1">{formatDiscount(coupon)}</p>
                      <p className="text-xs text-gray-5">
                        Min order: R{coupon.min_order_value} • Source: {coupon.source}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <Badge variant={status.variant}>{status.label}</Badge>
                      {coupon.expires_at && (
                        <p className="text-xs text-gray-5 mt-1">
                          {new Date(coupon.expires_at) < new Date() 
                            ? `Expired ${format(new Date(coupon.expires_at), 'MMM d')}`
                            : `Expires ${format(new Date(coupon.expires_at), 'MMM d')}`
                          }
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedCoupon(coupon);
                        setShowDeleteConfirm(true);
                      }}
                    >
                      <HiOutlineTrash className="w-4 h-4 text-red-400" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-gray-5 px-4">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </Button>
        </div>
      )}

      {/* Create Coupon Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Coupon"
        size="md"
      >
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                label="Coupon Code"
                value={newCoupon.code}
                onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })}
                placeholder="DP-XXXXXXXX"
              />
            </div>
            <div className="flex items-end">
              <Button variant="secondary" onClick={generateCouponCode}>
                Generate
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Discount Type"
              options={DISCOUNT_TYPE_OPTIONS}
              value={newCoupon.discountType}
              onChange={(e) => setNewCoupon({ ...newCoupon, discountType: e.target.value as DiscountType })}
            />
            <Input
              label={newCoupon.discountType === 'percent' ? 'Discount (%)' : 'Discount Amount (R)'}
              type="number"
              value={newCoupon.discountValue}
              onChange={(e) => setNewCoupon({ ...newCoupon, discountValue: e.target.value })}
              placeholder={newCoupon.discountType === 'percent' ? '10' : '50'}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Min Order Value (R)"
              type="number"
              value={newCoupon.minOrderValue}
              onChange={(e) => setNewCoupon({ ...newCoupon, minOrderValue: e.target.value })}
              placeholder="0"
            />
            <Input
              label="Expires In (Days)"
              type="number"
              value={newCoupon.expiresInDays}
              onChange={(e) => setNewCoupon({ ...newCoupon, expiresInDays: e.target.value })}
              placeholder="30"
              hint="Leave empty for no expiry"
            />
          </div>
          
          <Input
            label="Assign to User (Optional)"
            value={newCoupon.userEmail}
            onChange={(e) => setNewCoupon({ ...newCoupon, userEmail: e.target.value })}
            placeholder="user@email.com"
            hint="Leave empty for a general coupon"
          />
          
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={createCoupon} isLoading={isSaving}>
              Create Coupon
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setSelectedCoupon(null);
        }}
        onConfirm={deleteCoupon}
        title="Delete Coupon"
        message={`Are you sure you want to delete coupon "${selectedCoupon?.code}"?`}
        confirmText="Delete"
        variant="danger"
        isLoading={isSaving}
      />
    </div>
  );
}

