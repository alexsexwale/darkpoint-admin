'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  HiOutlineSearch,
  HiOutlineRefresh,
  HiOutlineEye,
  HiOutlineStar,
  HiOutlineShoppingCart,
  HiOutlineTrendingUp,
} from 'react-icons/hi';
import { 
  Card, 
  CardHeader, 
  CardTitle,
  Button, 
  Input,
  Select,
  Table, 
  TableHeader, 
  TableBody, 
  TableRow, 
  TableHead, 
  TableCell,
  TableEmpty,
  TableSkeleton,
  Badge,
  VIPTierBadge,
} from '@/components/ui';
import { Pagination } from '@/components/ui/Pagination';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import type { UserProfile } from '@/types';

const VIP_FILTERS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All Members' },
  { value: 'bronze', label: 'Bronze VIP' },
  { value: 'gold', label: 'Gold VIP' },
  { value: 'platinum', label: 'Platinum VIP' },
];

const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'created_at', label: 'Newest First' },
  { value: 'total_xp', label: 'Highest XP' },
  { value: 'total_spent', label: 'Highest Spent' },
  { value: 'total_orders', label: 'Most Orders' },
  { value: 'current_level', label: 'Highest Level' },
];

// Level tier helper
function getLevelTierName(level: number): string {
  if (level >= 50) return 'Elite';
  if (level >= 35) return 'Legend';
  if (level >= 20) return 'Pro';
  if (level >= 10) return 'Gamer';
  if (level >= 5) return 'Casual';
  return 'Noob';
}

function getLevelTierColor(level: number): string {
  if (level >= 50) return 'text-red-400';
  if (level >= 35) return 'text-amber-400';
  if (level >= 20) return 'text-purple-400';
  if (level >= 10) return 'text-blue-400';
  if (level >= 5) return 'text-green-400';
  return 'text-gray-400';
}

export default function MembersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [sortBy, setSortBy] = useState('created_at');
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const fetchMembers = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('user_profiles')
        .select('*', { count: 'exact' })
        .order(sortBy, { ascending: sortBy === 'created_at' ? false : false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (searchQuery) {
        query = query.or(`email.ilike.%${searchQuery}%,username.ilike.%${searchQuery}%,display_name.ilike.%${searchQuery}%`);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error('Error fetching members:', error);
      } else {
        setMembers(data || []);
        setTotalCount(count || 0);
      }
    } catch (err) {
      console.error('Members fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, sortBy, searchQuery]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchMembers();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl md:text-2xl text-gray-1 tracking-wider">Members</h1>
          <p className="text-gray-5 text-xs md:text-sm mt-1">
            View and manage all registered members
          </p>
        </div>
        <Button variant="secondary" onClick={fetchMembers} leftIcon={<HiOutlineRefresh className="w-4 h-4" />} size="sm">
          Refresh
        </Button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card padding="sm">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 md:p-2 bg-blue-500/20 rounded-lg flex-shrink-0">
              <HiOutlineStar className="w-4 h-4 md:w-5 md:h-5 text-blue-400" />
            </div>
            <div className="min-w-0">
              <p className="text-lg md:text-2xl font-heading text-gray-1">{totalCount}</p>
              <p className="text-[10px] md:text-xs text-gray-5">Total Members</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 md:p-2 bg-main-1/20 rounded-lg flex-shrink-0">
              <HiOutlineTrendingUp className="w-4 h-4 md:w-5 md:h-5 text-main-1" />
            </div>
            <div className="min-w-0">
              <p className="text-lg md:text-2xl font-heading text-gray-1">
                {members.filter(m => m.current_level >= 10).length}
              </p>
              <p className="text-[10px] md:text-xs text-gray-5">Level 10+</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 md:p-2 bg-purple-500/20 rounded-lg flex-shrink-0">
              <HiOutlineShoppingCart className="w-4 h-4 md:w-5 md:h-5 text-purple-400" />
            </div>
            <div className="min-w-0">
              <p className="text-lg md:text-2xl font-heading text-gray-1">
                {members.filter(m => m.total_orders > 0).length}
              </p>
              <p className="text-[10px] md:text-xs text-gray-5">Customers</p>
            </div>
          </div>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 md:p-2 bg-green-500/20 rounded-lg flex-shrink-0">
              <HiOutlineStar className="w-4 h-4 md:w-5 md:h-5 text-green-400" />
            </div>
            <div className="min-w-0">
              <p className="text-lg md:text-2xl font-heading text-gray-1">
                {members.filter(m => m.current_streak >= 7).length}
              </p>
              <p className="text-[10px] md:text-xs text-gray-5">Active Streakers</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card padding="sm" className="md:p-4">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              placeholder="Search by email, username, or display name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<HiOutlineSearch className="w-4 h-4" />}
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1 sm:w-40">
              <Select
                options={SORT_OPTIONS}
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <Button type="submit" className="flex-shrink-0">Search</Button>
          </div>
        </form>
      </Card>

      {/* Members Table */}
      <Card padding="none">
        <CardHeader className="px-6 py-4 border-b border-dark-4">
          <CardTitle>
            {totalCount} Member{totalCount !== 1 ? 's' : ''}
          </CardTitle>
        </CardHeader>
        
        <Table>
          <TableHeader>
            <TableRow hover={false}>
              <TableHead>Member</TableHead>
              <TableHead>Level</TableHead>
              <TableHead align="right">XP</TableHead>
              <TableHead align="right">Orders</TableHead>
              <TableHead align="right">Spent</TableHead>
              <TableHead>Streak</TableHead>
              <TableHead>Store Credit</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead align="center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeleton rows={10} colSpan={9} />
            ) : members.length === 0 ? (
              <TableEmpty 
                colSpan={9} 
                message="No members found"
                description="Try adjusting your search"
              />
            ) : (
              members.map((member) => (
                <TableRow key={member.id} onClick={() => router.push(`/members/${member.id}`)}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className={`relative w-10 h-10 rounded-full bg-gradient-to-br from-main-1 to-amber-600 flex items-center justify-center flex-shrink-0 ${member.is_suspended ? 'opacity-50 grayscale' : ''}`}>
                        {member.avatar_url ? (
                          <img 
                            src={member.avatar_url} 
                            alt="" 
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          <span className="text-white font-medium">
                            {(member.display_name || member.username || member.email || 'U').charAt(0).toUpperCase()}
                          </span>
                        )}
                        {member.is_suspended && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center border-2 border-dark-2">
                            <span className="text-[8px]">🚫</span>
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className={`font-medium ${member.is_suspended ? 'text-gray-5 line-through' : 'text-gray-1'}`}>
                            {member.display_name || member.username || 'Anonymous'}
                          </p>
                          {member.is_suspended && (
                            <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">
                              Suspended
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-5">{member.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${getLevelTierColor(member.current_level)}`}>
                        Lv.{member.current_level}
                      </span>
                      <span className="text-xs text-gray-5">
                        {getLevelTierName(member.current_level)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell align="right">
                    <span className="text-main-1 font-medium">
                      {member.total_xp.toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell align="right">
                    <span className="text-gray-1">{member.total_orders}</span>
                  </TableCell>
                  <TableCell align="right">
                    <span className="text-gray-1">{formatCurrency(member.total_spent)}</span>
                  </TableCell>
                  <TableCell>
                    {member.current_streak > 0 ? (
                      <Badge variant={member.current_streak >= 7 ? 'success' : 'default'}>
                        🔥 {member.current_streak} days
                      </Badge>
                    ) : (
                      <span className="text-gray-5">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {member.store_credit > 0 ? (
                      <span className="text-green-400">{formatCurrency(member.store_credit)}</span>
                    ) : (
                      <span className="text-gray-5">R0</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-gray-5 text-sm">
                      {format(new Date(member.created_at), 'MMM d, yyyy')}
                    </span>
                  </TableCell>
                  <TableCell align="center">
                    <div onClick={(e) => e.stopPropagation()}>
                      <Link href={`/members/${member.id}`}>
                        <Button variant="ghost" size="sm">
                          <HiOutlineEye className="w-4 h-4" />
                        </Button>
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        <div className="border-t border-dark-4">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalCount}
            itemsPerPage={pageSize}
            onPageChange={(newPage) => setPage(newPage)}
            onItemsPerPageChange={(newSize) => {
              setPageSize(newSize);
              setPage(1);
            }}
          />
        </div>
      </Card>
    </div>
  );
}

