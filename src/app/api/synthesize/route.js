import Anthropic from "@anthropic-ai/sdk";
import { applyCorrections, applyReplacements } from "@/lib/sanitize";

function buildSynthesisPrompt(notes, today, accountName) {
  const threeMonthsAgo = new Date(today);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const rangeLabel = `${threeMonthsAgo.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} – ${new Date(today).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;

  const acct = accountName && accountName !== "Internal" ? accountName : null;

  const noteBlocks = notes
    .map((n, i) => {
      const tag = n.source === "cross-vault" ? ` [${n.sourceLabel}]` : "";
      return `### Source ${i + 1}: ${n.title} (${n.date})${tag}\n\n${n.content}`;
    })
    .join("\n\n---\n\n");

  const accountScope = acct
    ? `This is an Account Status report for **${acct} ONLY**.

CRITICAL ACCOUNT SCOPING RULES — these override everything else:
- Report exclusively on ${acct}. Do NOT discuss, compare to, or mention any other customer account (e.g. Lockheed Martin, L3Harris, Northrop Grumman, Frontgrade, or any other company).
- Some sources come from other folders and may contain content about other accounts. Use ONLY the portions that pertain to ${acct}. Ignore everything about any other account, even within the same note.
- If a source mentions ${acct} only in passing, extract just the ${acct}-relevant parts.
- If a source has no ${acct} content, ignore it entirely.
- Never write a sentence that is about another account. The reader only cares about ${acct}.

`
    : "";

  return `You are a NI Software Customer Success Manager analyzing ${notes.length} meeting notes and transcripts from the past quarter (${rangeLabel}). Produce a detailed Account Status summary scoped to NI Software.

${accountScope}Scope rules:
- Focus on NI Software products, licenses, adoption, and CS activities${acct ? ` at ${acct}` : ""}
- Third-party software: mention briefly if relevant to NI context
- Hardware: mention only when directly tied to NI software usage
- Omit purely hardware or non-NI topics

Sources include Obsidian meeting notes and notes from other folders that mention this account [folder name].

---
SOURCES:

${noteBlocks}

---

Generate the Account Status document using EXACTLY this structure. Be specific — reference actual names, dates, products, and details from the sources. Do not be vague.${acct ? ` Remember: ${acct} ONLY — never mention another account.` : ""}

# ${acct ? `${acct} ` : ""}Account Status — ${rangeLabel}

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

function buildProductPrompt(notes, today, product, accountName) {
  const threeMonthsAgo = new Date(today);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const rangeLabel = `${threeMonthsAgo.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} – ${new Date(today).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;

  const acct = accountName && accountName !== "Internal" ? accountName : null;

  const noteBlocks = notes
    .map((n, i) => {
      const tag = n.source === "cross-vault" ? ` [${n.sourceLabel}]` : "";
      return `### Source ${i + 1}: ${n.title} (${n.date})${tag}\n\n${n.content}`;
    })
    .join("\n\n---\n\n");

  const p = product.name;
  const aliases = product.aliases?.join(", ") || p;

  const accountScope = acct
    ? `This report covers **${p} at ${acct} ONLY**.

CRITICAL ACCOUNT SCOPING RULES — these override everything else:
- Report exclusively on ${acct}'s use of ${p}. Do NOT discuss, compare to, or mention any other customer account (e.g. Lockheed Martin, L3Harris, Northrop Grumman, Frontgrade, or any other company).
- Some sources come from other folders and may contain content about other accounts. Use ONLY the portions about ${acct}. Ignore everything about any other account, even within the same note.
- If a source has no ${acct} + ${p} content, ignore it entirely.
- Never write a sentence about ${p} at another account. The reader only cares about ${acct}.

`
    : "";

  return `You are a NI Software Customer Success Manager reviewing ${notes.length} meeting notes and transcripts from the past quarter (${rangeLabel}). Produce a focused **${p} Account Status**${acct ? ` for ${acct}` : ""} covering only content relevant to ${p} (also referred to as: ${aliases}).

${accountScope}Scope rules:
- Focus exclusively on ${p}${acct ? ` at ${acct}` : ""} — licensing, adoption, deployment, support, training, and expansion
- Mention integrations with other NI tools only when directly tied to ${p}
- Omit topics unrelated to ${p}

---
SOURCES:

${noteBlocks}

---

Generate the ${p} Account Status using EXACTLY this structure. Be specific — reference actual names, dates, product tiers, and details from the sources.${acct ? ` Remember: ${acct} ONLY — never mention another account.` : ""}

# ${p} Account Status${acct ? ` — ${acct}` : ""} — ${rangeLabel}

*Synthesized from ${notes.length} sources*

---

## Recent Highlights

Key decisions, outcomes, and updates related to ${p} this quarter. Include names, dates, product tiers (e.g. Base, Pro, SLS, SLE), and specifics.

---

## Open Action Items

Aggregate ALL unchecked action items (- [ ]) related to ${p} from across all sources.

- [ ] [Action item] — **Owner:** [Name] | **From:** [Date]

---

## ${p} Pillars

### Proficiency & Self Service — [G/Y/R]

*Are users building skill with ${p}? Is the account moving toward self-service?*

- **Proficiency Plans** — Training status for new and experienced ${p} users
- **L&D Integration** — Is ${p} content embedded in the account's learning approach?
- **Onboarding** — Is ${p} part of new-hire or team onboarding?

[Details from sources, or "Nothing noted this quarter."]

---

### Adoption — [G/Y/R]

*What is the current ${p} footprint? Who is using it and how actively?*

- **Active Tiers / SKUs** — Which ${p} products/tiers are deployed and in use?
- **Evaluations & Pilots** — Any active ${p} evaluations? Are we providing hypercare?
- **Deployment & Access** — Is ${p} deployed broadly? Any access or config blockers?
- **Support & Case Trends** — Any recurring ${p} support issues or open cases?

[Details from sources, or "Nothing noted this quarter."]

---

### Sponsors & End Users — [G/Y/R]

*Who owns and champions ${p} at this account? Who are the power users?*

- **${p} Sponsor(s)** — Who is the internal champion? How engaged are they?
- **End-User Insight** — Are we capturing feedback from ${p} end users?
- **Engagement Cadence** — How frequently are we meeting with ${p} stakeholders?

[Details from sources, or "Nothing noted this quarter."]

---

### Expansion — [G/Y/R]

*What ${p} tiers, modules, or use cases are untapped at this account?*

- **Whitespace** — Which ${p} tiers or add-ons are they NOT using? Why?
- **Expansion Opportunities** — Any discussed or identified growth areas?
- **Success Collateral** — Have we shared ${p} success stories or ROI content?

[Details from sources, or "Nothing noted this quarter."]

---

### Renewal Readiness — [G/Y/R]

*What is the ${p} renewal risk or opportunity heading into the next EA/VLA?*

- **Risk Factors** — Any dissatisfaction, low usage, or competitive threats related to ${p}?
- **SSM Talking Points** — What renewal narrative supports ${p} value?
- **Sponsor Leverage** — Are we using relationships to protect ${p} in renewal?

[Details from sources, or "Nothing noted this quarter."]

---

### Overall ${p} Health Score — [G/Y/R]

**Health Summary:** [2–3 sentences on the account's ${p} posture based on the five pillars above]

**Risks & Escalation Needs:**
- [bullet list]

**Renewal Status:** [Low / Medium / High / No Risk] — [1–2 sentence rationale]

**Expansion Pipeline:**
- [bullet list of ${p}-specific expansion opportunities]

---

## Key Themes & Trends

3–5 bullets on recurring ${p}-related patterns or risks across sources this quarter.

---

## Recommended Next Steps

Priority actions for the CS team related to ${p} in the coming weeks.`;
}

// Conservative budget: 200k limit minus 8k output minus ~10k prompt template overhead.
const MAX_NOTE_CHARS = (200_000 - 8_192 - 10_000) * 4;

function fitNotes(notes) {
  const capped = notes.map((n) => ({
    ...n,
    content: n.content.length > 80_000 ? n.content.slice(0, 80_000) + "\n\n[truncated — note exceeds per-source limit]" : n.content,
  }));

  let total = 0;
  const kept = [];
  for (const n of capped) {
    const size = (n.title?.length || 0) + n.content.length + 200;
    if (total + size > MAX_NOTE_CHARS && kept.length > 0) break;
    kept.push(n);
    total += size;
  }
  return { kept, dropped: notes.length - kept.length };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { notes, apiKey, model, today, replacements = [], corrections = [], productFocus, accountName } = body;

    if (!notes || notes.length === 0) {
      return new Response(JSON.stringify({ error: "No notes provided" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const sanitizedNotes = notes.map((n) => ({
      ...n,
      title: applyReplacements(applyCorrections(n.title || "", corrections), replacements),
      content: applyReplacements(applyCorrections(n.content, corrections), replacements),
    }));

    const { kept, dropped } = fitNotes(sanitizedNotes);

    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) {
      return new Response(JSON.stringify({ error: "Anthropic API key is required" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const client = new Anthropic({ apiKey: key });
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (obj) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        try {
          const messageStream = client.messages.stream({
            model: model || "claude-sonnet-4-6",
            max_tokens: 8192,
            system: "You are an expert at synthesizing meeting notes into clear, actionable executive summaries. Respond with only the Markdown document — no preamble.",
            messages: [{
              role: "user",
              content: productFocus
                ? buildProductPrompt(kept, today || new Date().toISOString().split("T")[0], productFocus, accountName)
                : buildSynthesisPrompt(kept, today || new Date().toISOString().split("T")[0], accountName),
            }],
          });

          for await (const event of messageStream) {
            if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
              send({ type: "delta", text: event.delta.text });
            }
          }

          const final = await messageStream.finalMessage();
          send({ type: "done", noteCount: kept.length, droppedCount: dropped, usage: final.usage, model: model || "claude-sonnet-4-6" });
        } catch (error) {
          send({ type: "error", message: error?.message || "Synthesis failed" });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error?.message || "Synthesis failed" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
