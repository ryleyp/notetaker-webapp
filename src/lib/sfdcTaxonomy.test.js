import { describe, it, expect } from "vitest";
import {
  TAXONOMY,
  TYPE_NAMES,
  subtypesFor,
  isValidPair,
  normalizePair,
  compactTaxonomy,
  detailedTaxonomy,
  SFDC_VOICE_RULES,
} from "@/lib/sfdcTaxonomy";

describe("taxonomy shape", () => {
  it("every type has at least one subtype and an Other escape hatch", () => {
    for (const t of TAXONOMY) {
      expect(t.subtypes.length).toBeGreaterThan(0);
      expect(t.subtypes.map((s) => s.name)).toContain("Other");
    }
  });

  it("uses the Salesforce spellings, not the legacy New Note ones", () => {
    expect(TYPE_NAMES).toContain("Strategic Relationship Management");
    expect(subtypesFor("Strategic Relationship Management")).toContain("Escalation/Risk Management");
    expect(subtypesFor("Strategic Relationship Management")).not.toContain("Escalation / Risk Management");
    expect(subtypesFor("User Groups")).toContain("Demo Days");
  });
});

describe("normalizePair", () => {
  it("passes canonical pairs through unchanged", () => {
    const r = normalizePair("Strategic Relationship Management", "Escalation/Risk Management");
    expect(r).toEqual({ type: "Strategic Relationship Management", subtype: "Escalation/Risk Management", changed: false });
  });

  it("maps legacy New Note spellings onto canonical ones", () => {
    expect(normalizePair("Strategic Relationship Management", "QBR / EBR").subtype).toBe("QBRs/EBRs");
    expect(normalizePair("Strategic Relationship Management", "Product Roadmap Review").subtype).toBe("Roadmap Review");
    expect(normalizePair("Strategic Relationship Management", "SystemLink Enterprise Governance").subtype).toBe("SLE Governance");
    expect(normalizePair("User Groups", "Demo Day").subtype).toBe("Demo Days");
    expect(normalizePair("Internal Alignment and Collaboration", "Account Team Kickoff")).toMatchObject({
      type: "Internal Alignment & Collaboration",
      subtype: "Account Team Kick-Off",
    });
  });

  it("promotes a legacy top-level type that is really a subtype", () => {
    expect(normalizePair("Training or Support Webinar", "Other")).toMatchObject({
      type: "Entitlement Awareness & Promotion",
      subtype: "Training/Support Webinar",
    });
  });

  it("ignores punctuation and case differences", () => {
    expect(normalizePair("onboarding & kick-off", "ea end-user kick-off")).toMatchObject({
      type: "Onboarding & Kick-Off",
      subtype: "EA End-User Kick-Off",
    });
  });

  it("falls back to Other rather than passing junk to Salesforce", () => {
    expect(normalizePair("Nonsense Type", "Nonsense Subtype")).toMatchObject({ type: "Other", subtype: "Other" });
    expect(normalizePair("User Groups", "Not A Real Subtype").subtype).toBe("Other");
    expect(normalizePair("", "")).toMatchObject({ type: "Other", subtype: "Other" });
  });

  it("always returns a pair that validates", () => {
    for (const input of [["QBR / EBR", "x"], ["", ""], ["User Groups", "Demo Day"], ["Other", "whatever"]]) {
      const r = normalizePair(input[0], input[1]);
      expect(isValidPair(r.type, r.subtype)).toBe(true);
    }
  });
});

describe("prompt renderings", () => {
  it("compact lists every type with its subtypes", () => {
    const out = compactTaxonomy();
    for (const t of TYPE_NAMES) expect(out).toContain(t);
    expect(out).toContain("Escalation/Risk Management");
  });

  it("detailed includes descriptions and examples", () => {
    const out = detailedTaxonomy();
    expect(out).toContain("**Type: User Groups**");
    expect(out).toContain("Example:");
    expect(out).toContain("NI-led session");
  });
});

describe("shared voice rules", () => {
  it("carry the anti-passive and anti-jargon guidance", () => {
    expect(SFDC_VOICE_RULES).toContain("does NOT mean passive voice");
    expect(SFDC_VOICE_RULES).toContain("Contractions are good");
    expect(SFDC_VOICE_RULES).toContain("Kill nominalizations");
  });
});
