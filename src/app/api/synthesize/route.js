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

Generate an Account Status document using EXACTLY this structure. Be specific and concrete — reference actual names, dates, decisions, and items from the notes. Do not be generic. Do not omit any detail.

# Account Status — ${rangeLabel}

*Generated from ${notes.length} meeting notes*

---

## Recent Highlights

Key decisions, outcomes, and notable updates from the past quarter. Group by theme or project if patterns emerge. Include all specifics — names, dates, numbers. Use bullets with sub-bullets for detail.

---

## Open Action Items

Aggregate ALL unchecked action items (lines starting with "- [ ]") from across all notes. Include who owns each item and the source note date. Format:
- [ ] [Action item] — **Owner:** [Name] | **From:** [Date]

If an item appears resolved in a later note, omit it.

---

## Pillars of Account Health

Synthesize insights from all notes across the five pillars. For each pillar, include every relevant detail — do not summarize away specifics. Use sub-bullets. If a pillar has no relevant information across the quarter, write "Nothing noted."

### Proficiency & Self Service
*Strategy to build NI tool skill, self-service capabilities, scaling enablement*
Actions to consider: Proficiency plans for new/experienced users · Embedding NI collateral into account L&D · NI in onboarding process

- [all relevant details from across all notes]

### Adoption
*Opportunities to drive new users and new products into successful use*
Actions to consider: Hypercare for SW evaluations/pilots · SW deployment strategies w/ sponsors · Access enablement customization · Support & case trend response

- [all relevant details from across all notes]

### Sponsors & End Users
*Relationships being built, trust and closeness with key people*
Actions to consider: Engagement strategy for sponsors w/ influence · End-user insight capture & outreach · Cadence for travel, meetings, comms

- [all relevant details from across all notes]

### Expansion
*Portfolio whitespace — what the customer isn't using and why*
Actions to consider: Whitespace assessment & expansion strategy · Investigation of expansion areas · NI success collateral for account growth

- [all relevant details from across all notes]

### Renewal Readiness
*Risks and opportunities before the next EA/VLA renewal*
Actions to consider: Risk identification & active management · Equip SSMs with renewal negotiation points · Leverage sponsor relationships to reduce risk/churn

- [all relevant details from across all notes]

### Overall CS Score
*How healthy is this account's CS posture right now?*

Provide a G/Y/R (Green/Yellow/Red) assessment with a 3-5 sentence rationale synthesizing the quarter's data across all five pillars.

---

## Key Themes & Trends

3–5 bullet points identifying recurring topics, patterns, risks, or concerns that appear across multiple meetings.

---

## Recommended Next Steps

Based on open action items, pillar gaps, and trends, list the highest-priority next steps for the coming weeks in priority order.`;
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
    return NextResponse.json({ output, noteCount: notes.length, usage: message.usage, model: model || "claude-sonnet-4-6" });
  } catch (error) {
    console.error("Synthesis error:", error);
    return NextResponse.json(
      { error: error?.message || "Synthesis failed" },
      { status: error?.status || 500 }
    );
  }
}
