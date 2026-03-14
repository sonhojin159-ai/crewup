"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { ChatMessage } from "./types";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";

interface ChatRoomProps {
  crewId: string;
  currentUserId: string;
}

export default function ChatRoom({ crewId, currentUserId }: ChatRoomProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 초기 메시지 로드
  useEffect(() => {
    const loadMessages = async () => {
      const supabase = createClient();
      // crew_messages 테이블: 크루 내부 그룹 채팅용
      const { data, error } = await supabase
        .from("crew_messages")
        .select("*, profiles:user_id(nickname, avatar_url)")
        .eq("crew_id", crewId)
        .order("created_at", { ascending: true })
        .limit(50);

      if (error) {
        console.error("Failed to load messages:", error);
      } else {
        setMessages(data as ChatMessage[]);
      }
      setIsLoading(false);
    };

    loadMessages();
  }, [crewId]);

  // Realtime 구독
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`crew-chat-${crewId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "crew_messages",
          filter: `crew_id=eq.${crewId}`,
        },
        async (payload) => {
          // 새 메시지의 프로필 정보 조회
          const { data: profile } = await supabase
            .from("profiles")
            .select("nickname, avatar_url")
            .eq("id", payload.new.user_id)
            .single();

          const newMessage: ChatMessage = {
            ...(payload.new as Omit<ChatMessage, "profiles">),
            profiles: profile || { nickname: "알 수 없음", avatar_url: null },
          };

          setMessages((prev) => {
            // 중복 방지
            if (prev.some((m) => m.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [crewId]);

  // 메시지 전송
  const handleSend = useCallback(
    async (content: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("crew_messages").insert({
        crew_id: crewId,
        user_id: currentUserId,
        content,
      });

      if (error) {
        throw new Error(error.message);
      }
    },
    [crewId, currentUserId]
  );

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-foreground-muted">
        메시지를 불러오는 중...
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <MessageList messages={messages} currentUserId={currentUserId} />
      <MessageInput onSend={handleSend} />
    </div>
  );
}
