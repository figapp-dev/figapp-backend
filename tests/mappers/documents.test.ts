import { describe, expect, it } from "vitest";
import {
  displayStatusForAssignee,
  documentExtension,
  supportsFinalPdf,
} from "../../src/mappers/documents.js";

describe("documents mapper helpers", () => {
  it("maps assignee signed/completed to completed display status", () => {
    expect(displayStatusForAssignee("signed")).toBe("completed");
    expect(displayStatusForAssignee("completed")).toBe("completed");
    expect(displayStatusForAssignee("assigned")).toBe("assigned");
    expect(displayStatusForAssignee(null)).toBe("assigned");
  });

  it("detects finalizable file types from title or mime", () => {
    expect(documentExtension({ title: "Policy.pdf" })).toBe("pdf");
    expect(documentExtension({ title: "Scan", file_type: "image/png" })).toBe(
      "png",
    );
    expect(supportsFinalPdf({ title: "form.DOCX" })).toBe(false);
    expect(supportsFinalPdf({ title: "form.pdf" })).toBe(true);
  });
});
