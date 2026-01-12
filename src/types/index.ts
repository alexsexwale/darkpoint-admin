// Order types
export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export interface Order {
  id: string;
  user_id: string | null;
  order_number: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  subtotal: number;
  shipping_cost: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  currency: string;
  shipping_name: string | null;
  shipping_address_line1: string | null;
  shipping_address_line2: string | null;
  shipping_city: string | null;
  shipping_province: string | null;
  shipping_postal_code: string | null;
  shipping_country: string | null;
  shipping_phone: string | null;
  billing_name: string | null;
  billing_email: string | null;
  billing_address_line1: string | null;
  billing_city: string | null;
  billing_province: string | null;
  billing_postal_code: string | null;
  billing_country: string | null;
  billing_phone: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  customer_notes: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  order_items?: OrderItem[];
  user_profiles?: UserProfile;
  cj_orders?: CJOrder[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  product_slug: string | null;
  product_image: string | null;
  variant_id: string | null;
  variant_name: string | null;
  sku: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: string;
}

// CJ Order tracking
export interface CJOrder {
  id: string;
  order_id: string;
  cj_order_id: string | null;
  cj_status: string | null;
  cj_tracking_number: string | null;
  placed_at: string | null;
  last_synced_at: string | null;
}

// User/Member types
export interface UserProfile {
  id: string;
  email: string | null;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  total_xp: number;
  current_level: number;
  current_streak: number;
  longest_streak: number;
  last_login_date: string | null;
  total_spent: number;
  total_orders: number;
  total_reviews: number;
  referral_code: string | null;
  referred_by: string | null;
  referral_count: number;
  available_spins: number;
  store_credit: number;
  created_at: string;
  updated_at: string;
}

// Achievement types
export type AchievementCategory = 'shopping' | 'social' | 'engagement' | 'collector' | 'special';
export type RarityType = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  icon: string;
  xp_reward: number;
  rarity: RarityType;
  requirement_type: string;
  requirement_value: number;
  is_hidden: boolean;
  is_active: boolean;
  created_at: string;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_id: string;
  unlocked_at: string;
  progress: number;
  achievement?: Achievement;
}

// Reward types
export type RewardCategory = 'discount' | 'shipping' | 'xp_booster' | 'cosmetic' | 'exclusive' | 'spin';
export type DiscountType = 'percent' | 'fixed' | 'shipping';
export type CouponSource = 'spin' | 'reward' | 'referral' | 'achievement' | 'promotion' | 'manual';

export interface Reward {
  id: string;
  name: string;
  description: string | null;
  category: RewardCategory;
  xp_cost: number;
  value: string;
  image_url: string | null;
  stock: number | null;
  is_active: boolean;
  created_at: string;
}

export interface UserReward {
  id: string;
  user_id: string;
  reward_id: string;
  claimed_at: string;
  used: boolean;
  used_at: string | null;
  expires_at: string | null;
  reward?: Reward;
}

export interface UserCoupon {
  id: string;
  user_id: string;
  code: string;
  discount_type: DiscountType;
  discount_value: number;
  min_order_value: number;
  source: CouponSource;
  is_used: boolean;
  used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

// Admin Product types
export interface AdminProduct {
  id: string;
  cj_product_id: string;
  name: string;
  description: string | null;
  base_price: number;
  sell_price: number;
  markup_percent: number;
  category: string | null;
  images: Array<{ id: string; src: string; alt: string }>;
  is_active: boolean;
  is_featured: boolean;
  stock_quantity: number | null;
  last_synced_at: string | null;
  created_at: string;
}

// Review types
export type ReviewStatus = 'pending' | 'published' | 'rejected';

export interface ProductReview {
  id: string;
  user_id: string;
  product_id: string;
  product_name: string;
  product_slug: string | null;
  product_image: string | null;
  rating: number;
  title: string;
  content: string;
  pros: string | null;
  cons: string | null;
  status: ReviewStatus;
  helpful_count: number;
  not_helpful_count: number;
  verified_purchase: boolean;
  admin_response: string | null;
  admin_responded_at: string | null;
  created_at: string;
  updated_at: string;
  user_profiles?: UserProfile;
}

// Analytics types
export interface DashboardStats {
  totalRevenue: number;
  totalOrders: number;
  totalMembers: number;
  pendingOrders: number;
  todayRevenue: number;
  todayOrders: number;
  weekRevenue: number;
  weekOrders: number;
  monthRevenue: number;
  monthOrders: number;
}

export interface RevenueDataPoint {
  date: string;
  revenue: number;
  orders: number;
}

// VIP types
export type VIPTier = 'bronze' | 'gold' | 'platinum' | null;

// Referral types
export type ReferralStatus = 'pending' | 'signed_up' | 'converted';

export interface Referral {
  id: string;
  referrer_id: string;
  referred_id: string | null;
  referral_code: string;
  status: ReferralStatus;
  reward_claimed: boolean;
  reward_amount: number | null;
  click_count: number;
  created_at: string;
  converted_at: string | null;
}

// XP Transaction types
export type XPAction = 
  | 'signup' 
  | 'daily_login' 
  | 'first_purchase' 
  | 'purchase' 
  | 'review' 
  | 'photo_review' 
  | 'share' 
  | 'referral' 
  | 'quest' 
  | 'achievement' 
  | 'spin_reward' 
  | 'bonus' 
  | 'admin' 
  | 'read_article' 
  | 'add_wishlist' 
  | 'redeem';

export interface XPTransaction {
  id: string;
  user_id: string;
  amount: number;
  action: XPAction;
  description: string | null;
  created_at: string;
}

// Admin User types
export type AdminRole = 'admin' | 'super_admin' | 'support';

export interface AdminUser {
  id: string;
  email: string;
  role: AdminRole;
  created_at: string;
}

