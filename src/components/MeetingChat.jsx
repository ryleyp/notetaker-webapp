"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { applyCorrections, applyReplacements, reverseReplacements } from "@/lib/sanitize";
import { calcCost, formatCost } from "@/lib/pricing";
import { apiFetch } from "@/lib/apiClient";

const QUICK_ACTIONS = [
  {
    label: "Draft follow-up email",
    prompt:
      "Draft a concise follow-up email to the attendees summarizing the key points, decisions, and action items from this meeting. Write it ready to send.",
  },
  {
    label: "Open questions",
    prompt: "List the open questions and unresolved topics from this meeting, and who should resolve each one.",
  },
  {
    label: "Key decisions",
    prompt: "List every decision made in this meeting, who made it, and any conditions attached to it.",
  },
];

export default function MeetingChat({
  transcript,
  notes,
  meetingTitle,
  replacements,
  corrections,
  apiKey,
  model,
}) {
  // Messages hold restored (real-name) text; aliasing happens on the way out.
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streamText, setStreamText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [totalCost, setTotalCost] = useState(null);
  const controllerRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streamText]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  function toAlias(text) {
    const corrected = applyCorrections(text || "", corrections || []);
    return replacements?.length ? applyReplacements(corrected, replacements) : corrected;
  }

  function toReal(text) {
    return replacements?.length ? reverseReplacements(text, replacements) : text;
  }

  async function send(question) {
    const q = (question ?? input).trim();
    if (!q || sending) return;

    setInput("");
    setError(null);
    const nextMessages = [...messages, { role: "user", content: q }];
    setMessages(nextMessages);
    setSending(true);
    setStreamText("");

    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      const res = await apiFetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          meetingTitle: toAlias(meetingTitle),
          transcript: toAlias(transcript),
          notes: toAlias(notes),
          messages: nextMessages.map((m) => ({ role: m.role, content: toAlias(m.content) })),
          apiKey: apiKey || undefined,
          model,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Chat failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      let buffer = "";
      let usage = null;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop();
        for (const part of parts) {
          if (!part.startsWith("data: ")) continue;
          const evt = JSON.parse(part.slice(6));
          if (evt.type === "delta") {
            accumulated += evt.text;
            setStreamText(toReal(accumulated));
          } else if (evt.type === "done") {
            usage = evt.usage;
          } else if (evt.type === "error") {
            throw new Error(evt.message);
          }
        }
      }

      setMessages([...nextMessages, { role: "assistant", content: toReal(accumulated) }]);
      setStreamText("");
      if (usage) {
        const c = calcCost(usage, model);
        setTotalCost((prev) =>
          prev
            ? {
                ...c,
                cost: prev.cost + c.cost,
                input_tokens: prev.input_tokens + c.input_tokens,
                output_tokens: prev.output_tokens + c.output_tokens,
              }
            : c
        );
      }
    } catch (e) {
      setStreamText("");
      if (e.name === "AbortError") {
        setError("Response canceled.");
      } else {
        setError(e.message);
      }
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
      setSending(false);
    }
  }

  function handleCancel() {
    controllerRef.current?.abort();
  }

  function copyMessage(content) {
    navigator.clipboard.writeText(content).catch(() => {});
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="section-header mb-0">Ask About This Meeting</h2>
          {totalCost && <span className="text-xs text-gray-400 font-mono">{formatCost(totalCost)}</span>}
        </div>
        {sending && (
          <button onClick={handleCancel} className="btn-secondary text-xs px-3 py-1.5">
            Cancel
          </button>
        )}
      </div>

      <div className="p-6 space-y-4">
        {(messages.length > 0 || streamText) && (
          <div ref={scrollRef} className="max-h-[400px] overflow-y-auto space-y-3 pr-1">
            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] rounded-lg bg-obsidian-600 text-white text-sm px-3.5 py-2 whitespace-pre-wrap">
                    {m.content}
                  </div>
                </div>
              ) : (
                <div key={i} className="flex justify-start">
                  <div className="max-w-[92%] rounded-lg bg-gray-50 border border-gray-200 px-3.5 py-2.5">
                    <div className="markdown-preview text-sm">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                    </div>
                    <button
                      onClick={() => copyMessage(m.content)}
                      className="mt-1.5 text-xs text-gray-400 hover:text-gray-600"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )
            )}
            {streamText && (
              <div className="flex justify-start">
                <div className="max-w-[92%] rounded-lg bg-gray-50 border border-gray-200 px-3.5 py-2.5">
                  <div className="markdown-preview text-sm">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamText}</ReactMarkdown>
                  </div>
                </div>
              </div>
            )}
            {sending && !streamText && (
              <div className="flex items-center gap-2 text-xs text-obsidian-600">
                <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Thinking...
              </div>
            )}
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((a) => (
            <button
              key={a.label}
              onClick={() => send(a.prompt)}
              disabled={sending}
              className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40"
            >
              {a.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            className="input flex-1"
            placeholder="Ask anything about this meeting..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
            disabled={sending}
          />
          <button onClick={() => send()} disabled={sending || !input.trim()} className="btn-primary whitespace-nowrap">
            Send
          </button>
        </div>
        {replacements?.length > 0 && (
          <p className="text-xs text-gray-400">
            Privacy replacements are applied to everything sent to Claude and restored in responses.
          </p>
        )}
      </div>
    </div>
  );
}
