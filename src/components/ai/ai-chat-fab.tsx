"use client";

import { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Send, Bot, Sparkles, X } from "lucide-react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const QUICK_ACTIONS = [
  { label: "맛집 추천", prompt: "이 여행지의 맛집을 추천해주세요.", type: "recommend" },
  { label: "일정 생성", prompt: "여행 일정을 만들어주세요.", type: "generate-schedule" },
  { label: "동선 체크", prompt: "이동 동선을 최적화해주세요.", type: "route-check" },
];

function MessageBubble({ message, userName, avatarUrl }: {
  message: ChatMessage;
  userName?: string;
  avatarUrl?: string | null;
}) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-2 items-end", isUser ? "flex-row-reverse" : "flex-row")}>
      {isUser ? (
        <Avatar size="sm">
          <AvatarImage src={avatarUrl ?? undefined} />
          <AvatarFallback>{userName?.[0] ?? "나"}</AvatarFallback>
        </Avatar>
      ) : (
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground shrink-0">
          <Bot className="w-3.5 h-3.5" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-muted text-foreground rounded-bl-sm"
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        <p
          className={cn(
            "text-[10px] mt-1",
            isUser ? "text-primary-foreground/60 text-right" : "text-muted-foreground"
          )}
        >
          {message.timestamp.toLocaleTimeString("ko-KR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}

export function AiChatFab() {
  const { tripId } = useParams<{ tripId: string }>();
  const { user } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "안녕하세요! AI 어시스턴트입니다.\n맛집 추천, 일정 생성, 동선 최적화를 도와드릴게요!",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(text: string, type?: string) {
    if (!text.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text.trim(), trip_id: tripId, type }),
      });

      const data = await res.json();

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: res.ok ? data.message : (data.error || "AI 응답에 실패했습니다. 다시 시도해주세요."),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <button className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95" />
        }
      >
        <Sparkles className="w-6 h-6" />
        <span className="sr-only">AI 어시스턴트 열기</span>
      </SheetTrigger>

      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="h-[85vh] sm:h-[80vh] rounded-t-2xl flex flex-col p-0"
      >
        {/* Header */}
        <SheetHeader className="flex-row items-center justify-between border-b px-4 py-3 space-y-0">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <SheetTitle className="text-base leading-tight">AI 어시스턴트</SheetTitle>
              <SheetDescription className="text-xs">여행 계획을 도와드릴게요</SheetDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)}>
            <X className="w-4 h-4" />
          </Button>
        </SheetHeader>

        {/* Quick actions */}
        <div className="flex gap-2 flex-wrap px-4 py-3 border-b">
          {QUICK_ACTIONS.map((action) => (
            <Button
              key={action.label}
              variant="outline"
              size="sm"
              onClick={() => sendMessage(action.prompt, action.type)}
              disabled={loading}
              className="text-xs"
            >
              {action.label}
            </Button>
          ))}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-3 px-4 py-3">
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              userName={user?.display_name}
              avatarUrl={user?.avatar_url}
            />
          ))}
          {loading && (
            <div className="flex gap-2 items-end">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground shrink-0">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t px-4 py-3">
          <div className="flex items-end gap-2 border rounded-xl px-3 py-2 bg-background shadow-sm focus-within:ring-2 focus-within:ring-ring">
            <Textarea
              placeholder="메시지를 입력하세요..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              className="flex-1 resize-none border-0 shadow-none focus-visible:ring-0 p-0 text-sm min-h-[36px] max-h-[80px] overflow-y-auto bg-transparent"
              disabled={loading}
            />
            <Button
              size="sm"
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="shrink-0 h-8 w-8 p-0 rounded-lg"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="sr-only">전송</span>
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
