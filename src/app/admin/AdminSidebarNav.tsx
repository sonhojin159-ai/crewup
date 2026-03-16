'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/admin', label: '대시보드', exact: true },
  { href: '/admin/reports', label: '신고 관리', exact: false },
  { href: '/admin/blacklist', label: '블랙리스트', exact: false },
  { href: '/admin/users', label: '사용자 관리', exact: false },
  { href: '/admin/gifticons', label: '기프티콘 관리', exact: false },
  { href: '/admin/rewards', label: '리워드 주문', exact: true },
  { href: '/admin/rewards/products', label: '상품 관리', exact: false },
] as const;

export function AdminSidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex-1 px-3 space-y-1">
      {NAV_ITEMS.map(({ href, label, exact }) => {
        const isActive = exact
          ? pathname === href
          : pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-foreground-muted hover:bg-neutral/20 hover:text-foreground'
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
