// Multiple recordings of the SAME meeting (e.g. a Teams transcript plus a
// voice memo with extra context) are combined into one labeled document so
// the whole downstream pipeline — sanitization, speaker detection, EA
// matching, archiving, and the single generation call — keeps operating on
// one string.
//
// A single source stays completely plain, so nothing changes for the common
// one-transcript case.

const HEADER_RE = /^===== SOURCE \d+: (.+?) =====$/gm;

export function sourceHeader(index, label) {
  return `===== SOURCE ${index + 1}: ${label} =====`;
}

// Drop empty sources, then join with labeled headers. Returns plain text
// when only one source has content.
export function combineSources(sources) {
  const filled = (sources || []).filter((s) => (s?.text || "").trim());
  if (filled.length === 0) return "";
  if (filled.length === 1) return filled[0].text.trim();
  return filled
    .map((s, i) => {
      const label = (s.label || "").trim() || `Source ${i + 1}`;
      return `${sourceHeader(i, label)}\n\n${s.text.trim()}`;
    })
    .join("\n\n");
}

// True only when a combined document actually holds 2+ labeled sources.
export function looksMultiSource(text) {
  const matches = (text || "").match(HEADER_RE);
  return !!matches && matches.length >= 2;
}

export function listSourceLabels(text) {
  const labels = [];
  for (const m of (text || "").matchAll(HEADER_RE)) labels.push(m[1].trim());
  return labels;
}
