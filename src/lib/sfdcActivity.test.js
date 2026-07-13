import { describe, it, expect } from "vitest";
import { parseSfdcEntries, isOverLimit, entryToText, SUMMARY_LIMIT } from "@/lib/sfdcActivity";

const ENTRY = {
  type: "Strategic Relationship Management",
  subtype: "EA Admin Sync",
  summary: "Summary: Synced with the EA admin.\nOutcomes: Aligned on renewal timeline.\nNext steps: Ryley to send recap.",
};

describe("parseSfdcEntries", () => {
  it("parses one JSON object per line", () => {
    const text = `${JSON.stringify(ENTRY)}\n${JSON.stringify({ ...ENTRY, subtype: "QBR / EBR" })}`;
    const entries = parseSfdcEntries(text);
    expect(entries).toHaveLength(2);
    expect(entries[1].subtype).toBe("QBR / EBR");
  });

  it("ignores a partial trailing line while streaming", () => {
    const text = `${JSON.stringify(ENTRY)}\n{"type":"Onboarding & Kick-off","subtype":"EA Admin On`;
    expect(parseSfdcEntries(text)).toHaveLength(1);
  });

  it("ignores code fences and commentary", () => {
    const text = "```json\n" + JSON.stringify(ENTRY) + "\n```\nHere are your entries:";
    const entries = parseSfdcEntries(text);
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe("Strategic Relationship Management");
  });

  it("preserves newlines inside the summary field", () => {
    const entries = parseSfdcEntries(JSON.stringify(ENTRY));
    expect(entries[0].summary.split("\n")).toHaveLength(3);
    expect(entries[0].summary).toContain("Next steps:");
  });

  it("returns empty for blank/undefined input", () => {
    expect(parseSfdcEntries("")).toEqual([]);
    expect(parseSfdcEntries(undefined)).toEqual([]);
  });
});

describe("isOverLimit", () => {
  it("flags summaries over the SFDC field limit", () => {
    expect(isOverLimit("a".repeat(SUMMARY_LIMIT))).toBe(false);
    expect(isOverLimit("a".repeat(SUMMARY_LIMIT + 1))).toBe(true);
    expect(isOverLimit("")).toBe(false);
  });
});

describe("entryToText", () => {
  it("renders a copy-friendly block with all three fields", () => {
    const text = entryToText(ENTRY);
    expect(text).toContain("Type: Strategic Relationship Management");
    expect(text).toContain("Subtype: EA Admin Sync");
    expect(text).toContain("Summary/Notes:");
    expect(text).toContain("Next steps: Ryley to send recap.");
  });
});
