import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dailyLogCatalog } from "./catalog.js";
import type { CatalogDocument } from "./types.js";

/** Deterministic, human-diffable JSON for the bundled offline fallback. */
export function buildCatalogFallbackJson(doc: CatalogDocument = dailyLogCatalog): string {
  return `${JSON.stringify(doc, null, 2)}\n`;
}

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
// Sibling repos, when checked out side by side with this one (the
// developer's actual local layout) -- writing here is best-effort, not a
// hard dependency, so this script still works when only figapp-backend is
// checked out (e.g. CI).
const workspaceRoot = resolve(repoRoot, "..");

function writeIfDirExists(dirPath: string, filePath: string, json: string): boolean {
  if (!existsSync(dirPath)) return false;
  writeFileSync(filePath, json);
  return true;
}

function main(): void {
  const json = buildCatalogFallbackJson();

  const generatedDir = resolve(repoRoot, "generated");
  mkdirSync(generatedDir, { recursive: true });
  const localOut = resolve(generatedDir, "daily-log-catalog-fallback.json");
  writeFileSync(localOut, json);
  console.log(`Wrote ${localOut}`);

  const flutterAssets = resolve(workspaceRoot, "figapp-flutter", "assets");
  const flutterOut = resolve(flutterAssets, "daily_log_catalog_fallback.json");
  console.log(
    writeIfDirExists(flutterAssets, flutterOut, json)
      ? `Wrote ${flutterOut}`
      : `Skipped figapp-flutter (not found at ${flutterAssets})`,
  );

  const webPublic = resolve(workspaceRoot, "figapp-new", "public");
  const webOut = resolve(webPublic, "daily-log-catalog-fallback.json");
  console.log(
    writeIfDirExists(webPublic, webOut, json)
      ? `Wrote ${webOut}`
      : `Skipped figapp-new (not found at ${webPublic})`,
  );
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) main();
