import { describe, expect, it } from "vitest";
import { buildPrompt } from "./route";
import { combineSources } from "@/lib/transcriptSources";

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
