import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?redirect=/crews/${id}/dashboard`);
  }

  // 크루장 여부 확인
  const { data: crew } = await supabase
    .from('crews')
    .select('created_by')
    .eq('id', id)
    .single();

  if (!crew || crew.created_by !== user.id) {
    // 크루장이 아니면 크루 상세 페이지로 리다이렉트
    redirect(`/crews/${id}`);
  }

  return <>{children}</>;
}
