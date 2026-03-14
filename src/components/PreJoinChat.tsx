"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  profiles?: {
    nickname: string;
    avatar_url: string;
  };
}

export default function PreJoinChat({ crewId, isLeader, applicantId }: { crewId: string, isLeader?: boolean, applicantId?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
    if (!isOpen || !crewId) return;
    setIsLoading(true);
    try {
      const url = isLeader && applicantId 
        ? `/api/crews/${crewId}/chat?applicantId=${applicantId}`
        : `/api/crews/${crewId}/chat?applicantId=${currentUserId}`;
        
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
     createClient().auth.getUser().then(({ data }) => {
         if (data?.user) setCurrentUserId(data.user.id);
     });
  }, []);

  useEffect(() => {
    if (!isOpen || !crewId || !currentUserId) return;

    const supabase = createClient();
    
    // 1. 초기 메시지 가져오기
    fetchMessages();

    // 2. Realtime 구독 설정
    // applicantId가 있으면 지원자-크루장 대화, 없으면 로그인 유저 본인이 지원자임
    const targetId = isLeader ? applicantId : currentUserId;
    
    const channel = supabase
      .channel(`pre-join-chat-${crewId}-${targetId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
        },
        async (payload) => {
          // 해당 채팅방의 메시지인지 확인 (ID 기반)
          // chat_id를 통해 필터링하는 것이 좋으나, 여기서는 메시지 하나씩 처리
          const { data: chatData } = await supabase
            .from('crew_chats')
            .select('applicant_id, id')
            .eq('id', payload.new.chat_id)
            .single();

          if (chatData && chatData.applicant_id === targetId) {
             // 새 메시지 발신인의 닉네임 정보 가져오기
             const { data: profile } = await supabase
               .from('profiles')
               .select('nickname, avatar_url')
               .eq('id', payload.new.sender_id)
               .single();

             const newMessage: Message = {
               ...payload.new as any,
               profiles: profile || { nickname: '알 수 없음', avatar_url: '' }
             };

             setMessages(prev => {
                if (prev.some(m => m.id === newMessage.id)) return prev;
                return [...prev, newMessage];
             });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, crewId, currentUserId, applicantId, isLeader]);

  useEffect(() => {
    if (isOpen) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !currentUserId) return;

    const currentContent = content;
    setContent(""); // optimstic clear
    
    // optimstic UI update
    const tempMsg: Message = {
      id: Math.random().toString(),
      content: currentContent,
      sender_id: currentUserId,
      created_at: new Date().toISOString(),
      profiles: { nickname: '나', avatar_url: '' }
    };
    setMessages(prev => [...prev, tempMsg]);

    try {
      const res = await fetch(`/api/crews/${crewId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            content: currentContent,
            targetApplicantId: isLeader ? applicantId : undefined 
        }),
      });
      // realtime이 처리하므로 fetchMessages()를 수동으로 부를 필요 없음
    } catch (e) {
      alert("메시지 전송에 실패했습니다.");
      setContent(currentContent);
    }
  };

  if (!isOpen) {
    if (isLeader) {
        return (
            <button onClick={() => setIsOpen(true)} className="btn-outline !py-1.5 !px-3 text-xs w-full mt-2">
                채팅 열기
            </button>
        )
    }
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg hover:bg-primary/90 transition-transform hover:scale-105 z-50"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.068.157 2.148.279 3.238.364.466.037.893.281 1.153.671L12 21l2.652-3.978c.26-.39.687-.634 1.153-.67 1.09-.086 2.17-.208 3.238-.365 1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
        </svg>
      </button>
    );
  }

  return (
    <div className={isLeader ? "mt-3 border rounded-xl overflow-hidden shadow-sm bg-background flex flex-col" : "fixed bottom-6 right-6 w-[85vw] sm:w-[380px] bg-surface border border-neutral rounded-2xl shadow-xl z-50 flex flex-col overflow-hidden transition-all duration-300"} style={{ height: isLeader ? '350px' : '500px', maxHeight: isLeader ? 'none' : '80vh' }}>
      {/* Header */}
      <div className="bg-primary/10 border-b border-primary/20 p-4 flex justify-between items-center">
        <h3 className="font-bold text-primary text-sm flex items-center gap-2">
           💬 {isLeader ? '지원자와의 대화' : '크루장에게 사전 문의하기'}
        </h3>
        <button onClick={() => setIsOpen(false)} className="text-primary hover:text-primary/70 font-semibold text-lg leading-none p-1 rounded-md hover:bg-primary/5 transition-colors">
          ✕
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background/50">
        {messages.length === 0 && !isLoading && (
          <p className="text-center text-xs text-foreground-muted mt-10">
            {isLeader ? '아직 대화 내역이 없습니다.' : '궁금한 점을 크루장에게 물어보세요!'}
          </p>
        )}
        {messages.map((msg) => {
          const isMe = msg.sender_id === currentUserId;
          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                isMe ? 'bg-primary text-white rounded-br-none shadow-sm' : 'bg-surface border border-neutral/50 text-foreground rounded-bl-none shadow-sm'
              }`}>
                {msg.content}
              </div>
              <span className="text-[10px] text-foreground-muted mt-1 px-1">
                {new Date(msg.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-neutral bg-surface">
        <form onSubmit={sendMessage} className="flex gap-2 relative">
          <input
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="메시지를 입력하세요..."
            className="flex-1 bg-neutral/10 border-transparent rounded-full pl-5 pr-12 py-3 text-sm focus:bg-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-foreground-muted"
          />
          <button 
            type="submit" 
            disabled={!content.trim() || isLoading}
            className="absolute right-1.5 top-1.5 bg-primary text-white w-9 h-9 flex items-center justify-center rounded-full shrink-0 disabled:opacity-50 transition-transform active:scale-95"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 translate-x-[1px] translate-y-[1px]">
              <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
