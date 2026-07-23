import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { assertTrustedRequest } from "@/lib/requestSafety";

const SYSTEM_PROMPT = `You are an expert meeting notes specialist. When given a meeting transcript, you produce highly detailed, structured meeting notes in Markdown format.

Your notes must be useful and complete, but honor any section-specific word limits.

Do NOT include personal updates, personal check-ins, or personal anecdotes (e.g. weekend plans, health updates, family news, personal status). Focus only on business-relevant content.

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
- Lockheed divisions (only if explicitly called out): rms, mfc, space
- Northrop Grumman divisions (only if explicitly called out): aeronautics, defensesystems, missionsystems, space
- L3Harris divisions (only if explicitly called out): sms (Space and Mission Systems), csd (Communications and Spectrum Dominance), msl (Missile Solutions)
- CS program terms: proficiencyplan, flexcredits, snowsupport, enterpriseagreement — tag if these programs or concepts are explicitly discussed
- Training: tag as proficiencyplans if training, onboarding, skill-building, or learning resources for NI tools are discussed

Only include a tag if that city/state/technology is actually discussed — not just briefly mentioned in passing.`;

export function buildPrompt(transcript, meetingTitle) {
  const title = meetingTitle || "Meeting Notes";

  return `Please analyze this meeting transcript and create detailed meeting notes.

Meeting Title: ${title}

---
TRANSCRIPT:
${transcript}
---

${TAG_CATEGORIES}

Generate the meeting notes with EXACTLY this structure. Do NOT include a YAML frontmatter block.

Word limit: The Executive Summary and Meeting Notes sections together must be 120 words or fewer. Keep those two sections tight; use the later callout, action item, and next step sections for structured follow-up detail.

# ${title}

<tag line: list extracted tags inline as #tag1 #tag2 #tag3>

---

## Executive Summary

Write 1-2 concise sentences capturing the overall purpose, key outcomes, and most important decisions from this meeting. This section counts toward the combined 120-word limit for Executive Summary + Meeting Notes.

---

## Meeting Notes

Provide concise bulleted notes with only the highest-signal decisions, key points, and meaningful details from the transcript. Skip filler, repetition, tangential remarks, and personal updates or check-ins. This section and Executive Summary together must be 120 words or fewer.

---

## Things NI SW Customer Success Should Take Note Of

Flag the most important items for NI Software's Customer Success team. Include: adoption signals, product usage concerns, customer frustrations or praise, risks to renewal or expansion, opportunities for CS to engage, and any commitments made to the customer. Be concise — one clear bullet per point, no filler.

---

## User-Level Callouts

Call out specific customer users, stakeholders, sponsors, admins, evaluators, champions, blockers, or NI/internal contacts who matter to account planning. Include only people actually mentioned in the transcript. For each person, capture role/team if stated, relationship or influence if stated, account-relevant context, and any follow-up implication. If no specific people are mentioned, write "Nothing noted."

- **[Name]** — [role/team or "not stated"]: [account-relevant context and planning implication]

---

## Site-Level Callouts

Call out specific customer sites, labs, campuses, buildings, cities, or named locations mentioned in the transcript. Include only locations actually mentioned. For each site/location, capture associated people or teams if stated, NI software/product context if stated, risks/blockers, and any site-level planning implication. If no specific sites or locations are mentioned, write "Nothing noted."

- **[Site / lab / location]** — [site context, associated stakeholders/teams, software context, and planning implication]

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
    assertTrustedRequest(request);

    const body = await request.json();
    const { transcript, meetingTitle, apiKey, model } = body;

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

    const stream = client.messages.stream({
      model: model || "claude-sonnet-4-6",
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildPrompt(transcript, meetingTitle) }],
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
          send({ type: "done", usage: finalMsg.usage, model: model || "claude-sonnet-4-6" });
        } catch (err) {
          send({ type: "error", message: err?.message || "Processing failed" });
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
    console.error("Error processing transcript:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to process transcript" },
      { status: error?.status || 500 }
    );
  }
}
