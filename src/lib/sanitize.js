export function applyCorrections(text, corrections) {
  if (!corrections?.length) return text;
  let result = text;
  for (const { find, replace } of corrections) {
    if (!find?.trim()) continue;
    result = result.replaceAll(find, replace ?? "");
  }
  return result;
}


function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Match a term as a whole word where possible. Anchoring with word boundaries
// keeps a short term/alias from matching inside a longer one — e.g. reversing
// "ORG_1" must not corrupt "ORG_12". Boundaries are only added on sides where
// the term edge is itself a word character (so "C++" still matches).
function wordBoundaryRegex(term, flags) {
  const esc = escapeRegex(term);
  const left = /^\w/.test(term) ? "\\b" : "";
  const right = /\w$/.test(term) ? "\\b" : "";
  return new RegExp(`${left}${esc}${right}`, flags);
}

export function applyReplacements(text, replacements) {
  let result = text;
  for (const r of replacements) {
    if (!r.skip && r.original) {
      result = result.replace(wordBoundaryRegex(r.original, "gi"), r.alias);
    }
  }
  return result;
}

export function reverseReplacements(text, replacements) {
  let result = text;
  for (const r of [...replacements].reverse()) {
    if (!r.skip && r.alias) {
      result = result.replace(wordBoundaryRegex(r.alias, "gi"), r.restored || r.original);
    }
  }
  return result;
}

export function assignAliases(entities, existingReplacements) {
  const usedAliases = new Set(existingReplacements.map((r) => r.alias));
  return entities.map((e) => {
    const prefix = e.type === "person" ? "PERSON" : "ORG";
    let n = 1;
    while (usedAliases.has(`${prefix}_${n}`)) n++;
    const alias = `${prefix}_${n}`;
    usedAliases.add(alias);
    return { ...e, alias };
  });
}
