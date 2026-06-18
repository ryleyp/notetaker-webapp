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

export function getForbiddenKeywords(accountName, allAccounts) {
  return (allAccounts || [])
    .filter((a) => a.name !== accountName && a.name !== "Internal")
    .flatMap((a) => a.keywords || [])
    .filter(Boolean);
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
export function scrubWithExceptions(notes, accountName, allAccounts, restoredIds = []) {
  const forbidden = getForbiddenKeywords(accountName, allAccounts);
  if (!forbidden.length) return notes;
  const restored = new Set(restoredIds);
  return notes.map((note) => ({
    ...note,
    content: (note.content || "")
      .split("\n")
      .filter((line, idx) => {
        if (restored.has(`${note.filename}__${idx}`)) return true;
        return !lineContainsKeyword(line, forbidden);
      })
      .join("\n"),
  }));
}
