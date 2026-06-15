import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { applyCorrections, applyReplacements, reverseReplacements } from "@/lib/sanitize";

function buildSynthesisPrompt(notes, today) {
  const threeMonthsAgo = new Date(today);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const rangeLabel = `${threeMonthsAgo.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} – ${new Date(today).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;

  const noteBlocks = notes
    .map((n, i) => {
      const tag = n.source === "transcript" ? " [Transcript]" : n.source === "cross-vault" ? ` [${n.sourceLabel}]` : "";
      return `### Source ${i + 1}: ${n.title} (${n.date})${tag}\n\n${n.content}`;
    })
    .join("\n\n---\n\n");

  return `You are a NI Software Customer Success Manager analyzing ${notes.length} meeting notes and transcripts from the past quarter (${rangeLabel}). Produce a detailed Account Status summary scoped to NI Software.

Scope rules:
- Focus on NI Software products, licenses, adoption, and CS activities
- Third-party software: mention briefly if relevant to NI context
- Hardware: mention only when directly tied to NI software usage
- Omit purely hardware or non-NI topics

Sources include Obsidian meeting notes, raw transcripts [Transcript], and notes from other folders that mention this account [folder name].

---
SOURCES:

${noteBlocks}

---

Generate the Account Status document using EXACTLY this structure. Be specific — reference actual names, dates, products, and details from the sources. Do not be vague.

# Account Status — ${rangeLabel}

*Synthesized from ${notes.length} sources*

---

## Recent Highlights

Key decisions, outcomes, and notable updates from the quarter scoped to NI Software. Group by theme or project. Include specifics — names, dates, numbers, product names.

---

## Open Action Items

Aggregate ALL unchecked action items (- [ ]) from across all sources. Include owner and source date. Omit items resolved in a later note.

- [ ] [Action item] — **Owner:** [Name] | **From:** [Date]

---

## Pillars of Account Health

For each pillar: assign a **G/Y/R** rating, explain it in 1–2 sentences, then list all relevant details as bullets with sub-bullets. Write "Nothing noted this quarter." if no relevant information exists.

---

### Proficiency & Self Service — [G/Y/R]

*Are we building NI tool skill and self-service capability at this account? How are we scaling it?*

**Strategy sub-areas:**
- **Proficiency Plans** — Are there plans for new and/or experienced users? What's the status?
- **L&D Integration** — Is NI collateral embedded into the account's learning & development approach?
- **Onboarding** — Is NI being injected into the account's new-hire or team onboarding process?

[Details from sources]

---

### Adoption — [G/Y/R]

*What opportunities exist to drive new users or new NI products into successful use? What's needed to make them successful?*

**Strategy sub-areas:**
- **Evaluations & Pilots** — Any active SW evaluations or pilots? Are we providing hypercare?
- **Deployment Strategies** — Are we working with sponsors on SW deployment plans?
- **Access Enablement** — Has access been customized to the account's structure or needs?
- **Support & Case Trends** — Are there recurring support issues or case trends we should address?

[Details from sources]

---

### Sponsors & End Users — [G/Y/R]

*What relationships are we building? How are we elevating trust and closeness with key people?*

**Strategy sub-areas:**
- **Sponsor Engagement** — Who are the influential sponsors? What's our engagement strategy?
- **End-User Outreach** — Are we capturing end-user insight? Any outreach strategy in place?
- **Interaction Cadence** — What travel, meetings, or comms cadence do we have with this account?

[Details from sources]

---

### Expansion — [G/Y/R]

*What parts of the NI Software portfolio is the customer not using today? Why? How could we introduce them?*

**Strategy sub-areas:**
- **Whitespace Assessment** — What NI SW products/licenses are they not using? Why?
- **Expansion Investigation** — What potential expansion areas have been identified or discussed?
- **Success Collateral** — Have we created or shared NI success content to support growth conversations?

[Details from sources]

---

### Renewal Readiness — [G/Y/R]

*What risks and opportunities should we address before the next EA/VLA renewal?*

**Strategy sub-areas:**
- **Risk Identification** — What renewal risks exist? Are they being actively managed?
- **SSM Negotiation Points** — Are SSMs equipped with the right talking points for renewal?
- **Sponsor Leverage** — Are we using sponsor relationships to reduce churn risk?

[Details from sources]

---

### Overall CS Score — [G/Y/R]

**Overall Health:** [2–4 sentence description of the account's CS posture based on all five pillars]

**Overall Risks & Areas Requiring CS or AM Support:**
- [bullet list of key risks and escalation needs]

**Renewal Status:** [Low / Medium / High / No Risk] — [1–2 sentence rationale]

**Expansion Pipeline:**
- [bullet list of any mentioned expansion opportunities, scoped to NI SW]

---

## Key Themes & Trends

3–5 bullets identifying recurring topics, risks, or patterns across multiple sources this quarter.

---

## Recommended Next Steps

Highest-priority next steps for the CS team in the coming weeks, in priority order. Scoped to NI Software activities.`;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { notes, apiKey, model, today, replacements = [], corrections = [] } = body;

    if (!notes || notes.length === 0) {
      return NextResponse.json({ error: "No notes provided" }, { status: 400 });
    }

    // Apply corrections then replacements to each note before sending to Claude
    const sanitizedNotes = notes.map((n) => ({
      ...n,
      title: applyReplacements(applyCorrections(n.title || "", corrections), replacements),
      content: applyReplacements(applyCorrections(n.content, corrections), replacements),
    }));

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
          content: buildSynthesisPrompt(sanitizedNotes, today || new Date().toISOString().split("T")[0]),
        },
      ],
    });

    const raw = message.content[0]?.text || "";
    const output = replacements.length ? reverseReplacements(raw, replacements) : raw;
    return NextResponse.json({ output, noteCount: notes.length, usage: message.usage, model: model || "claude-sonnet-4-6" });
  } catch (error) {
    console.error("Synthesis error:", error);
    return NextResponse.json(
      { error: error?.message || "Synthesis failed" },
      { status: error?.status || 500 }
    );
  }
}
