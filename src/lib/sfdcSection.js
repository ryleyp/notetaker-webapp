// Every note generated through New Note ends with a reviewed
// "## SFDC Activity Entry" section. The EA Activity report harvests those
// instead of asking Claude to re-derive them from the raw transcript — the
// harvested version is the one the user already approved, and no model
// touching it means it cannot be misattributed or embellished.

import { normalizePair } from "@/lib/sfdcTaxonomy";

const SECTION_RE = /##\s*SFDC Activity Entry\s*\n([\s\S]*?)(?=\n##\s|$)/i;

function field(body, label) {
  // Matches "**Type:** value" / "Type: value" on its own line.
  const re = new RegExp(`^\\s*(?:\\*\\*)?${label}(?:\\(s\\))?:?(?:\\*\\*)?:?\\s*(.+)$`, "im");
  const m = body.match(re);
  return m ? m[1].replace(/\*\*/g, "").trim() : "";
}

// Pull the Summary/Outcomes/Next steps block, which is what goes in the
// Salesforce comment box.
function comments(body) {
  const idx = body.search(/^\s*(?:\*\*)?Summary\s*\/?\s*Notes(?:\*\*)?:?\s*$/im);
  const region = idx === -1 ? body : body.slice(idx);
  const lines = [];
  for (const raw of region.split("\n")) {
    const line = raw.replace(/\*\*/g, "").trim();
    if (!line) continue;
    if (/^Summary\s*\/\s*Notes:?$/i.test(line)) continue;
    if (/^(Type|Subtype|EA\/EP Number(\(s\))?):/i.test(line)) continue;
    if (/^-{3,}$/.test(line)) continue;
    lines.push(line);
  }
  return lines.join(" ").trim();
}

function agreements(body) {
  const raw = field(body, "EA/EP Number");
  if (!raw || /^none/i.test(raw)) return "";
  return raw;
}

// Returns { type, subtype, agreements, comments } or null when the note has
// no SFDC section (hand-written notes, notes predating the feature).
export function parseSfdcSection(noteContent) {
  const m = (noteContent || "").match(SECTION_RE);
  if (!m) return null;
  const body = m[1];

  const rawType = field(body, "Type");
  const rawSubtype = field(body, "Subtype");
  const text = comments(body);
  if (!rawType && !text) return null;

  const { type, subtype } = normalizePair(rawType, rawSubtype);
  return { type, subtype, agreements: agreements(body), comments: text };
}

export function hasSfdcSection(noteContent) {
  return parseSfdcSection(noteContent) !== null;
}

// Build an activity row straight from a note's approved SFDC section.
// origin "note" marks it as harvested so the UI can badge it and the
// verify pass can skip it.
export function harvestRow(note) {
  const parsed = parseSfdcSection(note?.content);
  if (!parsed) return null;
  return {
    eventDate: note.date || "",
    title: note.title || "",
    type: parsed.type,
    subtype: parsed.subtype,
    comments: parsed.comments,
    agreements: parsed.agreements,
    sourceTitle: note.title || "",
    origin: "note",
    review: false,
    reviewReason: "",
    verify: "",
    verifyReason: "",
  };
}

// Partition scanned notes into ones we can harvest and ones that still need
// generation.
//
// Cross-folder notes are NEVER harvested. They were pulled in only because
// they mention one of this account's aliases, so their approved SFDC entry
// may well describe a different account's meeting. Taking it verbatim would
// route another account's activity straight into this report, skipping the
// attribution rules the generation prompt enforces. Those notes go through
// generation instead, where the scoping rules apply.
export function partitionNotes(notes) {
  const harvested = [];
  const needsGeneration = [];
  for (const n of notes || []) {
    const row = n?.source === "cross-vault" ? null : harvestRow(n);
    if (row) harvested.push(row);
    else needsGeneration.push(n);
  }
  return { harvested, needsGeneration };
}
