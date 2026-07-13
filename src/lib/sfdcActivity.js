// SFDC activity entries: /api/sfdc-activity streams newline-delimited JSON,
// one {type, subtype, summary} object per activity. Parsing tolerates
// partial trailing lines (mid-stream), code fences, and stray commentary.

const SUMMARY_LIMIT = 800;

export function parseSfdcEntries(text) {
  const entries = [];
  for (const rawLine of (text || "").split("\n")) {
    const line = rawLine.trim().replace(/^```(?:json)?/, "").replace(/```$/, "").trim();
    if (!line.startsWith("{")) continue;
    let obj;
    try { obj = JSON.parse(line); } catch { continue; }
    if (!obj || typeof obj !== "object") continue;
    if (!obj.type && !obj.summary) continue;
    entries.push({
      type: obj.type || "",
      subtype: obj.subtype || "",
      summary: obj.summary || "",
    });
  }
  return entries;
}

export function isOverLimit(summary) {
  return (summary || "").length > SUMMARY_LIMIT;
}

export { SUMMARY_LIMIT };

// A single copy-friendly text block for one entry.
export function entryToText(entry) {
  return `Type: ${entry.type}\nSubtype: ${entry.subtype}\nSummary/Notes:\n${entry.summary}`;
}
