import type { CatalogDocument, CatalogEntry, FieldCondition } from "./types.js";
import { dailyLogCatalog } from "./catalog.js";

// The only context vocabulary this project defines today. A future
// context key would need its own canonical-value rule; this one is scoped
// to "educationArrangement" specifically rather than every context key.
const CANONICAL_ARRANGEMENT_IDS: ReadonlySet<string> = new Set([
  "formal_schooling",
  "home_learning",
  "early_years",
  "sixteen_plus",
  "employment_training",
]);

export function validateCatalog(doc: CatalogDocument): string[] {
  const errors: string[] = [];
  const topLevelIds = new Set(Object.keys(doc.fields));

  for (const [key, entry] of Object.entries(doc.fields)) {
    if (entry.fieldId !== key) {
      errors.push(`fields.${key}: fieldId "${entry.fieldId}" does not match its own key`);
    }
    validateEntry(entry, topLevelIds, null, errors, `fields.${key}`);
  }

  return errors;
}

function validateEntry(
  entry: CatalogEntry,
  topLevelIds: Set<string>,
  siblingIds: Set<string> | null,
  errors: string[],
  path: string,
): void {
  if (entry.visibleWhen) {
    validateCondition(entry.visibleWhen, topLevelIds, siblingIds, errors, `${path}.visibleWhen`);
  }

  for (const [i, variant] of (entry.question.variants ?? []).entries()) {
    validateCondition(variant.when, topLevelIds, siblingIds, errors, `${path}.question.variants[${i}]`);
  }

  if (entry.suggestions) {
    for (const [i, variant] of (entry.suggestions.variants ?? []).entries()) {
      // Already structurally required by the SuggestionVariant type, so
      // this is unreachable through a type-checked literal -- kept as a
      // defensive runtime check in case the catalog is ever loaded from
      // untyped data (e.g. JSON) rather than authored as TypeScript.
      if (!variant.when) {
        errors.push(`${path}.suggestions.variants[${i}]: missing "when"`);
        continue;
      }
      validateCondition(variant.when, topLevelIds, siblingIds, errors, `${path}.suggestions.variants[${i}]`);
    }
  }

  if (entry.repeatableFields) {
    const seen = new Set<string>();
    for (const child of entry.repeatableFields) {
      if (seen.has(child.fieldId)) {
        errors.push(`${path}.repeatableFields: duplicate fieldId "${child.fieldId}"`);
      }
      seen.add(child.fieldId);
    }
    const childSiblingIds = new Set(entry.repeatableFields.map((f) => f.fieldId));
    for (const child of entry.repeatableFields) {
      validateEntry(child, topLevelIds, childSiblingIds, errors, `${path}.repeatableFields.${child.fieldId}`);
    }
  }
}

function validateCondition(
  condition: FieldCondition,
  topLevelIds: Set<string>,
  siblingIds: Set<string> | null,
  errors: string[],
  path: string,
): void {
  if ("all" in condition) {
    condition.all.forEach((c, i) => validateCondition(c, topLevelIds, siblingIds, errors, `${path}.all[${i}]`));
    return;
  }
  if ("any" in condition) {
    condition.any.forEach((c, i) => validateCondition(c, topLevelIds, siblingIds, errors, `${path}.any[${i}]`));
    return;
  }

  if ("field" in condition) {
    const valid = topLevelIds.has(condition.field) || (siblingIds?.has(condition.field) ?? false);
    if (!valid) {
      errors.push(`${path}: references unknown field id "${condition.field}"`);
    }
    return;
  }

  // Context condition.
  if (condition.context !== "educationArrangement") return;
  const values = "equals" in condition ? [condition.equals] : "in" in condition ? condition.in : condition.notIn;
  for (const value of values) {
    if (!CANONICAL_ARRANGEMENT_IDS.has(value)) {
      errors.push(`${path}: non-canonical arrangement id "${value}"`);
    }
  }
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const errors = validateCatalog(dailyLogCatalog);
  if (errors.length > 0) {
    console.error(`daily-log-catalog: ${errors.length} validation error(s):`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  console.log("daily-log-catalog: valid.");
}
