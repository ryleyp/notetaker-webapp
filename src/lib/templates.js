// Note templates customize ONLY the "## Meeting Notes" section instructions.
// Every other section of the generated note (tag line, Executive Summary,
// CS takeaways, Action Items, Next Steps) is fixed in the process route and
// identical across templates.

export const DEFAULT_NOTES_INSTRUCTIONS =
  "Provide thorough bulleted notes that capture all important information from the transcript. Focus on decisions, key points, and meaningful details — skip filler, repetition, tangential remarks, and personal updates or check-ins. Use sub-bullets for important specifics. Organize by topic when appropriate. Quote or closely paraphrase notable statements.";

export const DEFAULT_TEMPLATES = [
  {
    id: "customer-call",
    name: "Customer Call",
    description: "General customer meeting — the standard exhaustive notes format.",
    notesInstructions: DEFAULT_NOTES_INSTRUCTIONS,
  },
  {
    id: "internal-sync",
    name: "Internal Sync",
    description: "Internal team meeting — decisions, blockers, and ownership.",
    notesInstructions:
      "Provide bulleted notes organized around internal alignment: decisions made and who made them, blockers and dependencies between teams, resource or priority changes, and status updates on ongoing work. Call out any disagreements and how (or whether) they were resolved. Use sub-bullets for specifics.",
  },
  {
    id: "one-on-one",
    name: "1:1",
    description: "One-on-one conversation — topics, feedback, and agreements.",
    notesInstructions:
      "Provide bulleted notes organized by discussion topic. Capture updates shared by each person, feedback given or received, coaching or career-development points, concerns raised, and agreements made. Keep sensitive topics factual and neutral. Use sub-bullets for specifics.",
  },
  {
    id: "qbr",
    name: "QBR / Business Review",
    description: "Quarterly or executive business review — results, risks, and commercial topics.",
    notesInstructions:
      "Provide bulleted notes structured as a business review: goals versus actual results (quote any metrics exactly), product usage and adoption trends, wins and success stories, risks and escalations, roadmap items and feature requests discussed, and commercial topics such as renewal, expansion, or budget. Quote numbers and dates exactly as stated.",
  },
  {
    id: "technical-deep-dive",
    name: "Technical Deep-Dive",
    description: "Technical working session — architecture, limitations, and open questions.",
    notesInstructions:
      "Provide bulleted notes focused on technical content: the problem or use case being discussed, architecture and integration details, product capabilities and limitations raised, workarounds or solutions proposed, environment specifics (versions, platforms, tooling), and unresolved technical questions. Preserve exact technical terms, error messages, and version numbers.",
  },
];

// Returns the template matching `id`, falling back to the first template of the
// provided list, then to the built-in defaults.
export function resolveTemplate(templates, id) {
  const list = templates?.length ? templates : DEFAULT_TEMPLATES;
  return list.find((t) => t.id === id) || list[0];
}

export function templateIdFromName(name, existingIds = []) {
  const base =
    String(name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "template";
  let id = base;
  let n = 2;
  while (existingIds.includes(id)) {
    id = `${base}-${n}`;
    n += 1;
  }
  return id;
}
