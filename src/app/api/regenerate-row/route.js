import Anthropic from "@anthropic-ai/sdk";
import { applyCorrections, applyReplacements, reverseReplacements } from "@/lib/sanitize";
import { scrubWithExceptions } from "@/lib/scrub";
import { detailedTaxonomy, SFDC_VOICE_RULES, normalizePair } from "@/lib/sfdcTaxonomy";
import { assertTrustedRequest } from "@/lib/requestSafety";

const MAX_SOURCE_CHARS = 200_000;

// Redo a single activity row from its source note, so a misclassified or
// badly-worded row can be fixed without re-running the whole report.
export async function POST(request) {
  try {
    assertTrustedRequest(request);

    const body = await request.json();
    const {
      row,
      notes = [],
      accountName,
      allAccounts = [],
      replacements = [],
      corrections = [],
      restoredIds = [],
      instruction = "",
      model,
      apiKey,
    } = body;

    if (!row || !notes.length || !accountName) {
      return new Response(JSON.stringify({ error: "row, notes, and accountName are required" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) {
      return new Response(JSON.stringify({ error: "Anthropic API key is required" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const clean = (t) => applyReplacements(applyCorrections(t || "", corrections), replacements);
    const sanitized = notes.map((n) => ({ ...n, title: clean(n.title), content: clean(n.content) }));
    const scrubbed = scrubWithExceptions(sanitized, accountName, allAccounts, restoredIds);

    // Prefer the note this row actually cited; fall back to same-date notes.
    const wanted = clean(row.sourceTitle || row.title).toLowerCase();
    let sources = scrubbed.filter((n) => {
      const t = (n.title || "").toLowerCase();
      return (wanted && (t.includes(wanted) || wanted.includes(t))) || n.date === row.eventDate;
    });
    if (!sources.length) sources = scrubbed.slice(0, 3);

    let total = 0;
    sources = sources.filter((n) => (total += n.content.length) <= MAX_SOURCE_CHARS);

    const sourceBlocks = sources.map((n) => `### ${n.date} — ${n.title}\n\n${n.content}`).join("\n\n---\n\n");

    const prompt = `Rewrite ONE row of an EA Engagement Activity Report for **${accountName}**, using only the source below.

CURRENT ROW (the one to redo):
Event date: ${row.eventDate || "unknown"}
Title: ${clean(row.title)}
Type / Subtype: ${row.type} / ${row.subtype}
Comment: ${clean(row.comments)}
${instruction ? `\nWHAT TO FIX (follow this above all else): ${instruction}\n` : ""}
Only report activity that the source explicitly ties to ${accountName}. If the source does not support this activity at all, return the row with review set to true and reviewReason explaining that.

TYPE TAXONOMY — copy Type and Subtype character-for-character from this list:

${detailedTaxonomy()}

COMMENT VOICE — this lands in a Salesforce comment box and must sound like a CSM typed it right after the call, not like a report:
${SFDC_VOICE_RULES}
- Max 800 characters. Name specific contacts and titles. Say what happened and why it matters.
- For Demo Days and User Groups include Region, Attendees (or TBD), topics, and Outcome.

SOURCE:

${sourceBlocks}

OUTPUT — exactly one JSON object, no other text, no code fences:
{"eventDate":"YYYY-MM-DD","title":"...","type":"...","subtype":"...","comments":"...","sourceTitle":"...","review":false,"reviewReason":""}`;

    const client = new Anthropic({ apiKey: key });
    const msg = await client.messages.create({
      model: model || "claude-sonnet-4-6",
      max_tokens: 1500,
      system: "You rewrite a single structured activity row. Respond with exactly one JSON object — no preamble, no Markdown, no code fences.",
      messages: [{ role: "user", content: prompt }],
    });

    const text = msg.content?.[0]?.text || "";
    const line = text.split("\n").map((l) => l.trim().replace(/^```(?:json)?/, "").replace(/```$/, "").trim()).find((l) => l.startsWith("{"));
    if (!line) {
      return new Response(JSON.stringify({ error: "Model did not return a row" }), { status: 502, headers: { "Content-Type": "application/json" } });
    }

    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      return new Response(JSON.stringify({ error: "Model returned malformed JSON" }), { status: 502, headers: { "Content-Type": "application/json" } });
    }

    const rev = (t) => (replacements.length ? reverseReplacements(t || "", replacements) : t || "");
    const { type, subtype } = normalizePair(obj.type, obj.subtype);

    return new Response(JSON.stringify({
      row: {
        eventDate: obj.eventDate || row.eventDate || "",
        title: rev(obj.title) || row.title,
        type,
        subtype,
        comments: rev(obj.comments),
        agreements: row.agreements || "",
        sourceTitle: rev(obj.sourceTitle) || row.sourceTitle || "",
        // A regenerated row is model output again, even if the original was
        // harvested from an approved note section.
        origin: "generated",
        review: !!obj.review,
        reviewReason: rev(obj.reviewReason),
        verify: "",
        verifyReason: "",
      },
      usage: msg.usage,
    }), { headers: { "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error?.message || "Row regeneration failed" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
