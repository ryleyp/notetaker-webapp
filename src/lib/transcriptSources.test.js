import { describe, it, expect } from "vitest";
import { combineSources, looksMultiSource, listSourceLabels } from "@/lib/transcriptSources";

describe("combineSources", () => {
  it("returns plain text with no headers for a single source", () => {
    const out = combineSources([{ label: "Teams transcript", text: "  Hello there.  " }]);
    expect(out).toBe("Hello there.");
    expect(looksMultiSource(out)).toBe(false);
  });

  it("labels each source when there are two", () => {
    const out = combineSources([
      { label: "Teams transcript", text: "Teams text" },
      { label: "Voice memo", text: "Memo text" },
    ]);
    expect(out).toContain("===== SOURCE 1: Teams transcript =====");
    expect(out).toContain("===== SOURCE 2: Voice memo =====");
    expect(out).toContain("Teams text");
    expect(out).toContain("Memo text");
    expect(looksMultiSource(out)).toBe(true);
  });

  it("ignores empty sources, so one filled source stays plain", () => {
    const out = combineSources([
      { label: "Teams transcript", text: "Only this one" },
      { label: "Voice memo", text: "   " },
    ]);
    expect(out).toBe("Only this one");
    expect(looksMultiSource(out)).toBe(false);
  });

  it("renumbers around gaps so labels stay sequential", () => {
    const out = combineSources([
      { label: "A", text: "first" },
      { label: "B", text: "" },
      { label: "C", text: "third" },
    ]);
    expect(out).toContain("===== SOURCE 1: A =====");
    expect(out).toContain("===== SOURCE 2: C =====");
    expect(out).not.toContain("SOURCE 3");
  });

  it("falls back to a generic label when one is blank", () => {
    const out = combineSources([
      { label: "", text: "first" },
      { label: "", text: "second" },
    ]);
    expect(out).toContain("===== SOURCE 1: Source 1 =====");
    expect(out).toContain("===== SOURCE 2: Source 2 =====");
  });

  it("returns empty string when nothing has content", () => {
    expect(combineSources([])).toBe("");
    expect(combineSources([{ label: "x", text: "  " }])).toBe("");
    expect(combineSources(null)).toBe("");
  });
});

describe("looksMultiSource", () => {
  it("requires at least two headers", () => {
    expect(looksMultiSource("===== SOURCE 1: Teams =====\n\ntext")).toBe(false);
    expect(looksMultiSource("plain transcript text")).toBe(false);
    expect(looksMultiSource("")).toBe(false);
    expect(looksMultiSource(undefined)).toBe(false);
  });

  it("does not false-positive on similar prose", () => {
    expect(looksMultiSource("We discussed the source of the issue twice.")).toBe(false);
  });
});

describe("listSourceLabels", () => {
  it("extracts labels in order", () => {
    const out = combineSources([
      { label: "Teams transcript", text: "a" },
      { label: "Voice memo", text: "b" },
    ]);
    expect(listSourceLabels(out)).toEqual(["Teams transcript", "Voice memo"]);
  });

  it("returns empty for a single-source document", () => {
    expect(listSourceLabels("just text")).toEqual([]);
  });
});
