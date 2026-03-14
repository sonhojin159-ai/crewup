import { ChatMessage } from "./types";

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
}

export default function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  const time = new Date(message.created_at).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isOwn) {
    return (
      <div className="flex justify-end gap-2">
        <span className="self-end text-xs text-foreground-muted">{time}</span>
        <div className="max-w-[70%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-white">
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary/20 text-xs font-bold text-secondary-text">
        {message.profiles.nickname.charAt(0)}
      </div>
      <div className="max-w-[70%]">
        <p className="mb-1 text-xs font-medium text-foreground-muted">
          {message.profiles.nickname}
        </p>
        <div className="rounded-2xl rounded-tl-md bg-surface border border-neutral px-4 py-2.5 text-sm text-foreground">
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
      </div>
      <span className="self-end text-xs text-foreground-muted">{time}</span>
    </div>
  );
}
