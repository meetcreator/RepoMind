"use client";
import { useState, useRef, useEffect } from "react";
import { streamChat } from "@/lib/api";
import type { ChatMessage } from "@/types";
import { RepoNav, RepoTabBar } from "@/components/layout/RepoNav";
import { getRepo } from "@/lib/api";
import type { Repo } from "@/types";

export default function ChatPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [repo, setRepo] = useState<Repo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const cancelRef = useRef<(() => void) | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { getRepo(id).then(setRepo); }, [id]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  function send() {
    if (!input.trim() || streaming) return;
    const userMsg: ChatMessage = { role: "user", content: input };
    const assistantMsg: ChatMessage = { role: "assistant", content: "" };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setStreaming(true);

    cancelRef.current = streamChat(
      id,
      userMsg.content,
      messages,
      (token) => {
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { ...copy[copy.length - 1], content: copy[copy.length - 1].content + token };
          return copy;
        });
      },
      () => { setStreaming(false); cancelRef.current = null; },
      (err) => {
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { ...copy[copy.length - 1], content: `Error: ${err}` };
          return copy;
        });
        setStreaming(false);
      },
    );
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <RepoNav />
      {repo && <RepoTabBar id={id} />}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem" }}>
        <div style={{ maxWidth: "720px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "1rem" }}>
          {messages.length === 0 && (
            <div style={{ textAlign: "center", color: "var(--text-muted)", marginTop: "4rem" }}>
              <p style={{ fontSize: "0.9375rem", marginBottom: "0.5rem" }}>Ask anything about this codebase.</p>
              <p style={{ fontSize: "0.8125rem" }}>Try: &quot;Why is auth failing?&quot; or &quot;Where should I add caching?&quot;</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
              <div className={`chat-bubble chat-bubble-${msg.role}`}>
                {msg.content || (streaming && msg.role === "assistant" ? <BlinkCursor /> : "")}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input bar */}
      <div style={{ borderTop: "1px solid var(--border)", background: "var(--surface)", padding: "0.75rem 1.5rem" }}>
        <div style={{ maxWidth: "720px", margin: "0 auto", display: "flex", gap: "0.5rem", alignItems: "flex-end" }}>
          <textarea
            ref={textareaRef}
            className="input"
            rows={1}
            placeholder="Ask a question about this codebase..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            style={{ resize: "none", lineHeight: "1.5", minHeight: "38px", maxHeight: "120px", overflow: "auto" }}
          />
          {streaming ? (
            <button className="btn btn-secondary" onClick={() => cancelRef.current?.()}>Stop</button>
          ) : (
            <button className="btn btn-primary" onClick={send} disabled={!input.trim()}>Send</button>
          )}
        </div>
        <p style={{ maxWidth: "720px", margin: "0.375rem auto 0", fontSize: "0.75rem", color: "var(--text-muted)" }}>
          Enter to send · Shift+Enter for newline
        </p>
      </div>
    </div>
  );
}

function BlinkCursor() {
  return <span style={{ animation: "blink 1s step-start infinite", borderRight: "2px solid currentColor" }}>
    <style>{`@keyframes blink { 50% { opacity: 0 } }`}</style>
  </span>;
}
