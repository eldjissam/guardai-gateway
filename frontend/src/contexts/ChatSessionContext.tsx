import { createContext, useContext, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";

export interface ChatSessionSummary {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface ChatSessionContextValue {
  sessions: ChatSessionSummary[];
  setSessions: Dispatch<SetStateAction<ChatSessionSummary[]>>;
  activeSessionId: string | null;
  setActiveSessionId: Dispatch<SetStateAction<string | null>>;
}

const ChatSessionContext = createContext<ChatSessionContextValue | null>(null);

export function ChatSessionProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const value = useMemo(() => ({ sessions, setSessions, activeSessionId, setActiveSessionId }), [sessions, activeSessionId]);
  return <ChatSessionContext.Provider value={value}>{children}</ChatSessionContext.Provider>;
}

export function useChatSessions() {
  const context = useContext(ChatSessionContext);
  if (!context) throw new Error("useChatSessions must be used inside ChatSessionProvider.");
  return context;
}
