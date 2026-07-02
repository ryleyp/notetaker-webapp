import { describe, it, expect } from "vitest";
import {
  lineContainsKeyword,
  getForbiddenKeywords,
  buildScrubReport,
  scrubWithExceptions,
} from "@/lib/scrub";

const ACCOUNTS = [
  { name: "Lockheed Martin", keywords: ["MFC", "PAC-3"] },
  { name: "L3Harris", keywords: ["WESCAM"] },
  { name: "Northrop Grumman", keywords: ["NGC", "B-21"] },
  { name: "Internal", keywords: ["standup"] },
  { name: "Frontgrade", keywords: [] },
];

function note(filename, content, extra = {}) {
  return { filename, title: filename.replace(".md", ""), date: "2026-06-01", content, ...extra };
}

describe("lineContainsKeyword", () => {
  it("matches whole words case-insensitively", () => {
    expect(lineContainsKeyword("Discussed ngc roadmap", ["NGC"])).toBe(true);
    expect(lineContainsKeyword("Discussed NGC roadmap", ["ngc"])).toBe(true);
  });

  it("does not match a keyword embedded inside a larger word", () => {
    expect(lineContainsKeyword("the engcomputer lab", ["ngc"])).toBe(false);
    expect(lineContainsKeyword("simfcx module", ["mfc"])).toBe(false);
  });

  it("matches keywords adjacent to punctuation", () => {
    expect(lineContainsKeyword("Update (NGC): slipped", ["NGC"])).toBe(true);
    expect(lineContainsKeyword("NGC, LM, and others", ["NGC"])).toBe(true);
    expect(lineContainsKeyword("priorities: B-21.", ["B-21"])).toBe(true);
  });

  it("handles keywords with regex special characters and non-word edges", () => {
    // "B-21" ends with a digit (word char) but contains a dash
    expect(lineContainsKeyword("B-21 program sync", ["B-21"])).toBe(true);
    // keyword ending in non-word char anchors only on the word side
    expect(lineContainsKeyword("uses C++ daily", ["C++"])).toBe(true);
  });

  it("ignores blank or whitespace-only keywords", () => {
    expect(lineContainsKeyword("anything at all", ["", "  "])).toBe(false);
  });
});

describe("getForbiddenKeywords", () => {
  it("collects keywords from all other accounts", () => {
    const kws = getForbiddenKeywords("L3Harris", ACCOUNTS);
    expect(kws).toContain("MFC");
    expect(kws).toContain("NGC");
    expect(kws).toContain("B-21");
  });

  it("excludes the current account's own keywords", () => {
    const kws = getForbiddenKeywords("L3Harris", ACCOUNTS);
    expect(kws).not.toContain("WESCAM");
  });

  it("excludes Internal keywords so internal terms are never scrubbed", () => {
    const kws = getForbiddenKeywords("L3Harris", ACCOUNTS);
    expect(kws).not.toContain("standup");
  });

  it("returns empty for missing account list", () => {
    expect(getForbiddenKeywords("L3Harris", undefined)).toEqual([]);
    expect(getForbiddenKeywords("L3Harris", [])).toEqual([]);
  });
});

describe("buildScrubReport", () => {
  it("flags lines containing other accounts' keywords", () => {
    const notes = [note("2026-06-01 - L3 Sync.md", "L3 renewal on track\nNGC asked about licensing\nAll good")];
    const report = buildScrubReport(notes, "L3Harris", ACCOUNTS);
    expect(report).toHaveLength(1);
    expect(report[0].line).toBe("NGC asked about licensing");
    expect(report[0].id).toBe("2026-06-01 - L3 Sync.md__1");
  });

  it("does not flag the current account's own keywords", () => {
    const notes = [note("a.md", "WESCAM demo went well")];
    expect(buildScrubReport(notes, "L3Harris", ACCOUNTS)).toHaveLength(0);
  });

  it("skips blank lines even if surrounded by flagged content", () => {
    const notes = [note("a.md", "NGC item\n\nNGC item two")];
    const report = buildScrubReport(notes, "L3Harris", ACCOUNTS);
    expect(report.map((r) => r.id)).toEqual(["a.md__0", "a.md__2"]);
  });

  it("returns empty when no other account has keywords", () => {
    const notes = [note("a.md", "NGC everywhere")];
    expect(buildScrubReport(notes, "L3Harris", [{ name: "L3Harris", keywords: ["x"] }])).toEqual([]);
  });

  it("assigns stable per-note line IDs across multiple notes", () => {
    const notes = [note("a.md", "NGC one"), note("b.md", "safe\nMFC two")];
    const report = buildScrubReport(notes, "L3Harris", ACCOUNTS);
    expect(report.map((r) => r.id)).toEqual(["a.md__0", "b.md__1"]);
  });
});

describe("scrubWithExceptions", () => {
  it("removes flagged lines from note content", () => {
    const notes = [note("a.md", "keep this\nNGC secret line\nkeep this too")];
    const [scrubbed] = scrubWithExceptions(notes, "L3Harris", ACCOUNTS);
    expect(scrubbed.content).toBe("keep this\nkeep this too");
  });

  it("preserves lines whose IDs were restored via checkbox", () => {
    const notes = [note("a.md", "keep\nNGC restored line\nMFC removed line")];
    const [scrubbed] = scrubWithExceptions(notes, "L3Harris", ACCOUNTS, ["a.md__1"]);
    expect(scrubbed.content).toBe("keep\nNGC restored line");
  });

  it("returns notes untouched when there are no forbidden keywords", () => {
    const notes = [note("a.md", "NGC everywhere")];
    const result = scrubWithExceptions(notes, "L3Harris", [{ name: "L3Harris", keywords: [] }]);
    expect(result[0].content).toBe("NGC everywhere");
  });

  it("does not let one note's restored ID leak into another note's line", () => {
    const notes = [note("a.md", "NGC line"), note("b.md", "NGC line")];
    const result = scrubWithExceptions(notes, "L3Harris", ACCOUNTS, ["a.md__0"]);
    expect(result[0].content).toBe("NGC line");
    expect(result[1].content).toBe("");
  });

  it("scrub report and scrubber agree on which lines are affected", () => {
    const content = "L3 all good\nNGC status: waiting\nBudget for B-21 grew\nplain line";
    const notes = [note("a.md", content)];
    const report = buildScrubReport(notes, "L3Harris", ACCOUNTS);
    const restoredAll = report.map((r) => r.id);
    // Restoring everything the report flagged must round-trip to the original.
    const [scrubbed] = scrubWithExceptions(notes, "L3Harris", ACCOUNTS, restoredAll);
    expect(scrubbed.content).toBe(content);
  });
});
