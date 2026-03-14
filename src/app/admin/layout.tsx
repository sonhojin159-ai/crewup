import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/admin';
import { AdminSidebarNav } from './AdminSidebarNav';

export const metadata = {
  title: '크루업 관리자',
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdmin(user.email)) {
    redirect('/');
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-neutral bg-background flex flex-col">
        <div className="p-5">
          <Link href="/admin" className="text-lg font-bold text-foreground">
            크루업 관리자
          </Link>
        </div>

        <AdminSidebarNav />

        <hr className="section-divider mx-4" />

        <div className="p-4">
          <Link
            href="/"
            className="text-sm text-foreground-muted hover:text-primary"
          >
            사이트로 돌아가기
          </Link>
        </div>
      </aside>

      <main className="flex-1 bg-neutral/5 p-8 overflow-auto">
        {children}
      </main>
    </div>
  );
}
