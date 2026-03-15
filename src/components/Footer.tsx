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
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="space-y-1 text-xs leading-relaxed text-foreground-muted">
              <p>
                <span className="font-semibold text-foreground">상호명:</span> 텍스트팩토리 | 
                <span className="ml-1 font-semibold text-foreground">대표자:</span> 김화란 |
                <span className="ml-1 font-semibold text-foreground">사업자등록번호:</span> 221-18-98955
              </p>
              <p>
                <span className="font-semibold text-foreground">주소:</span> 경기도 파주시 심학산로 234, 810동 203호(동패동, 초롱꽃마을8단지)
              </p>
              <p>
                <span className="font-semibold text-foreground">고객센터:</span> 070-8027-1918 |
                <span className="ml-1 font-semibold text-foreground">이메일:</span> support@textfactory.io
              </p>
            </div>

            <p className="text-xs leading-relaxed text-foreground-muted/60">
              &copy; 2026 CrewUp. All rights reserved.
            </p>

            {/* 통신판매중개자 면책 문구 — legal risk mitigation */}
            <p className="max-w-2xl text-[10px] leading-relaxed text-foreground-muted/40">
              크루업은 통신판매중개자로서 크루 운영에 대한 직접적인 책임을 지지 않습니다.
              크루 활동에 관한 분쟁은 크루원 간 해결을 원칙으로 하며, 개별 크루의 운영 방침은 해당 크루장에게 책임이 있습니다.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
