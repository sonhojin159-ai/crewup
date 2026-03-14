import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-neutral/60 bg-gradient-to-b from-surface to-surface/60">
      <div className="mx-auto max-w-6xl px-4 py-10">
        {/* Desktop: 4-column grid / Mobile: stacked */}
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="lg:col-span-1">
            <p className="text-lg font-bold text-primary">크루업</p>
            <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
              함께하면 더 쉬운 부업.<br />
              같은 목표를 가진 크루와 시작하세요.
            </p>
          </div>

          {/* 서비스 */}
          <div>
            <p className="text-sm font-semibold text-foreground">서비스</p>
            <ul className="mt-3 space-y-2">
              <li>
                <Link href="/crews" className="text-sm text-foreground-muted transition-colors hover:text-primary">
                  크루 찾기
                </Link>
              </li>
              <li>
                <Link href="/crews/new" className="text-sm text-foreground-muted transition-colors hover:text-primary">
                  크루 만들기
                </Link>
              </li>
              <li>
                <Link href="/wallet" className="text-sm text-foreground-muted transition-colors hover:text-primary">
                  마이 월렛
                </Link>
              </li>
            </ul>
          </div>

          {/* 카테고리 */}
          <div>
            <p className="text-sm font-semibold text-foreground">카테고리</p>
            <ul className="mt-3 space-y-2">
              {["온라인 판매", "배달", "프리랜서", "콘텐츠", "투자"].map((cat) => (
                <li key={cat}>
                  <Link
                    href={`/crews?category=${cat}`}
                    className="text-sm text-foreground-muted transition-colors hover:text-primary"
                  >
                    {cat}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold text-foreground">안내</p>
            <ul className="mt-3 space-y-2">
              <li>
                <Link href="/terms" className="text-sm text-foreground-muted transition-colors hover:text-primary">
                  이용약관
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-sm text-foreground-muted transition-colors hover:text-primary">
                  개인정보처리방침
                </Link>
              </li>
              <li>
                <Link href="/support" className="text-sm text-foreground-muted transition-colors hover:text-primary">
                  고객센터
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 border-t border-neutral pt-6">
          <p className="text-center text-xs leading-relaxed text-foreground-muted">
            &copy; 2026 CrewUp. All rights reserved.
          </p>
          {/* 통신판매중개자 면책 문구 — legal risk mitigation */}
          <p className="mt-2 text-center text-xs leading-relaxed text-foreground-muted/70">
            크루업은 통신판매중개자로서 크루 운영에 대한 직접적인 책임을 지지 않습니다.
            크루 활동에 관한 분쟁은 크루원 간 해결을 원칙으로 합니다.
          </p>
        </div>
      </div>
    </footer>
  );
}
