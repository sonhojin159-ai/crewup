import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Header from "@/components/Header";
import ChatRoom from "@/components/chat/ChatRoom";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // 인증 확인
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 크루 정보 조회
  const { data: crew } = await supabase
    .from("crews")
    .select("id, title")
    .eq("id", id)
    .single();

  if (!crew) {
    redirect("/crews");
  }

  // 멤버십 확인
  const { data: member } = await supabase
    .from("crew_members")
    .select("status")
    .eq("crew_id", id)
    .eq("user_id", user.id)
    .single();

  // 비멤버 또는 비활성 멤버 처리
  if (!member || member.status !== "active") {
    const message =
      member?.status === "pending"
        ? "크루 승인 대기 중입니다. 승인 후 채팅을 이용할 수 있습니다."
        : "크루에 참여한 멤버만 이용 가능합니다.";

    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
          <p className="text-foreground-muted">{message}</p>
          <Link href={`/crews/${id}`} className="btn-primary mt-4">
            크루 상세로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      {/* Breadcrumb */}
      <div className="border-b border-neutral bg-white px-4 py-3">
        <nav className="mx-auto max-w-4xl text-sm text-foreground-muted">
          <Link href="/crews" className="hover:text-primary">
            크루 찾기
          </Link>
          <span className="mx-2">/</span>
          <Link href={`/crews/${id}`} className="hover:text-primary">
            {crew.title}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">채팅</span>
        </nav>
      </div>

      <ChatRoom crewId={id} currentUserId={user.id} />
    </div>
  );
}
