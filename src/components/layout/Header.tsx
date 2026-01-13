'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  HiOutlineSearch,
  HiOutlineUser,
  HiOutlineLogout,
  HiOutlineCog,
  HiOutlineMenu,
  HiOutlineX,
} from 'react-icons/hi';
import { useAuthStore } from '@/stores/authStore';
import { NotificationCenter } from '@/components/notifications';
import clsx from 'clsx';

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setShowMobileSearch(false);
    }
  };

  return (
    <header className="h-14 md:h-16 bg-dark-2/80 backdrop-blur-xl border-b border-dark-4/50 flex items-center justify-between px-4 md:px-6 sticky top-0 z-30">
      {/* Left side - Menu button (mobile) + Search */}
      <div className="flex items-center gap-3 flex-1">
        {/* Mobile menu button */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-2 rounded-xl text-gray-5 hover:bg-dark-3 hover:text-gray-1 transition-all active:scale-95"
        >
          <HiOutlineMenu className="w-6 h-6" />
        </button>

        {/* Desktop Search - Enhanced */}
        <form onSubmit={handleSearch} className="hidden md:block flex-1 max-w-xl">
          <div className={clsx(
            'relative group transition-all duration-300',
            isSearchFocused && 'scale-[1.02]'
          )}>
            {/* Glow effect on focus */}
            <div className={clsx(
              'absolute -inset-0.5 bg-gradient-to-r from-main-1/50 via-orange-500/50 to-amber-500/50 rounded-xl blur-sm opacity-0 transition-opacity duration-300',
              isSearchFocused && 'opacity-100'
            )} />
            
            {/* Search container */}
            <div className={clsx(
              'relative flex items-center bg-dark-3/80 backdrop-blur-sm rounded-xl border transition-all duration-300',
              isSearchFocused 
                ? 'border-main-1/50 shadow-lg shadow-main-1/10' 
                : 'border-dark-4/50 hover:border-dark-4'
            )}>
              {/* Search icon with gradient on focus */}
              <div className="pl-4 pr-2">
                <HiOutlineSearch className={clsx(
                  'w-5 h-5 transition-colors duration-300',
                  isSearchFocused ? 'text-main-1' : 'text-gray-5'
                )} />
              </div>
              
              {/* Input */}
              <input
                type="text"
                placeholder="Search orders, members, products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
                className="flex-1 bg-transparent py-2.5 pr-4 text-sm text-gray-1 placeholder:text-gray-5/60 focus:outline-none"
              />
              
              {/* Keyboard shortcut hint */}
              <div className={clsx(
                'hidden lg:flex items-center gap-1 pr-3 transition-opacity',
                isSearchFocused ? 'opacity-0' : 'opacity-60'
              )}>
                <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-gray-5 bg-dark-4/50 rounded border border-dark-4">
                  ⌘
                </kbd>
                <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-gray-5 bg-dark-4/50 rounded border border-dark-4">
                  K
                </kbd>
              </div>
            </div>
          </div>
        </form>

        {/* Mobile search button */}
        <button
          onClick={() => setShowMobileSearch(!showMobileSearch)}
          className="md:hidden p-2 rounded-xl text-gray-5 hover:bg-dark-3 hover:text-gray-1 transition-all active:scale-95"
        >
          {showMobileSearch ? (
            <HiOutlineX className="w-5 h-5" />
          ) : (
            <HiOutlineSearch className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Notifications */}
        <NotificationCenter />

        {/* User dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className={clsx(
              'flex items-center gap-2 md:gap-3 px-2 md:px-3 py-1.5 rounded-xl transition-all active:scale-[0.98]',
              showDropdown ? 'bg-dark-3' : 'hover:bg-dark-3'
            )}
          >
            {/* Avatar with ring */}
            <div className="relative">
              <div className="absolute -inset-0.5 bg-gradient-to-br from-main-1 to-amber-500 rounded-full opacity-75" />
              <div className="relative w-8 h-8 rounded-full bg-gradient-to-br from-main-1 to-amber-600 flex items-center justify-center ring-2 ring-dark-2">
                <span className="text-white font-semibold text-sm">
                  {user?.email?.charAt(0).toUpperCase() || 'A'}
                </span>
              </div>
              {/* Online indicator */}
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-dark-2" />
            </div>
            <div className="text-left hidden md:block">
              <p className="text-sm font-medium text-gray-1 leading-tight">
                {user?.email?.split('@')[0] || 'Admin'}
              </p>
              <p className="text-[11px] text-gray-5 capitalize leading-tight">
                {user?.role?.replace('_', ' ') || 'Admin'}
              </p>
            </div>
          </button>

          {/* Dropdown menu - Enhanced */}
          {showDropdown && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-dark-3/95 backdrop-blur-xl border border-dark-4/50 rounded-xl shadow-2xl shadow-black/30 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              {/* Header with gradient */}
              <div className="p-4 border-b border-dark-4/50 bg-gradient-to-r from-main-1/10 to-amber-500/10">
                <p className="text-sm font-medium text-gray-1 truncate">{user?.email}</p>
                <p className="text-xs text-gray-5 capitalize mt-0.5">{user?.role?.replace('_', ' ')}</p>
              </div>
              <div className="p-2">
                <button
                  onClick={() => {
                    setShowDropdown(false);
                    router.push('/settings/profile');
                  }}
                  className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-gray-4 hover:bg-dark-4/50 hover:text-gray-1 rounded-lg transition-colors"
                >
                  <HiOutlineUser className="w-4 h-4" />
                  Profile
                </button>
                <button
                  onClick={() => {
                    setShowDropdown(false);
                    router.push('/settings');
                  }}
                  className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-gray-4 hover:bg-dark-4/50 hover:text-gray-1 rounded-lg transition-colors"
                >
                  <HiOutlineCog className="w-4 h-4" />
                  Settings
                </button>
                <hr className="my-2 border-dark-4/50" />
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <HiOutlineLogout className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile search bar - slides down with animation */}
      {showMobileSearch && (
        <div className="absolute left-0 right-0 top-full bg-dark-2/95 backdrop-blur-xl border-b border-dark-4/50 p-4 md:hidden animate-in slide-in-from-top duration-200">
          <form onSubmit={handleSearch}>
            <div className="relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-main-1/30 to-amber-500/30 rounded-xl blur-sm" />
              <div className="relative flex items-center bg-dark-3 rounded-xl border border-dark-4/50">
                <div className="pl-4 pr-2">
                  <HiOutlineSearch className="w-5 h-5 text-main-1" />
                </div>
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent py-3 pr-4 text-sm text-gray-1 placeholder:text-gray-5/60 focus:outline-none"
                  autoFocus
                />
              </div>
            </div>
          </form>
        </div>
      )}
    </header>
  );
}
