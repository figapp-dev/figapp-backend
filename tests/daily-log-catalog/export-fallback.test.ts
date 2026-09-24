import { describe, expect, it } from "vitest";
import { buildCatalogFallbackJson } from "../../src/daily-log-catalog/export-fallback.js";
import { dailyLogCatalog } from "../../src/daily-log-catalog/catalog.js";
import { validateCatalog } from "../../src/daily-log-catalog/validate.js";
import type { CatalogDocument } from "../../src/daily-log-catalog/types.js";

describe("buildCatalogFallbackJson", () => {
  it("round-trips to a deep-equal, still-valid CatalogDocument", () => {
    const json = buildCatalogFallbackJson();
    const parsed = JSON.parse(json) as CatalogDocument;

    expect(parsed).toEqual(dailyLogCatalog);
    expect(validateCatalog(parsed)).toEqual([]);
  });

  it("ends with a trailing newline for clean diffs", () => {
    expect(buildCatalogFallbackJson().endsWith("\n")).toBe(true);
  });
});
