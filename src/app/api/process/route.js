import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `You are an expert meeting notes specialist. When given a meeting transcript, you produce highly detailed, structured meeting notes in Markdown format.

Your notes must be extremely thorough — do not omit any important information, decisions, or discussions from the transcript.

Always respond with ONLY the Markdown content, no preamble or explanation.`;

const TAG_CATEGORIES = `
Extract tags ONLY if explicitly mentioned in the transcript. Use lowercase, no spaces (use hyphens for multi-word).

Categories to check:
- Cities: austin, dallas, houston, denver, seattle, chicago, boston, san-francisco, new-york, nashville, atlanta, phoenix, minneapolis, raleigh, detroit, los-angeles, portland, columbus, indianapolis, etc.
- US States: texas, colorado, washington, california, illinois, massachusetts, ohio, georgia, michigan, tennessee, north-carolina, florida, arizona, minnesota, oregon, etc.
- NI Software: systemlink, labview, teststand, diadem, flexlogger, veristand, ni-daqmx, labwindows-cvi, measurement-studio, ni-visa, opentestbed, etc.
- Software / Dev languages & tools: python, c, c-plus-plus, matlab, java, javascript, typescript, dotnet, rust, sql, r, julia, simulink, etc.
- Other tools or platforms mentioned prominently (e.g. github, azure, aws, jira, confluence, salesforce)
- Accounts / customers: lockheed, northrop, frontgrade, l3harris — and any other company or customer name that is clearly a customer or account being discussed

Only include a tag if that city/state/technology is actually discussed — not just briefly mentioned in passing.`;

function buildPrompt(transcript, meetingTitle, meetingDate) {
  const date = meetingDate || new Date().toISOString().split("T")[0];
  const title = meetingTitle || "Meeting Notes";

  return `Please analyze this meeting transcript and create detailed meeting notes.

Meeting Title: ${title}
Meeting Date: ${date}

---
TRANSCRIPT:
${transcript}
---

${TAG_CATEGORIES}

Generate the meeting notes with EXACTLY this structure. Do NOT include a YAML frontmatter block.

# ${date} - ${title}

<tag line: list extracted tags inline as #tag1 #tag2 #tag3>

---

## Executive Summary

Write 3-5 concise sentences capturing the overall purpose, key outcomes, and most important decisions from this meeting.

---

## Meeting Notes

Provide thorough bulleted notes that capture all important information from the transcript. Focus on decisions, key points, and meaningful details — skip filler, repetition, and tangential remarks. Use sub-bullets for important specifics. Organize by topic when appropriate. Quote or closely paraphrase notable statements.

---

## Things NI SW Customer Success Should Take Note Of

Flag the most important items for NI Software's Customer Success team. Include: adoption signals, product usage concerns, customer frustrations or praise, risks to renewal or expansion, opportunities for CS to engage, and any commitments made to the customer. Be concise — one clear bullet per point, no filler.

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
    const { transcript, meetingTitle, meetingDate, apiKey, model } = body;

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
      model: model || "claude-sonnet-4-6",
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
