import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";

export const metadata = {
  title: "개인정보처리방침 | 크루업",
  description: "크루업 개인정보처리방침",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-3xl px-4 py-12">
        <nav className="mb-6 text-sm text-foreground-muted">
          <Link href="/" className="hover:text-primary">홈</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">개인정보처리방침</span>
        </nav>

        <h1 className="text-3xl font-bold text-foreground">개인정보처리방침</h1>
        <p className="mt-2 text-sm text-foreground-muted">최종 업데이트: 2026년 3월 13일 · v1.0</p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-foreground">

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">1. 수집하는 개인정보 항목</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse border border-neutral">
                <thead className="bg-surface">
                  <tr>
                    <th className="text-left p-3 border border-neutral font-semibold">항목</th>
                    <th className="text-left p-3 border border-neutral font-semibold">수집 목적</th>
                    <th className="text-left p-3 border border-neutral font-semibold">보유 기간</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-3 border border-neutral text-foreground-muted">이메일, 닉네임</td>
                    <td className="p-3 border border-neutral text-foreground-muted">회원 식별 및 서비스 제공</td>
                    <td className="p-3 border border-neutral text-foreground-muted">탈퇴 후 30일</td>
                  </tr>
                  <tr>
                    <td className="p-3 border border-neutral text-foreground-muted">활동 기록 (크루 참여, 미션 등)</td>
                    <td className="p-3 border border-neutral text-foreground-muted">서비스 개선 및 분쟁 해결</td>
                    <td className="p-3 border border-neutral text-foreground-muted">3년</td>
                  </tr>
                  <tr>
                    <td className="p-3 border border-neutral text-foreground-muted">결제 정보 (포인트 거래 내역)</td>
                    <td className="p-3 border border-neutral text-foreground-muted">정산 및 환불 처리</td>
                    <td className="p-3 border border-neutral text-foreground-muted">5년 (전자상거래법)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">2. 개인정보 수집 및 이용 목적</h2>
            <ul className="space-y-2 list-disc list-inside text-foreground-muted">
              <li>회원 가입 및 서비스 제공</li>
              <li>크루 매칭 및 활동 지원</li>
              <li>분쟁 조정 및 법적 증빙</li>
              <li>서비스 개선 및 통계 분석</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">3. 개인정보의 제3자 제공</h2>
            <p className="text-foreground-muted">크루업은 이용자의 동의 없이 개인정보를 제3자에게 제공하지 않습니다. 단, 법령에 의거하거나 수사기관의 요청이 있는 경우는 예외입니다.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">4. 개인정보 처리 위탁</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse border border-neutral">
                <thead className="bg-surface">
                  <tr>
                    <th className="text-left p-3 border border-neutral font-semibold">수탁업체</th>
                    <th className="text-left p-3 border border-neutral font-semibold">위탁 목적</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-3 border border-neutral text-foreground-muted">Supabase Inc.</td>
                    <td className="p-3 border border-neutral text-foreground-muted">데이터베이스 및 인증 서비스 운영</td>
                  </tr>
                  <tr>
                    <td className="p-3 border border-neutral text-foreground-muted">부트페이(Bootpay)</td>
                    <td className="p-3 border border-neutral text-foreground-muted">결제 처리 및 검증</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">5. 이용자의 권리</h2>
            <p className="text-foreground-muted">이용자는 언제든지 자신의 개인정보에 대한 열람, 수정, 삭제를 요청할 수 있습니다. 요청은 고객센터를 통해 접수하시기 바랍니다.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">6. 개인정보 보호책임자</h2>
            <div className="rounded-xl border border-neutral p-4 bg-surface text-foreground-muted">
              <p>이름: 크루업 개인정보 보호팀</p>
              <p className="mt-1">이메일: privacy@crewup.kr (선택)</p>
            </div>
          </section>
        </div>
      </div>
      <Footer />
    </div>
  );
}
