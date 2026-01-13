'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  HiOutlineHome,
  HiOutlineShoppingCart,
  HiOutlineUsers,
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
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed left-0 top-0 z-50 h-screen bg-dark-2 border-r border-dark-4 transition-all duration-300 flex flex-col',
          // Mobile: slide in/out
          'lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          // Desktop: collapsed or expanded
          collapsed ? 'lg:w-[72px]' : 'lg:w-[260px]',
          // Mobile: always full width when open
          'w-[280px]'
        )}
      >
        {/* Logo */}
        <div className={clsx(
          'h-16 flex items-center border-b border-dark-4 px-4',
          collapsed && !isOpen ? 'lg:justify-center' : 'justify-between'
        )}>
          {(!collapsed || isOpen) && (
            <Link href="/" className="flex items-center gap-3" onClick={onClose}>
              <div className="w-8 h-8 rounded bg-gradient-to-br from-main-1 to-amber-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">D</span>
              </div>
              <div>
                <h1 className="font-heading text-lg text-gray-1 tracking-wider">DARKPOINT</h1>
                <p className="text-[10px] text-gray-5 -mt-1 uppercase tracking-widest">Admin</p>
              </div>
            </Link>
          )}
          {collapsed && !isOpen && (
            <div className="hidden lg:flex w-8 h-8 rounded bg-gradient-to-br from-main-1 to-amber-600 items-center justify-center">
              <span className="text-white font-bold text-sm">D</span>
            </div>
          )}
          
          {/* Mobile close button */}
          <button
            onClick={onClose}
            className="lg:hidden p-2 rounded-lg text-gray-5 hover:bg-dark-3 hover:text-gray-1 transition-colors"
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
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group',
                      isActive
                        ? 'bg-main-1/20 text-main-1 border border-main-1/30'
                        : 'text-gray-5 hover:bg-dark-3 hover:text-gray-1',
                      collapsed && !isOpen && 'lg:justify-center lg:px-0'
                    )}
                    title={collapsed && !isOpen ? item.name : undefined}
                  >
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
        <div className="border-t border-dark-4 p-3">
          {/* View Store Link */}
          <a
            href={process.env.NEXT_PUBLIC_MAIN_SITE_URL || 'http://localhost:3000'}
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
