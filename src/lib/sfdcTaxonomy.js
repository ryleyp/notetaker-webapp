// Single source of truth for the SFDC EA Engagement Type/Subtype picklist.
//
// Both the New Note "## SFDC Activity Entry" section and the EA Activity
// report write into the SAME Salesforce fields, so they must agree on the
// exact strings. Canonical spellings are the ones Salesforce actually shows
// (e.g. "Escalation/Risk Management", not "Escalation / Risk Management").

export const TAXONOMY = [
  {
    type: "Entitlement Awareness & Promotion",
    blurb: "activities promoting awareness or use of EA entitlements",
    subtypes: [
      {
        name: "Digital Campaign/Promotion",
        hint: "email/digital outreach campaigns promoting training, events, or EA awareness",
        example: "Launched NI Connect promotional email campaign to NGC contacts, targeting registration and identifying potential presenters for the NGC-sponsored session. Campaign supports expansion positioning.",
      },
      { name: "MidTerm Reviews", hint: "formal midpoint EA review with the customer covering usage and ROI" },
      {
        name: "Newsletters",
        hint: "quarterly newsletters to account contacts covering product highlights, events, training, key POCs",
        example: "Distributed Q1 FY26 EA Quarterly Newsletter to L3Harris contacts. Content included NI product highlights, NI Connect event promotion, L3Harris-specific upcoming events, training resources, and key NI POC information. Reinforced EA value awareness.",
      },
      { name: "Shared Space Set-up/Update", hint: "setting up or updating a shared portal or resource hub" },
      {
        name: "Training/Support Plans",
        hint: "creating or scheduling a formal training plan across sites/teams",
        example: "Sync with Jordan (GTS, LM MFC), Nicole, and Angelica (NI Education Services) to scope LabVIEW Core 1 and Core 2 training across MFC sites. MFC holds ~7,600 EA training credits over 3 years. Confirmed in-person, instructor-led format.",
      },
      { name: "Training/Support Webinar", hint: "delivering a live training or support session to users" },
      { name: "Other" },
    ],
  },
  {
    type: "Internal Alignment & Collaboration",
    blurb: "NI-internal sessions (no customer present). Only log if a clear decision or outcome resulted",
    subtypes: [
      {
        name: "Account Planning",
        hint: "CSM/FAE interlock, account strategy sessions, NI Connect planning calls, internal alignment that produced a defined outcome",
        example: "CSM/FAE FY26 account interlock for Northrop Grumman. Reviewed CS focus areas, current usage data trends, and CS execution plan including site-level priorities. Identified specific gaps in FAE workflow where CSM provides strategic coverage.",
      },
      { name: "Account Team Kick-Off", hint: "formal kickoff session with the full internal account team (CSM, FAE, AM, etc.)" },
      { name: "Product Feedback", hint: "internal session to escalate or document customer product feedback" },
      { name: "Other", hint: "recurring internal team syncs (e.g. biweekly account team calls) when they produced a concrete outcome" },
    ],
  },
  {
    type: "Onboarding & Kick-Off",
    blurb: "onboarding new admins or users",
    subtypes: [
      {
        name: "EA Admin Onboarding",
        hint: "onboarding a new customer-side EA Admin to EA scope, entitlements, and governance. Always customer-facing.",
        example: "EA Admin onboarding session for two new L3Harris EA Admins who recently took over the role. Session covered the full scope of the EA (software entitlements, training credits, etc.), admin Q&A, and established understanding of internal processes.",
      },
      { name: "EA End-User Kick-Off", hint: "introduction or review of EA terms, entitlements, and inclusions with customer end users" },
      { name: "Other" },
    ],
  },
  {
    type: "Strategic Relationship Management",
    blurb: "high-touch customer-facing relationship and governance activities",
    subtypes: [
      {
        name: "EA Admin Sync",
        hint: "recurring or ad-hoc sync with the customer-side EA Admin or other key customer stakeholders. These contacts are NOT NI employees.",
        example: "Frontgrade TestStand Pilot Check In and EA Renewal Alignment — Meeting with Marc Pevotaux to review pilot status and align on renewal timeline.",
      },
      {
        name: "Escalation/Risk Management",
        hint: "active risk mitigation, escalations, or at-risk situations",
        example: "Active R&D escalation on behalf of Bret Ridgel (Northrop Grumman) related to a TKM505X IVI driver issue preventing LabVIEW control of the Tektronix MSO46B. Original FAE ticket stalled after R&D contacts left NI. CSM submitted an R&D Advocacy request to unblock.",
      },
      { name: "QBRs/EBRs", hint: "formal quarterly or executive business review" },
      { name: "Roadmap Review", hint: "session reviewing NI product roadmap with customer stakeholders" },
      { name: "SLE Governance", hint: "SystemLink Enterprise governance meetings" },
      { name: "Other" },
    ],
  },
  {
    type: "User Groups",
    blurb: "group sessions with multiple attendees. Pick subtype based on who led the session",
    subtypes: [
      {
        name: "Demo Days",
        hint: "NI-led session where NI/FAE presents or demos products to the customer",
        example: "L3Harris RF User Group — Region: AMER, Attendees: 22. FAE and AM led users through an overview of NI RF Hardware Platforms and demoed InstrumentStudio. Session targeted RF-focused sites. Outcome: Drove direct product exposure across the RF engineering community and generated adoption momentum at targeted sites.",
      },
      {
        name: "User Group",
        hint: "customer-sponsored recurring session; may include NI content but customer drives cadence/agenda",
        example: "LMS User Group — Region: AMER, Participants: TBD. Conducted an LMS user group session focused on important updates to the LMS NI EA and entitlements. Maintained customer momentum and reinforced awareness of EA value.",
      },
      { name: "Other", hint: "planning or brainstorming sessions tied to user group execution (e.g. pre-UG sponsor sync)" },
    ],
  },
  {
    type: "Value Realization & Success Stories",
    blurb: "capturing or communicating customer outcomes and ROI",
    subtypes: [
      {
        name: "Case Study",
        hint: "written or formal case study in progress or completed",
        example: "Initiated SystemLink case study with Eric Reek (IT Admin Lead, L3Harris) documenting the successful deployment of SystemLink Server at L3Harris Florida sites. Sessions held 3/11 and 3/12 to capture deployment scope, outcomes, and measurable value.",
      },
      { name: "Customer Testimonial", hint: "capturing a customer success quote or formal testimonial" },
      { name: "Outcome Review", hint: "reviewing measured outcomes and value delivered" },
      { name: "SLE ROI Review", hint: "formal ROI review specific to SystemLink Enterprise" },
      { name: "Other" },
    ],
  },
  {
    type: "Other",
    blurb: "only use if truly none of the above types fit",
    subtypes: [{ name: "Other" }],
  },
];

export const TYPE_NAMES = TAXONOMY.map((t) => t.type);

export function subtypesFor(type) {
  const entry = TAXONOMY.find((t) => t.type === type);
  return entry ? entry.subtypes.map((s) => s.name) : [];
}

export function isValidPair(type, subtype) {
  return subtypesFor(type).includes(subtype);
}

// Loose key for comparison: lowercase, strip anything that isn't a letter or
// digit. Makes "Escalation / Risk Management" == "Escalation/Risk Management"
// and "Kick-off" == "Kick-Off".
function key(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Legacy or near-miss spellings → canonical. Keyed by loose key.
const TYPE_ALIASES = {
  [key("Training or Support Webinar")]: "Entitlement Awareness & Promotion",
  [key("Entitlement Awareness and Promotion")]: "Entitlement Awareness & Promotion",
  [key("Internal Alignment and Collaboration")]: "Internal Alignment & Collaboration",
  [key("Onboarding and Kick-off")]: "Onboarding & Kick-Off",
  [key("Value Realization and Success Stories")]: "Value Realization & Success Stories",
};

const SUBTYPE_ALIASES = {
  [key("Training or Support Webinar")]: "Training/Support Webinar",
  [key("Account Team Kickoff")]: "Account Team Kick-Off",
  [key("EA End-User Kick-off")]: "EA End-User Kick-Off",
  [key("Escalation / Risk Management")]: "Escalation/Risk Management",
  [key("QBR / EBR")]: "QBRs/EBRs",
  [key("QBR/EBR")]: "QBRs/EBRs",
  [key("Product Roadmap Review")]: "Roadmap Review",
  [key("SystemLink Enterprise Governance")]: "SLE Governance",
  [key("SystemLink ROI Review")]: "SLE ROI Review",
  [key("Demo Day")]: "Demo Days",
};

// Map a possibly-legacy (type, subtype) pair onto the canonical picklist
// values. Returns { type, subtype, changed }. Unknown values fall back to
// "Other"/"Other" rather than passing junk through to Salesforce.
export function normalizePair(rawType, rawSubtype) {
  const tKey = key(rawType);
  let type =
    TYPE_NAMES.find((t) => key(t) === tKey) ||
    TYPE_ALIASES[tKey] ||
    null;

  // A legacy top-level type that is really a subtype (e.g. "Training or
  // Support Webinar") carries its subtype with it.
  let forcedSubtype = null;
  if (!TYPE_NAMES.some((t) => key(t) === tKey) && TYPE_ALIASES[tKey] && SUBTYPE_ALIASES[tKey]) {
    forcedSubtype = SUBTYPE_ALIASES[tKey];
  }

  if (!type) type = "Other";

  const sKey = key(rawSubtype);
  const valid = subtypesFor(type);
  let subtype =
    forcedSubtype ||
    valid.find((s) => key(s) === sKey) ||
    (SUBTYPE_ALIASES[sKey] && valid.includes(SUBTYPE_ALIASES[sKey]) ? SUBTYPE_ALIASES[sKey] : null) ||
    "Other";

  if (!valid.includes(subtype)) subtype = "Other";

  const changed = type !== (rawType || "") || subtype !== (rawSubtype || "");
  return { type, subtype, changed };
}

// Compact rendering — used where prompt space matters (New Note).
export function compactTaxonomy() {
  return TAXONOMY.map((t) => `- ${t.type}: ${t.subtypes.map((s) => s.name).join(", ")}`).join("\n");
}

// Full rendering with descriptions and worked examples — used by the EA
// Activity report, where classification accuracy is the whole job.
export function detailedTaxonomy() {
  return TAXONOMY.map((t) => {
    const lines = [`**Type: ${t.type}** — ${t.blurb}:`];
    for (const s of t.subtypes) {
      lines.push(`  - ${s.name}${s.hint ? ` — ${s.hint}` : ""}`);
      if (s.example) lines.push(`    Example: "${s.example}"`);
    }
    return lines.join("\n");
  }).join("\n\n");
}

// Voice shared by both writers — they land in the same Salesforce comment
// box, so they should sound like the same person wrote them.
export const SFDC_VOICE_RULES = `- Past tense, and no first person ("I"/"we") — but that does NOT mean passive voice. Drop the subject instead. Write "Walked Gokul through the migration plan" or "Flagged the re-ingestion risk", NEVER "The migration plan was reviewed" or "A discussion was held regarding...". These subject-dropped fragments are how people actually type notes and are the preferred style.
- Active voice with real people as the subject: "Gokul pushed back on the August date", not "Concerns were raised regarding the August date".
- Contractions are good ("wasn't", "didn't", "they're", "he's"). Short sentences are good. Fragments are fine.
- Say the plain thing. "They're worried the timeline slips" beats "The customer expressed apprehension regarding potential schedule risk".
- Never use: synergy, leverage, circle back, touch base, bandwidth, actionable, value-add, deep dive, holistic, robust, seamless, utilize, facilitate, ecosystem, "in order to", "as it relates to", "per our discussion", "alignment" as a noun.
- Kill nominalizations — "discussed" not "held a discussion", "decided" not "made a decision", "agreed" not "reached agreement".
- No throat-clearing openers. Never start with "The purpose of this meeting was...", "This call covered...", or "During the discussion...". Open with the actual substance.`;
