'use client';

import { useRouter } from 'next/navigation';
import { 
  HiOutlineShoppingCart, 
  HiOutlineUserAdd, 
  HiOutlineCube, 
  HiOutlineCog,
  HiOutlineX,
  HiOutlineExclamation,
  HiOutlineCheckCircle,
  HiOutlineTruck,
  HiOutlineStar,
} from 'react-icons/hi';
import clsx from 'clsx';
import type { Notification } from '@/hooks/useNotifications';

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

// Map icon string to component
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  HiOutlineShoppingCart,
  HiOutlineUserAdd,
  HiOutlineCube,
  HiOutlineCog,
  HiOutlineExclamation,
  HiOutlineCheckCircle,
  HiOutlineTruck,
  HiOutlineStar,
};

// Get color classes based on notification type
const getTypeStyles = (type: string) => {
  switch (type) {
    case 'order':
      return {
        bg: 'bg-main-1/20',
        text: 'text-main-1',
        border: 'border-main-1/30',
      };
    case 'customer':
      return {
        bg: 'bg-blue-500/20',
        text: 'text-blue-400',
        border: 'border-blue-500/30',
      };
    case 'inventory':
      return {
        bg: 'bg-yellow-500/20',
        text: 'text-yellow-400',
        border: 'border-yellow-500/30',
      };
    case 'system':
    default:
      return {
        bg: 'bg-gray-500/20',
        text: 'text-gray-400',
        border: 'border-gray-500/30',
      };
  }
};

// Format relative time
const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' });
};

export function NotificationItem({ 
  notification, 
  onMarkAsRead, 
  onDelete,
  onClose 
}: NotificationItemProps) {
  const router = useRouter();
  const styles = getTypeStyles(notification.type);
  const IconComponent = iconMap[notification.icon || 'HiOutlineCog'] || HiOutlineCog;

  const handleClick = () => {
    if (!notification.is_read) {
      onMarkAsRead(notification.id);
    }
    if (notification.link) {
      router.push(notification.link);
      onClose();
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(notification.id);
  };

  return (
    <div
      onClick={handleClick}
      className={clsx(
        'group relative flex items-start gap-3 p-3 rounded-lg transition-all cursor-pointer',
        notification.is_read 
          ? 'bg-dark-3/50 hover:bg-dark-3' 
          : 'bg-dark-3 hover:bg-dark-4/50',
        notification.link && 'cursor-pointer'
      )}
    >
      {/* Unread indicator */}
      {!notification.is_read && (
        <div className="absolute top-3 left-1 w-2 h-2 rounded-full bg-main-1 animate-pulse" />
      )}

      {/* Icon */}
      <div className={clsx(
        'flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center',
        styles.bg
      )}>
        <IconComponent className={clsx('w-5 h-5', styles.text)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h4 className={clsx(
            'text-sm font-medium line-clamp-1',
            notification.is_read ? 'text-gray-5' : 'text-gray-1'
          )}>
            {notification.title}
          </h4>
          <span className="text-[10px] text-gray-5 flex-shrink-0 mt-0.5">
            {formatRelativeTime(notification.created_at)}
          </span>
        </div>
        
        {notification.message && (
          <p className={clsx(
            'text-xs mt-0.5 line-clamp-2',
            notification.is_read ? 'text-gray-6' : 'text-gray-5'
          )}>
            {notification.message}
          </p>
        )}

        {/* Type badge */}
        <div className="flex items-center gap-2 mt-1.5">
          <span className={clsx(
            'text-[10px] px-1.5 py-0.5 rounded capitalize',
            styles.bg, styles.text
          )}>
            {notification.type}
          </span>
          {notification.data?.amount !== undefined && notification.data?.amount !== null && (
            <span className="text-[10px] text-green-400 font-mono">
              R {Number(notification.data.amount).toLocaleString('en-ZA')}
            </span>
          )}
        </div>
      </div>

      {/* Delete button */}
      <button
        onClick={handleDelete}
        className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-dark-4 transition-all"
        title="Delete notification"
      >
        <HiOutlineX className="w-3.5 h-3.5 text-gray-5 hover:text-red-400" />
      </button>
    </div>
  );
}

