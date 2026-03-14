import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";

export const metadata = {
  title: "고객센터 | 크루업",
  description: "크루업 고객센터 및 자주 묻는 질문",
};

const FAQS = [
  {
    q: "크루 참여금(에스크로)은 언제 돌려받을 수 있나요?",
    a: "참여금은 크루 미션 달성 시 리워드로 배분됩니다. 크루장이 임의로 해산할 경우, 크루장이 선납한 보호 예치금을 통해 멤버에게 보상됩니다. 자발적 탈퇴 시에는 환급되지 않습니다.",
  },
  {
    q: "크루장이 사기를 치면 어떻게 되나요?",
    a: "신고 기능을 통해 부정행위를 신고하실 수 있습니다. 확인된 부정행위에 대해서는 계정 정지 및 법적 증거 리포트가 제공됩니다.",
  },
  {
    q: "포인트는 어떻게 충전하나요?",
    a: "상단 메뉴의 '마이 월렛' → '포인트 충전'을 통해 결제하실 수 있습니다. 현재 부트페이(카드, 계좌이체 등)를 지원합니다.",
  },
  {
    q: "비밀번호를 잊어버렸습니다.",
    a: "로그인 페이지의 '비밀번호 찾기' 링크를 통해 가입하신 이메일로 재설정 링크를 받으실 수 있습니다.",
  },
  {
    q: "회원 탈퇴는 어떻게 하나요?",
    a: "현재 고객센터 이메일로 탈퇴 요청을 보내주시면 처리해 드립니다. 잔여 포인트 및 에스크로가 있는 경우 탈퇴 전 정리가 필요합니다.",
  },
  {
    q: "소셜 로그인(카카오/네이버/구글)이 안 됩니다.",
    a: "소셜 로그인은 현재 설정 중입니다. 이메일/비밀번호로 가입 후 이용해 주세요.",
  },
];

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-3xl px-4 py-12">
        <nav className="mb-6 text-sm text-foreground-muted">
          <Link href="/" className="hover:text-primary">홈</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">고객센터</span>
        </nav>

        <h1 className="text-3xl font-bold text-foreground">고객센터</h1>
        <p className="mt-2 text-sm text-foreground-muted">문의 사항이 있으시면 아래 채널을 이용해 주세요.</p>

        {/* 연락처 카드 */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-neutral bg-surface p-5">
            <p className="text-2xl">✉️</p>
            <p className="mt-2 font-semibold text-foreground">이메일 문의</p>
            <p className="mt-1 text-sm text-foreground-muted">support@crewup.kr</p>
            <p className="mt-1 text-xs text-foreground-muted">평일 09:00 – 18:00 (3일 내 답변)</p>
          </div>
          <div className="rounded-2xl border border-neutral bg-surface p-5">
            <p className="text-2xl">📋</p>
            <p className="mt-2 font-semibold text-foreground">신고 및 제재 요청</p>
            <p className="mt-1 text-sm text-foreground-muted">크루원 또는 크루장의 부정행위 신고는 서비스 내 신고 버튼을 이용해 주세요.</p>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-12">
          <h2 className="text-xl font-bold text-foreground mb-6">자주 묻는 질문 (FAQ)</h2>
          <div className="space-y-4">
            {FAQS.map((faq, i) => (
              <details
                key={i}
                className="group rounded-xl border border-neutral bg-surface p-5 cursor-pointer"
              >
                <summary className="font-semibold text-foreground list-none flex items-center justify-between">
                  {faq.q}
                  <span className="ml-4 text-foreground-muted transition-transform group-open:rotate-180">▾</span>
                </summary>
                <p className="mt-3 text-sm text-foreground-muted leading-relaxed">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>

        {/* 관련 링크 */}
        <div className="mt-10 rounded-2xl border border-neutral/60 bg-surface/50 p-5 text-sm text-foreground-muted">
          관련 문서:&nbsp;
          <Link href="/terms" className="text-primary hover:underline">이용약관</Link>
          &nbsp;·&nbsp;
          <Link href="/privacy" className="text-primary hover:underline">개인정보처리방침</Link>
        </div>
      </div>
      <Footer />
    </div>
  );
}
