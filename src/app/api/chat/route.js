import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { assertTrustedRequest } from "@/lib/requestSafety";

const SYSTEM_PROMPT = `You are a meeting assistant. You have the full transcript of a meeting and the structured notes generated from it. Answer the user's questions about this meeting.

Rules:
- Ground every answer in the transcript and notes. If something was not discussed in the meeting, say so plainly — never invent details.
- Be concise and direct. Use Markdown formatting (lists, bold) where it helps readability.
- When asked to draft a follow-up email or message, write it ready to send in a professional, warm tone, covering the key points, decisions, and action items relevant to the request.
- Keep any pseudonymized names (e.g. ORG_A, PERSON_1) exactly as written — do not guess what they stand for.`;

function buildSystem({ meetingTitle, transcript, notes }) {
  const parts = [SYSTEM_PROMPT, `Meeting title: ${meetingTitle || "Untitled meeting"}`];
  parts.push(`--- TRANSCRIPT ---\n${transcript}`);
  if (notes?.trim()) parts.push(`--- GENERATED NOTES ---\n${notes}`);
  return parts.join("\n\n");
}

export async function POST(request) {
  try {
    assertTrustedRequest(request);

    const body = await request.json();
    const { messages, transcript, notes, meetingTitle, apiKey, model } = body;

    if (!transcript || !transcript.trim()) {
      return NextResponse.json({ error: "Transcript is required" }, { status: 400 });
    }
    const history = (Array.isArray(messages) ? messages : [])
      .filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string" && m.content.trim())
      .map((m) => ({ role: m.role, content: m.content }));
    if (history.length === 0 || history[history.length - 1].role !== "user") {
      return NextResponse.json({ error: "A user question is required" }, { status: 400 });
    }

    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) {
      return NextResponse.json(
        { error: "Anthropic API key is required. Add it in Settings or set ANTHROPIC_API_KEY in .env.local" },
        { status: 400 }
      );
    }

    const client = new Anthropic({ apiKey: key });

    const stream = client.messages.stream({
      model: model || "claude-haiku-4-5",
      max_tokens: 4096,
      system: buildSystem({ meetingTitle, transcript, notes }),
      messages: history,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        const send = (obj) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        try {
          for await (const chunk of stream) {
            if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
              send({ type: "delta", text: chunk.delta.text });
            }
          }
          const finalMsg = await stream.finalMessage();
          send({ type: "done", usage: finalMsg.usage });
        } catch (err) {
          send({ type: "error", message: err?.message || "Chat failed" });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error in meeting chat:", error);
    return NextResponse.json(
      { error: error?.message || "Chat failed" },
      { status: error?.status || 500 }
    );
  }
}
