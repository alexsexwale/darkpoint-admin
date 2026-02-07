'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  HiOutlineHome,
  HiOutlineShoppingCart,
  HiOutlineUsers,
  HiOutlineUserCircle,
  HiOutlineCube,
  HiOutlineStar,
  HiOutlineTicket,
  HiOutlineChartBar,
  HiOutlineCog,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineExternalLink,
  HiOutlineX,
} from 'react-icons/hi';
import clsx from 'clsx';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: HiOutlineHome },
  { name: 'Orders', href: '/orders', icon: HiOutlineShoppingCart },
  { name: 'Customers', href: '/customers', icon: HiOutlineUserCircle },
  { name: 'Members', href: '/members', icon: HiOutlineUsers },
  { name: 'Products', href: '/products', icon: HiOutlineCube },
  { name: 'Reviews', href: '/reviews', icon: HiOutlineStar },
  { name: 'Coupons', href: '/coupons', icon: HiOutlineTicket },
  { name: 'Analytics', href: '/analytics', icon: HiOutlineChartBar },
  { name: 'Settings', href: '/settings', icon: HiOutlineCog },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({ isOpen, onClose, collapsed, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed left-0 top-0 z-50 h-screen bg-dark-2/95 backdrop-blur-xl border-r border-dark-4/50 transition-all duration-300 flex flex-col',
          // Mobile: slide in/out
          'lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          // Desktop: collapsed or expanded
          collapsed ? 'lg:w-[72px]' : 'lg:w-[280px]',
          // Mobile: always full width when open
          'w-[300px]'
        )}
      >
        {/* Logo */}
        <div className={clsx(
          'h-16 flex items-center justify-center border-b border-dark-4/50 relative',
          collapsed && !isOpen ? 'lg:px-2' : 'px-4'
        )}>
          {(!collapsed || isOpen) && (
            <Link href="/" className="group relative z-10 flex items-center justify-center" onClick={onClose}>
              <h1 className="font-heading text-2xl text-transparent bg-clip-text bg-gradient-to-r from-main-1 via-orange-400 to-amber-400 tracking-[0.2em] hover:from-amber-400 hover:via-orange-400 hover:to-main-1 transition-all leading-none pt-0.5">
                DARKPOINT
              </h1>
            </Link>
          )}
          
          {/* Collapsed logo */}
          {collapsed && !isOpen && (
            <Link href="/" className="hidden lg:block group">
              <span className="font-heading text-xl text-transparent bg-clip-text bg-gradient-to-r from-main-1 to-amber-400">D</span>
            </Link>
          )}
          
          {/* Mobile close button */}
          <button
            onClick={onClose}
            className="lg:hidden absolute right-3 p-2 rounded-lg text-gray-5 hover:bg-dark-3 hover:text-gray-1 transition-colors"
          >
            <HiOutlineX className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 overflow-y-auto">
          <ul className="space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href || 
                (item.href !== '/' && pathname.startsWith(item.href));
              
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={clsx(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative',
                      isActive
                        ? 'bg-gradient-to-r from-main-1/20 to-amber-500/10 text-main-1 border border-main-1/30'
                        : 'text-gray-5 hover:bg-dark-3 hover:text-gray-1',
                      collapsed && !isOpen && 'lg:justify-center lg:px-0'
                    )}
                    title={collapsed && !isOpen ? item.name : undefined}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-gradient-to-b from-main-1 to-amber-500 rounded-r-full" />
                    )}
                    <item.icon className={clsx(
                      'w-5 h-5 flex-shrink-0 transition-colors',
                      isActive ? 'text-main-1' : 'group-hover:text-main-1'
                    )} />
                    {(!collapsed || isOpen) && (
                      <>
                        <span className="flex-1 text-sm font-medium">{item.name}</span>
                        {item.badge !== undefined && item.badge > 0 && (
                          <span className="bg-main-5 text-white text-xs px-2 py-0.5 rounded-full">
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                    {collapsed && !isOpen && (
                      <span className="hidden">{item.name}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="border-t border-dark-4/50 p-3">
          {/* View Store Link */}
          <a
            href={process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}
            target="_blank"
            rel="noopener noreferrer"
            className={clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-5 hover:bg-dark-3 hover:text-gray-1 transition-colors mb-2',
              collapsed && !isOpen && 'lg:justify-center lg:px-0'
            )}
            title={collapsed && !isOpen ? 'View Store' : undefined}
          >
            <HiOutlineExternalLink className="w-5 h-5 flex-shrink-0" />
            {(!collapsed || isOpen) && <span className="text-sm">View Store</span>}
          </a>

          {/* Collapse Button - Desktop only */}
          <button
            onClick={onToggleCollapse}
            className={clsx(
              'hidden lg:flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-5 hover:bg-dark-3 hover:text-gray-1 transition-colors w-full',
              collapsed && 'justify-center px-0'
            )}
          >
            {collapsed ? (
              <HiOutlineChevronRight className="w-5 h-5" />
            ) : (
              <>
                <HiOutlineChevronLeft className="w-5 h-5" />
                <span className="text-sm">Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
