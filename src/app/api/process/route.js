import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `You are an expert meeting notes specialist. When given a meeting transcript, you produce highly detailed, structured meeting notes in Markdown format.

Your notes must be extremely thorough — do not omit any important information, decisions, or discussions from the transcript.

Always respond with ONLY the Markdown content, no preamble or explanation.`;

function buildPrompt(transcript, meetingTitle, meetingDate) {
  return `Please analyze this meeting transcript and create detailed meeting notes.

Meeting Title: ${meetingTitle || "Meeting"}
Meeting Date: ${meetingDate || new Date().toISOString().split("T")[0]}

---
TRANSCRIPT:
${transcript}
---

Generate meeting notes with EXACTLY these five sections in this order:

# ${meetingTitle || "Meeting Notes"} — ${meetingDate || new Date().toISOString().split("T")[0]}

---

## Executive Summary

Write 3-5 concise sentences capturing the overall purpose, key outcomes, and most important decisions from this meeting.

---

## Meeting Notes

Provide extremely detailed bulleted notes that capture ALL important information from the transcript. Do not skip any significant point. Use sub-bullets for details. Organize by topic when appropriate. If someone makes a notable statement, quote or closely paraphrase it.

---

## Things NI SW Customer Success Should Take Note Of

List all items specifically relevant to the Customer Success team — customer concerns raised, commitments made to customers, product issues affecting customers, customer escalations, feedback trends, or anything the CS team needs to act on or be aware of.

---

## Action Items

List all action items as Markdown task checkboxes. For each item include who owns it and a due date if mentioned. Format:
- [ ] [Action item description] — **Owner:** [Name or Team] | **Due:** [Date or "TBD"]

---

## Next Steps

List the agreed-upon next steps, upcoming milestones, follow-up meetings, or planned deliverables in priority order.`;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { transcript, meetingTitle, meetingDate, apiKey } = body;

    if (!transcript || transcript.trim().length === 0) {
      return NextResponse.json({ error: "Transcript is required" }, { status: 400 });
    }

    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) {
      return NextResponse.json(
        { error: "Anthropic API key is required. Add it in Settings or set ANTHROPIC_API_KEY in .env.local" },
        { status: 400 }
      );
    }

    const client = new Anthropic({ apiKey: key });

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: buildPrompt(transcript, meetingTitle, meetingDate),
        },
      ],
    });

    const notes = message.content[0]?.text || "";
    const usage = message.usage;

    return NextResponse.json({ notes, usage });
  } catch (error) {
    console.error("Error processing transcript:", error);
    const message = error?.message || "Failed to process transcript";
    const status = error?.status || 500;
    return NextResponse.json({ error: message }, { status });
  }
}
