import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex flex-col items-center justify-center px-4 py-32 text-center">
        <p className="text-8xl font-black text-primary/20">404</p>
        <h1 className="mt-4 text-2xl font-bold text-foreground">페이지를 찾을 수 없습니다</h1>
        <p className="mt-3 max-w-sm text-sm text-foreground-muted">
          요청하신 페이지가 삭제되었거나 주소가 변경되었을 수 있습니다.
        </p>
        <Link href="/" className="mt-8 btn-primary !px-8">
          홈으로 돌아가기
        </Link>
      </div>
      <Footer />
    </div>
  );
}
