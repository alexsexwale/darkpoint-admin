'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  HiOutlineArrowLeft,
  HiOutlineMail,
  HiOutlineStar,
  HiOutlineShoppingCart,
  HiOutlineClock,
  HiOutlineGift,
  HiOutlineLightningBolt,
  HiOutlineTicket,
  HiOutlineUserGroup,
  HiOutlinePencil,
} from 'react-icons/hi';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription,
  Button, 
  Input,
  Badge,
  Modal,
  OrderStatusBadge,
} from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import type { UserProfile, UserAchievement, UserReward, Order, XPTransaction, UserCoupon } from '@/types';

// Level tier helpers
function getLevelTierName(level: number): string {
  if (level >= 50) return 'Elite';
  if (level >= 35) return 'Legend';
  if (level >= 20) return 'Pro';
  if (level >= 10) return 'Gamer';
  if (level >= 5) return 'Casual';
  return 'Noob';
}

function getLevelTierColor(level: number): string {
  if (level >= 50) return 'text-red-400 bg-red-400/20';
  if (level >= 35) return 'text-amber-400 bg-amber-400/20';
  if (level >= 20) return 'text-purple-400 bg-purple-400/20';
  if (level >= 10) return 'text-blue-400 bg-blue-400/20';
  if (level >= 5) return 'text-green-400 bg-green-400/20';
  return 'text-gray-400 bg-gray-400/20';
}

function getXPForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level <= 4) return (level - 1) * 100;
  if (level <= 9) return 300 + (level - 4) * 200;
  if (level <= 19) return 1300 + (level - 9) * 500;
  if (level <= 34) return 6300 + (level - 19) * 1000;
  if (level <= 49) return 21300 + (level - 34) * 2000;
  return 51300 + (level - 49) * 5000;
}

export default function MemberDetailPage() {
  const params = useParams();
  const router = useRouter();
  const memberId = params.id as string;
  
  const [member, setMember] = useState<UserProfile | null>(null);
  const [achievements, setAchievements] = useState<UserAchievement[]>([]);
  const [rewards, setRewards] = useState<UserReward[]>([]);
  const [coupons, setCoupons] = useState<UserCoupon[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [xpTransactions, setXPTransactions] = useState<XPTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [showXPModal, setShowXPModal] = useState(false);
  const [xpAmount, setXPAmount] = useState('');
  const [xpReason, setXPReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchMemberData();
  }, [memberId]);

  const fetchMemberData = async () => {
    setIsLoading(true);
    try {
      // Fetch member profile
      const { data: memberData, error: memberError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', memberId)
        .single();

      if (memberError || !memberData) {
        console.error('Error fetching member:', memberError);
        router.push('/members');
        return;
      }
      setMember(memberData);

      // Fetch achievements
      const { data: achievementsData } = await supabase
        .from('user_achievements')
        .select(`
          *,
          achievement:achievements (*)
        `)
        .eq('user_id', memberId)
        .order('unlocked_at', { ascending: false });
      setAchievements(achievementsData || []);

      // Fetch rewards
      const { data: rewardsData } = await supabase
        .from('user_rewards')
        .select(`
          *,
          reward:rewards (*)
        `)
        .eq('user_id', memberId)
        .order('claimed_at', { ascending: false });
      setRewards(rewardsData || []);

      // Fetch coupons
      const { data: couponsData } = await supabase
        .from('user_coupons')
        .select('*')
        .eq('user_id', memberId)
        .order('created_at', { ascending: false });
      setCoupons(couponsData || []);

      // Fetch orders
      const { data: ordersData } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', memberId)
        .order('created_at', { ascending: false })
        .limit(10);
      setOrders(ordersData || []);

      // Fetch XP transactions
      const { data: xpData } = await supabase
        .from('xp_transactions')
        .select('*')
        .eq('user_id', memberId)
        .order('created_at', { ascending: false })
        .limit(20);
      setXPTransactions(xpData || []);

    } catch (err) {
      console.error('Member data fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const addXP = async () => {
    if (!member || !xpAmount) return;
    setIsSaving(true);
    
    try {
      const amount = parseInt(xpAmount);
      if (isNaN(amount)) {
        alert('Please enter a valid number');
        return;
      }

      // Add XP transaction
      await supabase.from('xp_transactions').insert({
        user_id: memberId,
        amount,
        action: 'admin',
        description: xpReason || 'Admin adjustment',
      });

      // Update user profile
      await supabase
        .from('user_profiles')
        .update({ 
          total_xp: member.total_xp + amount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', memberId);

      // Refresh data
      await fetchMemberData();
      setShowXPModal(false);
      setXPAmount('');
      setXPReason('');
    } catch (err) {
      console.error('Error adding XP:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-dark-3 rounded animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {[1, 2].map(i => (
              <div key={i} className="h-48 bg-dark-2 border border-dark-4 rounded-lg animate-pulse" />
            ))}
          </div>
          <div className="space-y-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-dark-2 border border-dark-4 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-5">Member not found</p>
        <Link href="/members" className="text-main-1 hover:underline mt-2 inline-block">
          Back to Members
        </Link>
      </div>
    );
  }

  const currentLevelXP = getXPForLevel(member.current_level);
  const nextLevelXP = getXPForLevel(member.current_level + 1);
  const xpProgress = ((member.total_xp - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/members">
          <Button variant="ghost" size="sm">
            <HiOutlineArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="font-heading text-2xl text-gray-1 tracking-wider">
            {member.display_name || member.username || 'Anonymous Member'}
          </h1>
          <p className="text-gray-5 text-sm mt-1 flex items-center gap-2">
            <HiOutlineMail className="w-4 h-4" />
            {member.email || 'No email'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Overview */}
          <Card>
            <div className="flex items-start gap-6">
              <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-main-1 to-amber-600 flex items-center justify-center flex-shrink-0">
                {member.avatar_url ? (
                  <img 
                    src={member.avatar_url} 
                    alt="" 
                    className="w-full h-full rounded-xl object-cover"
                  />
                ) : (
                  <span className="text-white font-bold text-2xl">
                    {(member.display_name || member.username || member.email || 'U').charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-xl font-medium text-gray-1">
                    {member.display_name || member.username || 'Anonymous'}
                  </h2>
                  <Badge className={getLevelTierColor(member.current_level)}>
                    {getLevelTierName(member.current_level)}
                  </Badge>
                </div>
                <p className="text-gray-5 text-sm mb-4">{member.email}</p>
                
                {/* Level Progress */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-5">Level {member.current_level}</span>
                    <span className="text-sm text-gray-5">Level {member.current_level + 1}</span>
                  </div>
                  <div className="h-2 bg-dark-4 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-main-1 to-amber-500 rounded-full transition-all"
                      style={{ width: `${Math.min(100, xpProgress)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-5 mt-1">
                    {member.total_xp.toLocaleString()} / {nextLevelXP.toLocaleString()} XP
                  </p>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-dark-3 rounded-lg">
                    <HiOutlineLightningBolt className="w-5 h-5 text-main-1 mx-auto mb-1" />
                    <p className="text-lg font-medium text-gray-1">{member.total_xp.toLocaleString()}</p>
                    <p className="text-xs text-gray-5">Total XP</p>
                  </div>
                  <div className="text-center p-3 bg-dark-3 rounded-lg">
                    <HiOutlineShoppingCart className="w-5 h-5 text-green-400 mx-auto mb-1" />
                    <p className="text-lg font-medium text-gray-1">{member.total_orders}</p>
                    <p className="text-xs text-gray-5">Orders</p>
                  </div>
                  <div className="text-center p-3 bg-dark-3 rounded-lg">
                    <HiOutlineStar className="w-5 h-5 text-amber-400 mx-auto mb-1" />
                    <p className="text-lg font-medium text-gray-1">{member.total_reviews}</p>
                    <p className="text-xs text-gray-5">Reviews</p>
                  </div>
                  <div className="text-center p-3 bg-dark-3 rounded-lg">
                    <HiOutlineClock className="w-5 h-5 text-purple-400 mx-auto mb-1" />
                    <p className="text-lg font-medium text-gray-1">{member.current_streak}</p>
                    <p className="text-xs text-gray-5">Streak</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Achievements */}
          <Card>
            <CardHeader>
              <CardTitle>Achievements ({achievements.length})</CardTitle>
            </CardHeader>
            {achievements.length === 0 ? (
              <p className="text-gray-5 text-center py-6">No achievements unlocked yet</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {achievements.slice(0, 12).map((ua) => (
                  <div 
                    key={ua.id}
                    className="flex items-center gap-3 p-3 bg-dark-3 rounded-lg"
                  >
                    <span className="text-2xl">{ua.achievement?.icon || '🏆'}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-1 truncate">
                        {ua.achievement?.name || 'Unknown'}
                      </p>
                      <p className="text-xs text-gray-5">
                        {format(new Date(ua.unlocked_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Recent Orders */}
          <Card>
            <CardHeader 
              action={
                <Link href={`/orders?user=${memberId}`} className="text-sm text-main-1 hover:underline">
                  View All →
                </Link>
              }
            >
              <CardTitle>Recent Orders</CardTitle>
            </CardHeader>
            {orders.length === 0 ? (
              <p className="text-gray-5 text-center py-6">No orders yet</p>
            ) : (
              <div className="divide-y divide-dark-4">
                {orders.slice(0, 5).map((order) => (
                  <Link 
                    key={order.id}
                    href={`/orders/${order.id}`}
                    className="flex items-center justify-between py-3 hover:bg-dark-3 -mx-6 px-6 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-main-1">#{order.order_number}</p>
                      <p className="text-xs text-gray-5">
                        {format(new Date(order.created_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <OrderStatusBadge status={order.status} />
                      <span className="font-medium text-gray-1">{formatCurrency(order.total)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {/* XP History */}
          <Card>
            <CardHeader>
              <CardTitle>XP History</CardTitle>
            </CardHeader>
            {xpTransactions.length === 0 ? (
              <p className="text-gray-5 text-center py-6">No XP transactions yet</p>
            ) : (
              <div className="divide-y divide-dark-4">
                {xpTransactions.slice(0, 10).map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm text-gray-1">{tx.description || tx.action}</p>
                      <p className="text-xs text-gray-5">
                        {format(new Date(tx.created_at), 'MMM d, yyyy HH:mm')}
                      </p>
                    </div>
                    <span className={`font-medium ${tx.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {tx.amount >= 0 ? '+' : ''}{tx.amount} XP
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <div className="space-y-2">
              <Button 
                variant="secondary" 
                className="w-full justify-start"
                onClick={() => setShowXPModal(true)}
                leftIcon={<HiOutlineLightningBolt className="w-4 h-4" />}
              >
                Adjust XP
              </Button>
              <Button 
                variant="secondary" 
                className="w-full justify-start"
                leftIcon={<HiOutlineMail className="w-4 h-4" />}
                onClick={() => window.location.href = `mailto:${member.email}`}
              >
                Send Email
              </Button>
            </div>
          </Card>

          {/* Account Details */}
          <Card>
            <CardHeader>
              <CardTitle>Account Details</CardTitle>
            </CardHeader>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-5">Member Since</span>
                <span className="text-gray-1">
                  {format(new Date(member.created_at), 'MMM d, yyyy')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-5">Last Login</span>
                <span className="text-gray-1">
                  {member.last_login_date 
                    ? format(new Date(member.last_login_date), 'MMM d, yyyy')
                    : 'Never'
                  }
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-5">Referral Code</span>
                <span className="text-main-1 font-mono">{member.referral_code || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-5">Referrals</span>
                <span className="text-gray-1">{member.referral_count}</span>
              </div>
            </div>
          </Card>

          {/* Financial */}
          <Card>
            <CardHeader>
              <CardTitle>Financial</CardTitle>
            </CardHeader>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-5">Total Spent</span>
                <span className="text-gray-1">{formatCurrency(member.total_spent)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-5">Store Credit</span>
                <span className="text-green-400">{formatCurrency(member.store_credit)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-5">Available Spins</span>
                <span className="text-main-1">{member.available_spins}</span>
              </div>
            </div>
          </Card>

          {/* Rewards */}
          <Card>
            <CardHeader>
              <CardTitle>Active Rewards ({rewards.filter(r => !r.used).length})</CardTitle>
            </CardHeader>
            {rewards.filter(r => !r.used).length === 0 ? (
              <p className="text-gray-5 text-sm text-center py-4">No active rewards</p>
            ) : (
              <div className="space-y-2">
                {rewards.filter(r => !r.used).slice(0, 5).map((ur) => (
                  <div 
                    key={ur.id}
                    className="flex items-center gap-3 p-2 bg-dark-3 rounded-lg"
                  >
                    <HiOutlineGift className="w-5 h-5 text-main-1" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-1 truncate">
                        {ur.reward?.name || 'Unknown Reward'}
                      </p>
                      {ur.expires_at && (
                        <p className="text-xs text-gray-5">
                          Expires {format(new Date(ur.expires_at), 'MMM d')}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Active Coupons */}
          <Card>
            <CardHeader>
              <CardTitle>Active Coupons ({coupons.filter(c => !c.is_used).length})</CardTitle>
            </CardHeader>
            {coupons.filter(c => !c.is_used).length === 0 ? (
              <p className="text-gray-5 text-sm text-center py-4">No active coupons</p>
            ) : (
              <div className="space-y-2">
                {coupons.filter(c => !c.is_used).slice(0, 5).map((coupon) => (
                  <div 
                    key={coupon.id}
                    className="flex items-center gap-3 p-2 bg-dark-3 rounded-lg"
                  >
                    <HiOutlineTicket className="w-5 h-5 text-green-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-1 font-mono">{coupon.code}</p>
                      <p className="text-xs text-gray-5">
                        {coupon.discount_type === 'percent' 
                          ? `${coupon.discount_value}% off`
                          : formatCurrency(coupon.discount_value)
                        }
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* XP Adjustment Modal */}
      <Modal
        isOpen={showXPModal}
        onClose={() => setShowXPModal(false)}
        title="Adjust XP"
        description="Add or remove XP from this member's account"
      >
        <div className="space-y-4">
          <Input
            label="XP Amount"
            type="number"
            value={xpAmount}
            onChange={(e) => setXPAmount(e.target.value)}
            placeholder="Enter amount (use negative for removal)"
            hint="Positive numbers add XP, negative numbers remove XP"
          />
          <Input
            label="Reason"
            value={xpReason}
            onChange={(e) => setXPReason(e.target.value)}
            placeholder="Reason for adjustment (optional)"
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowXPModal(false)}>
              Cancel
            </Button>
            <Button onClick={addXP} isLoading={isSaving}>
              Apply Adjustment
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

