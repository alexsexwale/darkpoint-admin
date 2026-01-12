'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  HiOutlineBell,
  HiOutlineSearch,
  HiOutlineUser,
  HiOutlineLogout,
  HiOutlineCog,
} from 'react-icons/hi';
import { useAuthStore } from '@/stores/authStore';
import clsx from 'clsx';

export function Header() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
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
      // Search across orders, members, products
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="h-16 bg-dark-2 border-b border-dark-4 flex items-center justify-between px-6">
      {/* Search */}
      <form onSubmit={handleSearch} className="flex-1 max-w-md">
        <div className="relative">
          <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-5" />
          <input
            type="text"
            placeholder="Search orders, members, products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-10 pr-4 py-2 text-sm bg-dark-3 border-dark-4 w-full"
          />
        </div>
      </form>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Notifications */}
        <button className="relative p-2 rounded-lg text-gray-5 hover:bg-dark-3 hover:text-gray-1 transition-colors">
          <HiOutlineBell className="w-5 h-5" />
          {/* Notification badge */}
          <span className="absolute top-1 right-1 w-2 h-2 bg-main-5 rounded-full" />
        </button>

        {/* User dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-dark-3 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-main-1 to-amber-600 flex items-center justify-center">
              <span className="text-white font-medium text-sm">
                {user?.email?.charAt(0).toUpperCase() || 'A'}
              </span>
            </div>
            <div className="text-left hidden md:block">
              <p className="text-sm font-medium text-gray-1">
                {user?.email?.split('@')[0] || 'Admin'}
              </p>
              <p className="text-xs text-gray-5 capitalize">
                {user?.role?.replace('_', ' ') || 'Admin'}
              </p>
            </div>
          </button>

          {/* Dropdown menu */}
          {showDropdown && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-dark-3 border border-dark-4 rounded-lg shadow-lg overflow-hidden z-50">
              <div className="p-3 border-b border-dark-4">
                <p className="text-sm font-medium text-gray-1 truncate">{user?.email}</p>
                <p className="text-xs text-gray-5 capitalize">{user?.role?.replace('_', ' ')}</p>
              </div>
              <div className="p-1">
                <button
                  onClick={() => {
                    setShowDropdown(false);
                    router.push('/settings/profile');
                  }}
                  className="flex items-center gap-3 w-full px-3 py-2 text-sm text-gray-5 hover:bg-dark-4 hover:text-gray-1 rounded-md transition-colors"
                >
                  <HiOutlineUser className="w-4 h-4" />
                  Profile
                </button>
                <button
                  onClick={() => {
                    setShowDropdown(false);
                    router.push('/settings');
                  }}
                  className="flex items-center gap-3 w-full px-3 py-2 text-sm text-gray-5 hover:bg-dark-4 hover:text-gray-1 rounded-md transition-colors"
                >
                  <HiOutlineCog className="w-4 h-4" />
                  Settings
                </button>
                <hr className="my-1 border-dark-4" />
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full px-3 py-2 text-sm text-main-5 hover:bg-dark-4 rounded-md transition-colors"
                >
                  <HiOutlineLogout className="w-4 h-4" />
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

