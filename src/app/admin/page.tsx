import { createAdminClient } from '@/lib/admin';

export default async function AdminDashboard() {
  const supabase = createAdminClient();

  const [reportsRes, pendingRes, blacklistRes, usersRes] = await Promise.all([
    supabase.from('reports').select('id', { count: 'exact', head: true }),
    supabase
      .from('reports')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase.from('blacklist').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
  ]);

  const stats = [
    {
      label: '전체 신고',
      value: reportsRes.count ?? 0,
      sub: `대기중 ${pendingRes.count ?? 0}건`,
      highlight: (pendingRes.count ?? 0) > 0,
    },
    {
      label: '블랙리스트',
      value: blacklistRes.count ?? 0,
      sub: null,
      highlight: false,
    },
    {
      label: '전체 사용자',
      value: usersRes.count ?? 0,
      sub: null,
      highlight: false,
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">대시보드</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="card-flat">
            <p className="text-sm text-foreground-muted mb-1">{stat.label}</p>
            <p className="text-3xl font-bold text-foreground">
              {stat.value.toLocaleString()}
            </p>
            {stat.sub && (
              <p
                className={`text-sm mt-1 ${
                  stat.highlight ? 'text-primary font-semibold' : 'text-foreground-muted'
                }`}
              >
                {stat.sub}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
