import type { CatalogDocument } from "./types.js";

export const SUPPORTED_CATALOG_SCHEMA_VERSION = 1;

export function isSchemaSupported(
  doc: Pick<CatalogDocument, "schemaVersion">,
): boolean {
  return doc.schemaVersion === SUPPORTED_CATALOG_SCHEMA_VERSION;
}

/** Fetched copy wins only if this binary understands its schema and its
 * content is newer than the bundled seed; otherwise the seed is used. */
export function chooseCatalog(
  fetched: CatalogDocument | null,
  bundled: CatalogDocument,
): CatalogDocument {
  if (!fetched || !isSchemaSupported(fetched)) return bundled;
  return fetched.catalogVersion > bundled.catalogVersion ? fetched : bundled;
}
