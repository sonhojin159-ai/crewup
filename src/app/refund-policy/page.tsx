import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";

export const metadata = {
  title: "환불 정책 | 크루업",
  description: "크루업 포인트 환불 정책 안내",
};

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-3xl px-4 py-12">
        <nav className="mb-6 text-sm text-foreground-muted">
          <Link href="/" className="hover:text-primary">홈</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">환불 정책</span>
        </nav>

        <h1 className="text-3xl font-bold text-foreground">환불 정책</h1>
        <p className="mt-2 text-sm text-foreground-muted">최종 업데이트: 2026년 3월 19일 · v1.1</p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-foreground">

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">제1조 (환불 대상)</h2>
            <p className="text-foreground-muted">
              환불은 <strong className="text-foreground">미사용 포인트</strong>에 한해 신청할 수 있습니다.
              아래의 경우는 환불 대상에 포함되지 않습니다.
            </p>
            <ul className="mt-3 space-y-2 list-disc list-inside text-foreground-muted">
              <li>크루 참여금(에스크로)으로 예치된 포인트</li>
              <li>크루 생성 수수료로 사용된 포인트</li>
              <li>미션 리워드, 정산 분배 등으로 지급받은 포인트</li>
              <li>이벤트·프로모션을 통해 무상 지급된 포인트</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">제2조 (환불 신청 기간)</h2>
            <p className="text-foreground-muted">
              포인트 충전일로부터 <strong className="text-foreground">7일 이내</strong>에 한해 환불을 신청할 수 있습니다.
              충전 후 7일이 경과한 포인트는 환불이 불가능합니다.
            </p>
            <p className="mt-2 text-foreground-muted">
              이는 「전자상거래 등에서의 소비자보호에 관한 법률」 제17조에 따른 청약철회 기간을 준용합니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">제2-2조 (포인트 이용기간)</h2>
            <p className="text-foreground-muted">
              충전된 포인트의 이용기간은 <strong className="text-foreground">결제일로부터 1년</strong>입니다.
              이용기간이 경과한 포인트는 자동 소멸되며 환불이 불가합니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">제3조 (환불 신청 방법)</h2>
            <p className="text-foreground-muted">환불을 신청하려면 아래 방법으로 고객센터에 문의해 주세요.</p>
            <div className="mt-3 rounded-xl border border-neutral bg-surface p-4 space-y-1">
              <p><span className="font-semibold text-foreground">이메일:</span> <span className="text-foreground-muted">support@textfactory.kr</span></p>
              <p><span className="font-semibold text-foreground">전화:</span> <span className="text-foreground-muted">070-8027-1918</span></p>
              <p><span className="font-semibold text-foreground">운영 시간:</span> <span className="text-foreground-muted">평일 10:00 ~ 18:00 (주말·공휴일 제외)</span></p>
            </div>
            <p className="mt-3 text-foreground-muted">문의 시 아래 정보를 함께 알려주시면 빠른 처리가 가능합니다.</p>
            <ul className="mt-2 space-y-1 list-disc list-inside text-foreground-muted">
              <li>가입 이메일 주소</li>
              <li>충전 일자 및 금액</li>
              <li>환불 요청 포인트 수량</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">제4조 (환불 처리 기간 및 방법)</h2>
            <ul className="space-y-2 list-disc list-inside text-foreground-muted">
              <li>환불 신청 확인 후 <strong className="text-foreground">영업일 기준 3~5일 이내</strong>에 처리됩니다.</li>
              <li>환불은 결제에 사용된 <strong className="text-foreground">동일 결제수단</strong>(신용카드, 계좌이체 등)으로만 원상 복구됩니다.</li>
              <li>결제 수단에 따라 카드사 처리 일정이 상이할 수 있습니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">제5조 (환불 제한 사유)</h2>
            <p className="text-foreground-muted">다음의 경우 환불이 제한될 수 있습니다.</p>
            <ul className="mt-3 space-y-2 list-disc list-inside text-foreground-muted">
              <li>서비스 이용약관을 위반한 경우</li>
              <li>부정한 방법으로 포인트를 획득하거나 사용한 경우</li>
              <li>허위 또는 부정 결제가 의심되는 경우</li>
              <li>포인트 이용기간(결제일로부터 1년)이 경과한 경우</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">제5-2조 (포인트 양도 및 매매 금지)</h2>
            <p className="text-foreground-muted">
              충전된 포인트는 <strong className="text-foreground">타인에게 양도하거나 매매할 수 없습니다</strong>.
              양도 또는 매매 시도가 확인될 경우 계정이 제한될 수 있으며, 해당 포인트에 대한 환불은 불가합니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">제6조 (법적 근거)</h2>
            <p className="text-foreground-muted">
              본 환불 정책은 「전자상거래 등에서의 소비자보호에 관한 법률」, 「콘텐츠산업 진흥법」 및
              관련 소비자 보호 법령을 준수하여 작성되었습니다.
            </p>
          </section>

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-foreground-muted">
            환불 정책에 대한 문의는 <strong className="text-foreground">support@textfactory.kr</strong>로 연락해 주세요.
            불편을 드려 죄송하며, 신속히 처리해 드리겠습니다.
          </div>

        </div>
      </div>
      <Footer />
    </div>
  );
}
