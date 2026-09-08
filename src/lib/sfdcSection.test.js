import { describe, it, expect } from "vitest";
import { parseSfdcSection, hasSfdcSection, harvestRow, partitionNotes } from "@/lib/sfdcSection";

const NOTE = `# 2026-07-15 - LM Sync

## Executive Summary

Some summary.

## SFDC Activity Entry

**Type:** Strategic Relationship Management
**Subtype:** Escalation / Risk Management
**EA/EP Number(s):** EP - 55209

**Summary/Notes:**
Summary: Walked Gokul through the migration plan.
Outcomes: Gokul greenlit the plan.
Next steps: Set up the MFC briefing.
`;

describe("parseSfdcSection", () => {
  it("pulls type, subtype, agreement, and the comment block", () => {
    const p = parseSfdcSection(NOTE);
    expect(p.type).toBe("Strategic Relationship Management");
    expect(p.agreements).toBe("EP - 55209");
    expect(p.comments).toContain("Summary: Walked Gokul through the migration plan.");
    expect(p.comments).toContain("Next steps: Set up the MFC briefing.");
  });

  it("normalizes a legacy subtype spelling to the Salesforce value", () => {
    // The note says "Escalation / Risk Management"; Salesforce wants no spaces.
    expect(parseSfdcSection(NOTE).subtype).toBe("Escalation/Risk Management");
  });

  it("keeps the field labels out of the comment text", () => {
    const c = parseSfdcSection(NOTE).comments;
    expect(c).not.toContain("Type:");
    expect(c).not.toContain("EA/EP");
    expect(c).not.toContain("Summary/Notes");
  });

  it("treats 'None on file' as no agreement", () => {
    const n = NOTE.replace("EP - 55209", "None on file");
    expect(parseSfdcSection(n).agreements).toBe("");
  });

  it("returns null for a note with no SFDC section", () => {
    expect(parseSfdcSection("# Just a note\n\nSome text.")).toBeNull();
    expect(parseSfdcSection("")).toBeNull();
    expect(hasSfdcSection("# Note")).toBe(false);
  });

  it("stops at the next heading so it does not swallow later sections", () => {
    const withTrailer = NOTE + "\n## Something Else\n\nUnrelated content here.\n";
    expect(parseSfdcSection(withTrailer).comments).not.toContain("Unrelated content");
  });
});

describe("harvestRow", () => {
  it("builds a row marked as harvested from the note", () => {
    const row = harvestRow({ date: "2026-07-15", title: "LM Sync", content: NOTE });
    expect(row).toMatchObject({
      eventDate: "2026-07-15",
      title: "LM Sync",
      type: "Strategic Relationship Management",
      subtype: "Escalation/Risk Management",
      origin: "note",
      sourceTitle: "LM Sync",
    });
    expect(row.review).toBe(false);
  });

  it("returns null when there is nothing to harvest", () => {
    expect(harvestRow({ date: "2026-07-15", title: "x", content: "no section" })).toBeNull();
  });
});

describe("partitionNotes", () => {
  it("splits notes into harvestable and needs-generation", () => {
    const notes = [
      { date: "2026-07-15", title: "Has section", content: NOTE },
      { date: "2026-07-16", title: "Raw note", content: "# Raw\n\njust text" },
    ];
    const { harvested, needsGeneration } = partitionNotes(notes);
    expect(harvested).toHaveLength(1);
    expect(harvested[0].title).toBe("Has section");
    expect(needsGeneration).toHaveLength(1);
    expect(needsGeneration[0].title).toBe("Raw note");
  });

  it("handles empty input", () => {
    expect(partitionNotes([])).toEqual({ harvested: [], needsGeneration: [] });
    expect(partitionNotes(null)).toEqual({ harvested: [], needsGeneration: [] });
  });
});

describe("cross-folder notes are never harvested", () => {
  it("routes a cross-vault note to generation even when it has an SFDC section", () => {
    const notes = [
      { date: "2026-07-15", title: "Own folder", content: NOTE, source: "obsidian" },
      { date: "2026-07-16", title: "Other account folder", content: NOTE, source: "cross-vault" },
    ];
    const { harvested, needsGeneration } = partitionNotes(notes);
    expect(harvested.map((r) => r.title)).toEqual(["Own folder"]);
    expect(needsGeneration.map((n) => n.title)).toEqual(["Other account folder"]);
  });

  it("still harvests notes with no source label (primary folder)", () => {
    const { harvested } = partitionNotes([{ date: "2026-07-15", title: "Unlabeled", content: NOTE }]);
    expect(harvested).toHaveLength(1);
  });
});
