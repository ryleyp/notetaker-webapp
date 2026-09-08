import { describe, it, expect } from "vitest";
import { parseActivityRows, rowsToMarkdown, rowsToNDJSON, sortRows, rowKey } from "@/lib/activityRows";

const ROW = { eventDate: "2026-04-12", title: "EA Admin Sync", type: "Strategic Relationship Management", subtype: "EA Admin Sync", comments: "CSM synced with Dana Voss.", agreements: "", sourceTitle: "Q2 Admin Sync", origin: "generated", review: false, reviewReason: "", verify: "", verifyReason: "" };

describe("parseActivityRows", () => {
  it("parses one JSON object per line", () => {
    const text = `${JSON.stringify(ROW)}\n${JSON.stringify({ ...ROW, title: "Second" })}`;
    const rows = parseActivityRows(text);
    expect(rows).toHaveLength(2);
    expect(rows[1].title).toBe("Second");
  });

  it("ignores a partial trailing line while streaming", () => {
    const text = `${JSON.stringify(ROW)}\n{"eventDate":"2026-05-01","title":"Cut off mid`;
    expect(parseActivityRows(text)).toHaveLength(1);
  });

  it("ignores code fences and commentary lines", () => {
    const text = "```json\n" + JSON.stringify(ROW) + "\n```\nHere are your activities:";
    const rows = parseActivityRows(text);
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("EA Admin Sync");
  });

  it("preserves review flags", () => {
    const flagged = { ...ROW, review: true, reviewReason: "Could be Demo Days" };
    const rows = parseActivityRows(JSON.stringify(flagged));
    expect(rows[0].review).toBe(true);
    expect(rows[0].reviewReason).toBe("Could be Demo Days");
  });

  it("handles pipes inside comments without splitting anything", () => {
    const withPipe = { ...ROW, comments: "Region: AMER | Attendees: 22" };
    const rows = parseActivityRows(JSON.stringify(withPipe));
    expect(rows[0].comments).toBe("Region: AMER | Attendees: 22");
  });

  it("returns empty for blank/undefined input", () => {
    expect(parseActivityRows("")).toEqual([]);
    expect(parseActivityRows(undefined)).toEqual([]);
  });
});

describe("rowsToMarkdown", () => {
  it("renders a well-formed table and escapes pipes in cells", () => {
    const md = rowsToMarkdown([{ ...ROW, comments: "A | B" }]);
    const lines = md.split("\n");
    expect(lines[0]).toContain("| Event Date |");
    expect(lines[2]).toContain("A \\| B");
    // Every line has the same number of unescaped column separators
    const cols = (l) => (l.replace(/\\\|/g, "").match(/\|/g) || []).length;
    expect(cols(lines[2])).toBe(cols(lines[0]));
  });

  it("flattens newlines inside comments", () => {
    const md = rowsToMarkdown([{ ...ROW, comments: "line one\nline two" }]);
    expect(md.split("\n")).toHaveLength(3);
  });
});

describe("round trip", () => {
  it("NDJSON serialization reparses to the same rows", () => {
    const rows = [ROW, { ...ROW, title: "Two", review: true, reviewReason: "why" }];
    expect(parseActivityRows(rowsToNDJSON(rows))).toEqual(rows);
  });
});

describe("type normalization on parse", () => {
  it("maps a legacy subtype spelling onto the Salesforce value", () => {
    const legacy = { ...ROW, subtype: "QBR / EBR" };
    expect(parseActivityRows(JSON.stringify(legacy))[0].subtype).toBe("QBRs/EBRs");
  });

  it("falls back to Other for an unknown pair", () => {
    const junk = { ...ROW, type: "Made Up", subtype: "Nope" };
    const r = parseActivityRows(JSON.stringify(junk))[0];
    expect(r.type).toBe("Other");
    expect(r.subtype).toBe("Other");
  });

  it("preserves origin and agreements from harvested rows", () => {
    const harvested = { ...ROW, origin: "note", agreements: "EP - 55209" };
    const r = parseActivityRows(JSON.stringify(harvested))[0];
    expect(r.origin).toBe("note");
    expect(r.agreements).toBe("EP - 55209");
  });

  it("defaults unknown origins to generated", () => {
    expect(parseActivityRows(JSON.stringify({ ...ROW, origin: "weird" }))[0].origin).toBe("generated");
  });
});

describe("sortRows", () => {
  it("orders newest first", () => {
    const rows = [
      { ...ROW, eventDate: "2026-01-05", title: "Old" },
      { ...ROW, eventDate: "2026-06-01", title: "New" },
      { ...ROW, eventDate: "2026-03-10", title: "Mid" },
    ];
    expect(sortRows(rows).map((r) => r.title)).toEqual(["New", "Mid", "Old"]);
  });

  it("sinks undated rows to the bottom", () => {
    const rows = [
      { ...ROW, eventDate: "", title: "Undated" },
      { ...ROW, eventDate: "2026-03-10", title: "Dated" },
    ];
    expect(sortRows(rows).map((r) => r.title)).toEqual(["Dated", "Undated"]);
  });

  it("does not mutate the input", () => {
    const rows = [{ ...ROW, eventDate: "2026-01-01" }, { ...ROW, eventDate: "2026-09-01" }];
    const before = rows.map((r) => r.eventDate);
    sortRows(rows);
    expect(rows.map((r) => r.eventDate)).toEqual(before);
  });
});

describe("rowKey", () => {
  it("is stable across regenerations and case differences", () => {
    expect(rowKey({ eventDate: "2026-04-12", title: "EA Admin Sync" }))
      .toBe(rowKey({ eventDate: "2026-04-12", title: "  ea admin sync  " }));
  });

  it("differs when the date differs", () => {
    expect(rowKey({ eventDate: "2026-04-12", title: "X" }))
      .not.toBe(rowKey({ eventDate: "2026-04-13", title: "X" }));
  });
});

describe("rowsToMarkdown with EA/EP", () => {
  it("adds the EA/EP column only when some row has one", () => {
    expect(rowsToMarkdown([ROW])).not.toContain("EA/EP");
    const withAgreement = rowsToMarkdown([{ ...ROW, agreements: "EP - 55209" }]);
    expect(withAgreement).toContain("| EA/EP |");
    expect(withAgreement).toContain("EP - 55209");
  });
});
