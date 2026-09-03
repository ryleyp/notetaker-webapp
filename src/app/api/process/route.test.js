import { describe, expect, it } from "vitest";
import { buildPrompt } from "./route";
import { combineSources } from "@/lib/transcriptSources";

describe("SFDC activity voice rules", () => {
  const prompt = buildPrompt("Jordan discussed the Dallas lab rollout.", "Planning Sync");

  it("bans passive voice while keeping the no-first-person rule", () => {
    expect(prompt).toContain('no first person ("I"/"we")');
    expect(prompt).toContain("does NOT mean passive voice");
    expect(prompt).toContain("Drop the subject instead");
  });

  it("allows contractions and fragments so it reads like a person", () => {
    expect(prompt).toContain("Contractions are good");
    expect(prompt).toContain("Fragments are fine");
  });

  it("gives a concrete too-formal vs right example", () => {
    expect(prompt).toContain("VOICE EXAMPLE");
    expect(prompt).toContain("Too formal (never write like this)");
    expect(prompt).toContain("Right (write like this)");
    // The bad example must appear before the good one so the contrast reads correctly.
    expect(prompt.indexOf("Too formal")).toBeLessThan(prompt.indexOf("Right (write like this)"));
  });

  it("blocks the usual corporate filler and nominalizations", () => {
    for (const word of ["synergy", "circle back", "touch base", "utilize", "facilitate"]) {
      expect(prompt).toContain(word);
    }
    expect(prompt).toContain("Kill nominalizations");
  });

  it("still enforces the 120-word SFDC cap", () => {
    expect(prompt).toContain("at most 120 words and 800 characters or fewer");
  });
});

describe("buildPrompt with multiple transcript sources", () => {
  const combined = combineSources([
    { label: "Teams transcript", text: "Jordan confirmed the rollout." },
    { label: "Voice memo", text: "Jordan also flagged a budget risk." },
  ]);

  it("tells the model the sources are one meeting and must merge", () => {
    const prompt = buildPrompt(combined, "Planning Sync");

    expect(prompt).toContain("MULTIPLE SOURCES");
    expect(prompt).toContain("SAME meeting");
    expect(prompt).toContain("ONE unified set of notes");
    expect(prompt).toContain("Teams transcript; Voice memo");
  });

  it("asks for source conflicts to be surfaced", () => {
    const prompt = buildPrompt(combined, "Planning Sync");
    expect(prompt).toContain("## ⚠️ Source Conflicts");
  });

  it("keeps both sources' content in the prompt", () => {
    const prompt = buildPrompt(combined, "Planning Sync");
    expect(prompt).toContain("Jordan confirmed the rollout.");
    expect(prompt).toContain("Jordan also flagged a budget risk.");
  });

  it("adds no multi-source guidance for a single transcript", () => {
    const single = combineSources([{ label: "Teams transcript", text: "Only one recording." }]);
    const prompt = buildPrompt(single, "Planning Sync");

    expect(prompt).not.toContain("MULTIPLE SOURCES");
    expect(prompt).not.toContain("## ⚠️ Source Conflicts");
    expect(prompt).toContain("Only one recording.");
  });
});

describe("buildPrompt", () => {
  it("includes user and site callouts before action items", () => {
    const prompt = buildPrompt("Jordan discussed the Dallas lab rollout.", "Planning Sync");

    expect(prompt).toContain("## User-Level Callouts");
    expect(prompt).toContain("## Site-Level Callouts");
    expect(prompt).toContain("specific customer users");
    expect(prompt).toContain("specific customer sites");
    expect(prompt.indexOf("## User-Level Callouts")).toBeLessThan(prompt.indexOf("## Action Items"));
    expect(prompt.indexOf("## Site-Level Callouts")).toBeLessThan(prompt.indexOf("## Action Items"));
  });

  it("caps the existing summary and notes sections without adding outcomes", () => {
    const prompt = buildPrompt("Jordan discussed the Dallas lab rollout.", "Planning Sync");

    expect(prompt).toContain("Executive Summary and Meeting Notes sections together must be 120 words or fewer");
    expect(prompt).toContain("This section and Executive Summary together must be 120 words or fewer");
    expect(prompt).not.toContain("## Outcomes");
  });
});
