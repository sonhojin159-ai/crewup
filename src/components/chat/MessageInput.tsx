"use client";

import { useState, KeyboardEvent } from "react";

interface MessageInputProps {
  onSend: (content: string) => Promise<void>;
  disabled?: boolean;
}

const MAX_LENGTH = 1000;

export default function MessageInput({ onSend, disabled }: MessageInputProps) {
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || isSending || disabled) return;

    setIsSending(true);
    try {
      await onSend(trimmed);
      setText("");
    } catch {
      alert("메시지 전송에 실패했습니다.");
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-neutral bg-white px-4 py-3">
      <div className="flex items-end gap-2">
        <div className="relative flex-1">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_LENGTH))}
            onKeyDown={handleKeyDown}
            placeholder="메시지를 입력하세요..."
            rows={1}
            disabled={disabled}
            className="form-input max-h-24 min-h-[44px] resize-none !py-2.5 pr-12"
          />
          <span className="absolute bottom-2 right-3 text-[10px] text-foreground-muted">
            {text.length}/{MAX_LENGTH}
          </span>
        </div>
        <button
          onClick={handleSend}
          disabled={!text.trim() || isSending || disabled}
          className="btn-primary min-h-[44px] px-4 disabled:opacity-50"
        >
          {isSending ? "..." : "전송"}
        </button>
      </div>
    </div>
  );
}
