import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";

export const metadata = {
  title: "이용약관 | 크루업",
  description: "크루업 서비스 이용약관",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-3xl px-4 py-12">
        <nav className="mb-6 text-sm text-foreground-muted">
          <Link href="/" className="hover:text-primary">홈</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">이용약관</span>
        </nav>

        <h1 className="text-3xl font-bold text-foreground">이용약관</h1>
        <p className="mt-2 text-sm text-foreground-muted">최종 업데이트: 2026년 3월 19일 · v1.1</p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-foreground">

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">제1조 (목적)</h2>
            <p>이 약관은 크루업(이하 "서비스")이 제공하는 모든 서비스의 이용조건 및 절차, 이용자와 서비스 간의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">제2조 (정의)</h2>
            <ul className="space-y-2 list-disc list-inside text-foreground-muted">
              <li><strong className="text-foreground">서비스</strong>: 크루업이 운영하는 웹 플랫폼 및 관련 서비스 일체</li>
              <li><strong className="text-foreground">이용자</strong>: 본 약관에 동의하고 서비스를 이용하는 모든 회원</li>
              <li><strong className="text-foreground">크루</strong>: 이용자들이 공동의 목표를 위해 구성하는 그룹</li>
              <li><strong className="text-foreground">크루장</strong>: 크루를 생성하고 운영하는 이용자</li>
              <li><strong className="text-foreground">포인트</strong>: 서비스 내에서 사용되는 가상 화폐 단위</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">제3조 (서비스의 성격)</h2>
            <p className="text-foreground-muted">크루업은 <strong className="text-foreground">통신판매중개업자</strong>로서, 크루원 간의 매칭 및 정보 제공을 위한 플랫폼입니다. 크루 활동에서 발생하는 수익, 손실, 분쟁에 대해 플랫폼은 직접적인 책임을 지지 않습니다.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">제4조 (회원 가입 및 자격)</h2>
            <p className="text-foreground-muted">서비스에 가입하기 위해서는 본 약관에 동의해야 합니다. 허위 정보 제공, 사기 행위 적발 시 계정이 영구 정지될 수 있습니다.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">제5조 (크루 참여 및 예치금)</h2>
            <ul className="space-y-2 list-disc list-inside text-foreground-muted">
              <li>크루 참여 시 납부한 참여금(에스크로)은 크루 운영 규칙에 따라 배분됩니다.</li>
              <li>자발적 탈퇴 시 참여금은 환급되지 않을 수 있습니다.</li>
              <li>크루장의 사정으로 크루가 해산될 경우, 크루장이 선납한 보호 예치금이 우선 사용되어 멤버에게 보상됩니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">제5-2조 (포인트 이용기간)</h2>
            <p className="text-foreground-muted">
              충전된 포인트의 이용기간은 <strong className="text-foreground">결제일로부터 1년</strong>입니다.
              이용기간이 경과한 미사용 포인트는 자동 소멸되며, 소멸된 포인트에 대해서는 환불 및 복원이 불가합니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">제5-3조 (포인트 양도 금지)</h2>
            <p className="text-foreground-muted">
              충전된 포인트는 <strong className="text-foreground">타인에게 양도하거나 매매할 수 없습니다</strong>.
              포인트는 충전한 본인의 계정에서만 사용할 수 있으며, 양도 또는 매매 시도가 확인될 경우 서비스 이용이 제한될 수 있습니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">제6조 (면책 조항)</h2>
            <p className="text-foreground-muted">크루업은 천재지변, 시스템 오류, 이용자의 귀책사유로 인한 손해에 대해 책임을 지지 않습니다. 크루원 간의 금전 거래 및 수익 분배는 당사자 간의 합의에 따르며, 플랫폼은 이를 중개하지 않습니다.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">제7조 (약관의 변경)</h2>
            <p className="text-foreground-muted">서비스는 약관을 변경할 경우, 시행 7일 전 공지사항을 통해 이용자에게 고지합니다. 변경된 약관에 동의하지 않는 경우, 서비스 이용을 중단하고 탈퇴할 수 있습니다.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">제8조 (분쟁 해결)</h2>
            <p className="text-foreground-muted">서비스와 이용자 간의 분쟁은 관련 법령에 따라 해결합니다. 분쟁 발생 시 관할 법원은 서비스 본사 소재지 법원으로 합니다.</p>
          </section>
        </div>
      </div>
      <Footer />
    </div>
  );
}
