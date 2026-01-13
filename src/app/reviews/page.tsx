'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { 
  HiOutlineSearch,
  HiOutlineRefresh,
  HiOutlineCheck,
  HiOutlineX,
  HiOutlineStar,
  HiOutlineReply,
  HiOutlineFlag,
} from 'react-icons/hi';
import { 
  Card, 
  CardHeader, 
  CardTitle,
  Button, 
  Input,
  Select,
  Textarea,
  Badge,
  ReviewStatusBadge,
  Modal,
} from '@/components/ui';
import { Pagination } from '@/components/ui/Pagination';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import type { ProductReview, ReviewStatus } from '@/types';

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All Reviews' },
  { value: 'pending', label: 'Pending' },
  { value: 'published', label: 'Published' },
  { value: 'rejected', label: 'Rejected' },
];

const RATING_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All Ratings' },
  { value: '5', label: '5 Stars' },
  { value: '4', label: '4 Stars' },
  { value: '3', label: '3 Stars' },
  { value: '2', label: '2 Stars' },
  { value: '1', label: '1 Star' },
];

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [ratingFilter, setRatingFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const [showReplyModal, setShowReplyModal] = useState(false);
  const [selectedReview, setSelectedReview] = useState<ProductReview | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const fetchReviews = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('product_reviews')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (statusFilter) {
        query = query.eq('status', statusFilter as ReviewStatus);
      }
      if (ratingFilter) {
        query = query.eq('rating', parseInt(ratingFilter));
      }
      if (searchQuery) {
        query = query.or(`product_name.ilike.%${searchQuery}%,title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%`);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error('Error fetching reviews:', error);
      } else {
        const rows = (data || []) as ProductReview[];

        // product_reviews.user_id references auth.users, not user_profiles.
        // So we fetch user_profiles separately and stitch them in client-side.
        const userIds = Array.from(
          new Set(rows.map((r) => (r as unknown as { user_id?: string }).user_id).filter(Boolean) as string[])
        );

        if (userIds.length > 0) {
          const { data: profilesData, error: profilesError } = await supabase
            .from('user_profiles')
            .select('id, username, display_name, email, avatar_url')
            .in('id', userIds);

          if (profilesError) {
            console.error('Error fetching review authors:', profilesError);
            setReviews(rows);
          } else {
            const byId = new Map((profilesData || []).map((p) => [p.id, p]));
            setReviews(
              rows.map((r) => {
                const uid = (r as unknown as { user_id?: string }).user_id || '';
                return {
                  ...r,
                  user_profiles: byId.get(uid),
                } as ProductReview;
              })
            );
          }
        } else {
          setReviews(rows);
        }
        setTotalCount(count || 0);
      }
    } catch (err) {
      console.error('Reviews fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, statusFilter, ratingFilter, searchQuery]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const updateReviewStatus = async (reviewId: string, newStatus: ReviewStatus) => {
    try {
      const { error } = await supabase
        .from('product_reviews')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', reviewId);

      if (error) throw error;
      
      setReviews(reviews.map(r => 
        r.id === reviewId ? { ...r, status: newStatus } : r
      ));
    } catch (err) {
      console.error('Update error:', err);
    }
  };

  const submitReply = async () => {
    if (!selectedReview || !replyText.trim()) return;
    setIsSaving(true);
    
    try {
      const { error } = await supabase
        .from('product_reviews')
        .update({ 
          admin_response: replyText,
          admin_responded_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedReview.id);

      if (error) throw error;
      
      setReviews(reviews.map(r => 
        r.id === selectedReview.id 
          ? { ...r, admin_response: replyText, admin_responded_at: new Date().toISOString() } 
          : r
      ));
      setShowReplyModal(false);
      setSelectedReview(null);
      setReplyText('');
    } catch (err) {
      console.error('Reply error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <HiOutlineStar 
            key={star}
            className={`w-4 h-4 ${star <= rating ? 'text-amber-400 fill-amber-400' : 'text-gray-5'}`}
          />
        ))}
      </div>
    );
  };

  const totalPages = Math.ceil(totalCount / pageSize);
  const pendingCount = reviews.filter(r => r.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl text-gray-1 tracking-wider">Reviews</h1>
          <p className="text-gray-5 text-sm mt-1">
            Moderate product reviews
          </p>
        </div>
        <Button variant="secondary" onClick={fetchReviews} leftIcon={<HiOutlineRefresh className="w-4 h-4" />}>
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card padding="sm">
          <div className="text-center">
            <p className="text-2xl font-heading text-gray-1">{totalCount}</p>
            <p className="text-xs text-gray-5">Total Reviews</p>
          </div>
        </Card>
        <Card padding="sm">
          <div className="text-center">
            <p className="text-2xl font-heading text-amber-400">{pendingCount}</p>
            <p className="text-xs text-gray-5">Pending</p>
          </div>
        </Card>
        <Card padding="sm">
          <div className="text-center">
            <p className="text-2xl font-heading text-green-400">
              {reviews.filter(r => r.status === 'published').length}
            </p>
            <p className="text-xs text-gray-5">Published</p>
          </div>
        </Card>
        <Card padding="sm">
          <div className="text-center">
            <p className="text-2xl font-heading text-main-1">
              {reviews.length > 0 
                ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
                : '0'
              }
            </p>
            <p className="text-xs text-gray-5">Avg Rating</p>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card padding="md">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="Search reviews..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<HiOutlineSearch className="w-4 h-4" />}
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
          <div className="w-40">
            <Select
              options={RATING_OPTIONS}
              value={ratingFilter}
              onChange={(e) => {
                setRatingFilter(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
      </Card>

      {/* Reviews List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-40 bg-dark-2 border border-dark-4 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-gray-5">No reviews found</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <Card key={review.id}>
              <div className="flex gap-4">
                {/* Product Image */}
                <div className="w-20 h-20 bg-dark-3 rounded-lg overflow-hidden flex-shrink-0">
                  {review.product_image ? (
                    <img 
                      src={review.product_image}
                      alt={review.product_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-5 text-xs">
                      No image
                    </div>
                  )}
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-gray-1">{review.title}</p>
                        <ReviewStatusBadge status={review.status} />
                        {review.verified_purchase && (
                          <Badge variant="success">Verified</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-5">
                        <span>{review.product_name}</span>
                        <span>•</span>
                        {renderStars(review.rating)}
                        <span>•</span>
                        <span>{format(new Date(review.created_at), 'MMM d, yyyy')}</span>
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {review.status === 'pending' && (
                        <>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => updateReviewStatus(review.id, 'published')}
                            title="Approve"
                          >
                            <HiOutlineCheck className="w-4 h-4 text-green-400" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => updateReviewStatus(review.id, 'rejected')}
                            title="Reject"
                          >
                            <HiOutlineX className="w-4 h-4 text-red-400" />
                          </Button>
                        </>
                      )}
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => {
                          setSelectedReview(review);
                          setReplyText(review.admin_response || '');
                          setShowReplyModal(true);
                        }}
                        title="Reply"
                      >
                        <HiOutlineReply className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Review Content */}
                  <p className="text-gray-1 text-sm mb-2">{review.content}</p>
                  
                  {/* Pros/Cons */}
                  {(review.pros || review.cons) && (
                    <div className="flex gap-4 text-sm mb-2">
                      {review.pros && (
                        <div>
                          <span className="text-green-400">+ </span>
                          <span className="text-gray-5">{review.pros}</span>
                        </div>
                      )}
                      {review.cons && (
                        <div>
                          <span className="text-red-400">- </span>
                          <span className="text-gray-5">{review.cons}</span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Admin Response */}
                  {review.admin_response && (
                    <div className="mt-3 p-3 bg-dark-3 rounded-lg border-l-2 border-main-1">
                      <p className="text-xs text-gray-5 mb-1">Admin Response</p>
                      <p className="text-sm text-gray-1">{review.admin_response}</p>
                    </div>
                  )}
                  
                  {/* Author */}
                  <div className="flex items-center gap-2 mt-3 text-xs text-gray-5">
                    <div className="w-6 h-6 rounded-full bg-dark-3 flex items-center justify-center">
                      {review.user_profiles?.avatar_url ? (
                        <img 
                          src={review.user_profiles.avatar_url}
                          alt=""
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-gray-5 text-xs">
                          {(review.user_profiles?.display_name || review.user_profiles?.username || 'A').charAt(0)}
                        </span>
                      )}
                    </div>
                    <span>{review.user_profiles?.display_name || review.user_profiles?.username || 'Anonymous'}</span>
                    <span>•</span>
                    <span>{review.helpful_count} found helpful</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      <Card padding="none">
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
      </Card>

      {/* Reply Modal */}
      <Modal
        isOpen={showReplyModal}
        onClose={() => {
          setShowReplyModal(false);
          setSelectedReview(null);
          setReplyText('');
        }}
        title="Reply to Review"
      >
        {selectedReview && (
          <div className="space-y-4">
            <div className="p-3 bg-dark-3 rounded-lg">
              <p className="font-medium text-gray-1 mb-1">{selectedReview.title}</p>
              <p className="text-sm text-gray-5">{selectedReview.content}</p>
            </div>
            <Textarea
              label="Your Response"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write your response..."
              rows={4}
            />
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowReplyModal(false)}>
                Cancel
              </Button>
              <Button onClick={submitReply} isLoading={isSaving}>
                {selectedReview.admin_response ? 'Update Reply' : 'Post Reply'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

