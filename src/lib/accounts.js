export function detectAccount(folderName) {
  const f = (folderName || "").toLowerCase();
  if (f.includes("lockheed")) return { keyword: "lockheed", archiveFolder: "LM Transcripts" };
  if (f.includes("l3harris") || (f.includes("l3") && f.includes("harris"))) return { keyword: "l3harris", archiveFolder: "L3 Transcripts" };
  if (f.includes("northrop")) return { keyword: "northrop", archiveFolder: "NGC Transcripts" };
  if (f.includes("frontgrade")) return { keyword: "frontgrade", archiveFolder: "Frontgrade Transcripts" };
  return { keyword: null, archiveFolder: "Internal Transcripts" };
}

// Given transcript + title text, find the best-matching vault folder from a list
export function matchVaultFolder(text, folders) {
  const t = text.toLowerCase();
  const keywords = [
    { match: "lockheed", keywords: ["lockheed"] },
    { match: "l3harris", keywords: ["l3harris", "l3 harris"] },
    { match: "northrop", keywords: ["northrop"] },
    { match: "frontgrade", keywords: ["frontgrade"] },
  ];
  for (const { match, keywords: kws } of keywords) {
    if (kws.some((k) => t.includes(k))) {
      const folder = folders.find((f) => f.name.toLowerCase().includes(match));
      if (folder) return folder.path;
    }
  }
  return null;
}
