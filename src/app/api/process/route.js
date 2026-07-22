import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { looksSpeakerLabeled } from "@/lib/speakers";

const SYSTEM_PROMPT = `You are an expert meeting notes specialist working for a Customer Success Manager (CSM) at NI (National Instruments). The person who recorded this meeting is that CSM — their job is driving adoption, expansion, and renewal of NI products at large customer accounts.

Domain context — interpret the transcript through this lens:
- NI Software: LabVIEW, TestStand, SystemLink (Server/Enterprise/SLE/SLS), FlexLogger, VeriStand, DIAdem, InstrumentStudio, DAQmx, driver stacks, Enterprise Agreements (EA), training credits, license/entitlement management.
- NI Hardware: PXI, CompactDAQ/cDAQ, CompactRIO/cRIO, VST, SMU, oscilloscopes, RF instrumentation, and how hardware attach relates to software adoption.
- Test & measurement engineering: automated test systems, HIL, validation/production test, instrument control, measurement data management. Terms like "DAQ", "rigs", "test stands", "sequences", and "drivers" mean their T&M sense, not general IT.
- Ambiguous transcription of product names should resolve to the closest NI product (e.g. "test stand" in a software context is likely TestStand).

Your notes must be extremely thorough — do not omit any important information, decisions, or discussions from the transcript. Frame relevance from the CSM's perspective: customer adoption signals, license/EA questions, support issues, expansion or renewal implications, and commitments the CSM made.

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

const SFDC_ACTIVITY_RULES = `
Rules for the SFDC Activity Entry section:

APPROVED TYPE AND SUBTYPE OPTIONS (Subtype must come from the chosen Type's list)
- Training or Support Webinar: Other
- Internal Alignment and Collaboration: Account Planning, Account Team Kickoff, Product Feedback
- Onboarding & Kick-off: EA Admin Onboarding, EA End-User Kick-off, Other
- Strategic Relationship Management: EA Admin Sync, Escalation / Risk Management, QBR / EBR, Product Roadmap Review, SystemLink Enterprise Governance, Other
- User Groups: Demo Day, User Group, Other
- Value Realization and Success Stories: Case Study, Customer Testimonial, Outcome Review, SystemLink ROI Review, Other
- Other

CLASSIFICATION RULES
- Identify the primary purpose of the meeting before choosing a type.
- Use the most specific valid type and subtype the transcript (or the CSM's context/notes) supports.
- Subtype must come from the chosen type's list; if none fit, use "Other" within that type.
- Top-level "Other" type always outputs "Subtype: Other".
- A product-led session (NI presenting/demoing) is a demo, not a User Group. "User Group" means customer-led.
- Prefer "Account Planning" or "Other" for internal-only work, with an outcome-focused description.
- Tie-breakers when two types fit: (1) match the primary purpose, not a topic that just came up; (2) if the meeting spans onboarding and training, classify by account stage — new/ramping accounts default to Onboarding & Kick-off; (3) if risk or escalation is the reason for the meeting, Escalation / Risk Management wins over a routine sync; (4) if still tied, pick the type reflecting the strategic outcome.

SUMMARY/NOTES RULES
- Exactly three labeled lines, in this order: Summary, Outcomes, Next steps. No other headings or sections inside this block.
- HARD LIMIT: the entire Summary/Notes block — Summary + Outcomes + Next steps combined, including the labels — must be at most 120 words and 800 characters or fewer. This is a Salesforce field limit, not a target. Draft, count the words, then trim until it is 120 or fewer: cut the weakest detail, not the outcomes or next steps. Never exceed it.
- This block is pasted into a plain-text SFDC Comment field, so keep each section as a labeled run of plain sentences ("Summary: ...", "Outcomes: ...", "Next steps: ...") — no bullets, no bold, no sub-lists inside it.
- Past tense, no first person ("I"/"we").
- Persona: write like a CSM in their late twenties/around 27, a couple years into the role, with an engineering degree — reads like notes typed up right after the call, not an AI-cleaned recap. Plain, conversational-professional language, not heavy business jargon (avoid "synergy," "leverage," "circle back," "bandwidth," "actionable," "value-add," etc.). Grounded and direct, no stiff transitions or corporate filler.
- Lead with outcome and business value, not meeting logistics.
- Outcomes: if the transcript has no clear outcome, write "Outcomes: None stated" — never invent one.
- Next steps: only the CSM's own owned actions (skip customer/other-team to-dos unless they gate a CSM action), top 1-3, phrased as concrete actions. If none, write "Next steps: None".
- Do not invent attendees, regions, outcomes, or next steps that aren't supported by the transcript or the CSM's own context/notes.
- Exclude raw internal complaints/blame, speculative pricing or forecast figures, and anything the account team wouldn't want visible in CRM.`;

function buildPrompt(transcript, meetingTitle, suggestedAgreements = [], meetingContext = "") {
  const title = meetingTitle || "Meeting Notes";

  // Extra background and/or the CSM's own handwritten notes, typed in by the
  // CSM alongside the transcript. Treated as a trusted second source.
  const contextBlock = meetingContext.trim()
    ? `
CONTEXT & NOTES FROM THE CSM (trusted supplemental source — the CSM wrote this themselves):
${meetingContext.trim()}

Use this to interpret the transcript (attendees, roles, account background, meeting purpose) AND as source material in its own right: observations, decisions, or action items that appear only in the CSM's notes belong in the meeting notes and SFDC entry just like transcript content. If the CSM's notes and the transcript conflict, prefer the transcript for what was literally said, but keep the CSM's framing of why it matters. Do not quote the CSM's notes as if someone said them aloud in the meeting.

CONFLICT FLAGGING: If the CSM's notes DIRECTLY conflict with the transcript on a fact — a different number, date, owner, decision, product, or outcome — you MUST surface it. Insert a section titled "## ⚠️ Conflicts With Your Notes" immediately after the Executive Summary (this is an allowed addition to the required structure below). List each conflict as its own bullet: "Your notes say [X], but the transcript says [Y]" — quote or closely paraphrase both sides so the CSM can resolve it. In the body of the notes, use the transcript's version. Do NOT silently pick one side, and do NOT include this section at all when there are no direct conflicts. Differences in emphasis or detail level are not conflicts — only contradictions are.
`
    : "";

  // EA/EP numbers matched to this meeting by keyword (matching done client-side
  // against the raw transcript). Listed in the SFDC entry so they can be copied
  // into Salesforce; Claude only echoes them, it does not invent numbers.
  const agreementBlock = suggestedAgreements.length
    ? `\nEA/EP NUMBERS ON FILE FOR THIS ACCOUNT (matched to this meeting by keyword): ${suggestedAgreements.map((g) => `${g.type} ${g.number}`).join(", ")}. In the SFDC Activity Entry, output an "**EA/EP Number(s):**" line listing the one(s) relevant to what this meeting was actually about, copied verbatim. If more than one clearly applies, list all. Do not invent or alter numbers, and do not list a number if nothing in the meeting relates to it.`
    : `\nNo EA/EP numbers are on file for this account. In the SFDC Activity Entry, output "**EA/EP Number(s):** None on file".`;

  const speakerGuidance = looksSpeakerLabeled(transcript)
    ? `
This transcript has been segmented by speaker — each turn is preceded by a label like **Name:** or **Speaker 1:**. Use these labels to attribute statements, decisions, questions, and commitments to the correct person throughout your notes (e.g. "David raised concerns about..." or "Speaker 2 confirmed..."). Do not blend or merge different speakers' statements together. When listing action item owners, use the specific speaker who committed to the item rather than a generic "team," unless it is genuinely a group commitment. The labels are a best-effort inference from conversational patterns, not verified — if a label is a generic "Speaker N" (no real name was available), it's fine to refer to that person by that label in your notes.
`
    : "";

  return `Please analyze this meeting transcript and create detailed meeting notes.

Meeting Title: ${title}
${speakerGuidance}${contextBlock}
---
TRANSCRIPT:
${transcript}
---

${TAG_CATEGORIES}

Generate the meeting notes with EXACTLY this structure. Do NOT include a YAML frontmatter block.

# ${title}

<tag line: list extracted tags inline as #tag1 #tag2 #tag3>

---

## Executive Summary

Write 3-5 concise sentences capturing the overall purpose, key outcomes, and most important decisions from this meeting.

---

## Meeting Notes

Provide thorough bulleted notes that capture all important information from the transcript. Focus on decisions, key points, and meaningful details — skip filler, repetition, tangential remarks, and personal updates or check-ins. Use sub-bullets for important specifics. Organize by topic when appropriate. Quote or closely paraphrase notable statements.

---

## Things NI SW Customer Success Should Take Note Of

Flag the most important items for NI Software's Customer Success team. Include: adoption signals, product usage concerns, customer frustrations or praise, risks to renewal or expansion, opportunities for CS to engage, and any commitments made to the customer. Be concise — one clear bullet per point, no filler.

---

## Action Items

List all action items as Markdown task checkboxes. For each item include who owns it and a due date if mentioned. Format:
- [ ] [Action item description] — **Owner:** [Name or Team] | **Due:** [Date or "TBD"]

---

## Next Steps

List the agreed-upon next steps, upcoming milestones, follow-up meetings, or planned deliverables in priority order.

---

## SFDC Activity Entry

A Salesforce-ready activity entry for this meeting, following the rules below. Output EXACTLY this shape and nothing else in this section — no extra headings, bullets, or commentary:

**Type:** <one approved type>
**Subtype:** <matching subtype from that type's list>
**EA/EP Number(s):** <relevant number(s) from the list below, or "None on file">

**Summary/Notes:**
Summary: <what was covered and what happened>
Outcomes: <explicit outcomes, or "None stated">
Next steps: <the CSM's own 1-3 owned actions, or "None">
${SFDC_ACTIVITY_RULES}
${agreementBlock}`;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { transcript, meetingTitle, apiKey, model, suggestedAgreements = [], meetingContext = "" } = body;

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
      max_tokens: 9216,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildPrompt(transcript, meetingTitle, suggestedAgreements, meetingContext) }],
    });

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
              controller.enqueue(new TextEncoder().encode(chunk.delta.text));
            }
          }
          // Append usage as a tagged footer after all content
          const finalMsg = await stream.finalMessage();
          controller.enqueue(
            new TextEncoder().encode(`\n__USAGE__${JSON.stringify(finalMsg.usage)}`)
          );
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readable, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error) {
    console.error("Error processing transcript:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to process transcript" },
      { status: error?.status || 500 }
    );
  }
}
