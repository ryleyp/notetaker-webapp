import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

function buildSynthesisPrompt(notes, today) {
  const threeMonthsAgo = new Date(today);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const rangeLabel = `${threeMonthsAgo.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} – ${new Date(today).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;

  const noteBlocks = notes
    .map((n, i) => `### Note ${i + 1}: ${n.title} (${n.date})\n\n${n.content}`)
    .join("\n\n---\n\n");

  return `You are analyzing ${notes.length} meeting notes from the past quarter (${rangeLabel}) to produce a concise Account Status summary.

---
MEETING NOTES:

${noteBlocks}

---

Generate an Account Status document using EXACTLY this structure. Be specific and concrete — reference actual names, dates, decisions, and items from the notes. Do not be generic.

# Account Status — ${rangeLabel}

*Generated from ${notes.length} meeting notes*

---

## Recent Highlights

Key decisions, outcomes, and notable updates from the past quarter. Group by theme or project if patterns emerge. Use bullets.

---

## Open Action Items

Aggregate ALL unchecked action items (lines starting with "- [ ]") from across all notes. Include who owns each item and the source note date. Format:
- [ ] [Action item] — **Owner:** [Name] | **From:** [Date]

If an item appears resolved in a later note, omit it.

---

## Key Themes & Trends

3–5 bullet points identifying recurring topics, patterns, risks, or concerns that appear across multiple meetings.

---

## NI SW Customer Success Watch Items

All items relevant to the Customer Success team — customer concerns, commitments, escalations, product issues, feedback trends — aggregated across the quarter.

---

## Recommended Next Steps

Based on open action items and trends, list the highest-priority next steps for the coming weeks in priority order.`;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { notes, apiKey, model, today } = body;

    if (!notes || notes.length === 0) {
      return NextResponse.json({ error: "No notes provided" }, { status: 400 });
    }

    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) {
      return NextResponse.json(
        { error: "Anthropic API key is required" },
        { status: 400 }
      );
    }

    const client = new Anthropic({ apiKey: key });

    const message = await client.messages.create({
      model: model || "claude-sonnet-4-6",
      max_tokens: 8192,
      system:
        "You are an expert at synthesizing meeting notes into clear, actionable executive summaries. Respond with only the Markdown document — no preamble.",
      messages: [
        {
          role: "user",
          content: buildSynthesisPrompt(notes, today || new Date().toISOString().split("T")[0]),
        },
      ],
    });

    const output = message.content[0]?.text || "";
    return NextResponse.json({ output, noteCount: notes.length });
  } catch (error) {
    console.error("Synthesis error:", error);
    return NextResponse.json(
      { error: error?.message || "Synthesis failed" },
      { status: error?.status || 500 }
    );
  }
}
