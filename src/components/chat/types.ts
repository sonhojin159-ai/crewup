export interface ChatMessage {
  id: string;
  crew_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles: {
    nickname: string;
    avatar_url: string | null;
  };
}
