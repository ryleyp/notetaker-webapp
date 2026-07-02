function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function lineContainsKeyword(line, keywords) {
  return keywords.some((kw) => {
    const k = (kw || "").trim();
    if (!k) return false;
    const esc = escapeRegex(k);
    const left = /^\w/.test(k) ? "\\b" : "";
    const right = /\w$/.test(k) ? "\\b" : "";
    return new RegExp(`${left}${esc}${right}`, "i").test(line);
  });
}

// Every term tied to another account: its name, aliases, AND keywords.
// Scrubbing only keywords let lines like "L3Harris asked about X" bleed into
// other accounts' reports. Internal reports legitimately span accounts, so
// nothing is scrubbed there.
export function getForbiddenKeywords(accountName, allAccounts) {
  if (!accountName || accountName === "Internal") return [];
  const own = new Set(
    (allAccounts || [])
      .filter((a) => a.name === accountName)
      .flatMap((a) => [a.name, ...(a.aliases || []), ...(a.keywords || [])])
      .filter(Boolean)
      .map((t) => t.toLowerCase())
  );
  return (allAccounts || [])
    .filter((a) => a.name !== accountName && a.name !== "Internal")
    .flatMap((a) => [a.name, ...(a.aliases || []), ...(a.keywords || [])])
    .filter(Boolean)
    // Never scrub a term the current account also claims (alias collisions).
    .filter((t) => !own.has(t.toLowerCase()));
}

// Replace every occurrence of another account's name/alias/keyword in text.
// Used on note titles before sending, and on generated output as a hard
// backstop — a report about one account must never show another's terms.
export function redactForbiddenTerms(text, accountName, allAccounts, replacement = "█████") {
  const forbidden = getForbiddenKeywords(accountName, allAccounts);
  let out = text || "";
  let count = 0;
  for (const kw of forbidden) {
    const k = (kw || "").trim();
    if (!k) continue;
    const esc = escapeRegex(k);
    const left = /^\w/.test(k) ? "\\b" : "";
    const right = /\w$/.test(k) ? "\\b" : "";
    out = out.replace(new RegExp(`${left}${esc}${right}`, "gi"), () => {
      count++;
      return replacement;
    });
  }
  return { text: out, count };
}

// Scan generated output for terms tied to other accounts. Returns the unique
// offending terms grouped by account, for a post-generation warning.
export function findAccountBleed(text, accountName, allAccounts) {
  if (!text || !accountName || accountName === "Internal") return [];
  const own = new Set(
    (allAccounts || [])
      .filter((a) => a.name === accountName)
      .flatMap((a) => [a.name, ...(a.aliases || []), ...(a.keywords || [])])
      .filter(Boolean)
      .map((t) => t.toLowerCase())
  );
  const hits = [];
  for (const a of allAccounts || []) {
    if (a.name === accountName || a.name === "Internal") continue;
    const terms = [a.name, ...(a.aliases || []), ...(a.keywords || [])]
      .filter(Boolean)
      .filter((t) => !own.has(t.toLowerCase()))
      .filter((t) => lineContainsKeyword(text, [t]));
    if (terms.length) hits.push({ account: a.name, terms });
  }
  return hits;
}

// Returns list of lines that would be scrubbed, with stable IDs.
export function buildScrubReport(notes, accountName, allAccounts) {
  const forbidden = getForbiddenKeywords(accountName, allAccounts);
  if (!forbidden.length) return [];
  const report = [];
  for (const note of notes) {
    (note.content || "").split("\n").forEach((line, idx) => {
      if (line.trim() && lineContainsKeyword(line, forbidden)) {
        report.push({
          id: `${note.filename}__${idx}`,
          noteFilename: note.filename,
          noteTitle: note.title,
          noteDate: note.date,
          line,
        });
      }
    });
  }
  return report;
}

// Scrub forbidden keywords from notes, preserving lines whose IDs are restored.
// Note titles are redacted (not droppable) — they reach the prompt as source
// headings, so another account's name in a title would bleed straight through.
export function scrubWithExceptions(notes, accountName, allAccounts, restoredIds = []) {
  const forbidden = getForbiddenKeywords(accountName, allAccounts);
  if (!forbidden.length) return notes;
  const restored = new Set(restoredIds);
  return notes.map((note) => ({
    ...note,
    title: redactForbiddenTerms(note.title || "", accountName, allAccounts).text,
    content: (note.content || "")
      .split("\n")
      .filter((line, idx) => {
        if (restored.has(`${note.filename}__${idx}`)) return true;
        return !lineContainsKeyword(line, forbidden);
      })
      .join("\n"),
  }));
}
