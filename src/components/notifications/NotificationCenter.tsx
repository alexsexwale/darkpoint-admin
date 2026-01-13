'use client';

import { useState, useRef, useEffect } from 'react';
import { 
  HiOutlineBell, 
  HiOutlineCheck,
  HiOutlineRefresh,
  HiOutlineInbox,
} from 'react-icons/hi';
import clsx from 'clsx';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationItem } from './NotificationItem';

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const {
    notifications,
    unreadCount,
    isLoading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'relative p-2.5 rounded-xl transition-all duration-200',
          isOpen 
            ? 'bg-main-1/20 text-main-1' 
            : 'text-gray-5 hover:text-gray-1 hover:bg-dark-3'
        )}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <HiOutlineBell className="w-5 h-5" />
        
        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] font-bold text-white bg-red-500 rounded-full animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div 
          className={clsx(
            'absolute right-0 mt-2 w-[380px] max-h-[500px] rounded-xl border border-dark-4 bg-dark-2 shadow-2xl overflow-hidden z-50',
            'animate-in fade-in slide-in-from-top-2 duration-200'
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-dark-4 bg-dark-3/50">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-gray-1">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-bold text-main-1 bg-main-1/20 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {/* Refresh Button */}
              <button
                onClick={() => fetchNotifications()}
                disabled={isLoading}
                className="p-1.5 rounded-lg text-gray-5 hover:text-gray-1 hover:bg-dark-4 transition-colors disabled:opacity-50"
                title="Refresh"
              >
                <HiOutlineRefresh className={clsx('w-4 h-4', isLoading && 'animate-spin')} />
              </button>
              
              {/* Mark All Read Button */}
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-gray-5 hover:text-gray-1 hover:bg-dark-4 transition-colors"
                  title="Mark all as read"
                >
                  <HiOutlineCheck className="w-3.5 h-3.5" />
                  <span>Mark all read</span>
                </button>
              )}
            </div>
          </div>

          {/* Notification List */}
          <div className="max-h-[400px] overflow-y-auto">
            {isLoading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-main-1" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="w-16 h-16 rounded-full bg-dark-4/50 flex items-center justify-center mb-4">
                  <HiOutlineInbox className="w-8 h-8 text-gray-5" />
                </div>
                <p className="text-gray-5 font-medium mb-1">No notifications yet</p>
                <p className="text-xs text-gray-6">
                  When you receive orders or important updates, they&apos;ll appear here
                </p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkAsRead={markAsRead}
                    onDelete={deleteNotification}
                    onClose={() => setIsOpen(false)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer - Show when there are notifications */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-dark-4 bg-dark-3/30">
              <p className="text-[11px] text-gray-5 text-center">
                Showing {notifications.length} most recent notification{notifications.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default NotificationCenter;

