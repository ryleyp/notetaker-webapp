import { describe, expect, it } from "vitest";
import {
  DEFAULT_NOTES_INSTRUCTIONS,
  DEFAULT_TEMPLATES,
  resolveTemplate,
  templateIdFromName,
} from "./templates";

describe("DEFAULT_TEMPLATES", () => {
  it("has unique ids and complete fields", () => {
    const ids = DEFAULT_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of DEFAULT_TEMPLATES) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.notesInstructions.trim().length).toBeGreaterThan(0);
    }
  });

  it("keeps the original notes format as the first (default) template", () => {
    expect(DEFAULT_TEMPLATES[0].id).toBe("customer-call");
    expect(DEFAULT_TEMPLATES[0].notesInstructions).toBe(DEFAULT_NOTES_INSTRUCTIONS);
  });
});

describe("resolveTemplate", () => {
  it("finds a template by id", () => {
    expect(resolveTemplate(DEFAULT_TEMPLATES, "qbr").name).toBe("QBR / Business Review");
  });

  it("falls back to the first template for an unknown id", () => {
    expect(resolveTemplate(DEFAULT_TEMPLATES, "does-not-exist")).toBe(DEFAULT_TEMPLATES[0]);
  });

  it("falls back to built-in defaults when the list is empty or missing", () => {
    expect(resolveTemplate([], "qbr").id).toBe("qbr");
    expect(resolveTemplate(undefined, "nope")).toBe(DEFAULT_TEMPLATES[0]);
  });

  it("prefers a custom template list over the defaults", () => {
    const custom = [{ id: "demo", name: "Demo", notesInstructions: "Notes about the demo." }];
    expect(resolveTemplate(custom, "demo").name).toBe("Demo");
    expect(resolveTemplate(custom, "customer-call")).toBe(custom[0]);
  });
});

describe("templateIdFromName", () => {
  it("slugifies names", () => {
    expect(templateIdFromName("QBR / Business Review")).toBe("qbr-business-review");
  });

  it("deduplicates against existing ids", () => {
    expect(templateIdFromName("1:1", ["1-1"])).toBe("1-1-2");
  });

  it("handles empty names", () => {
    expect(templateIdFromName("")).toBe("template");
  });
});
