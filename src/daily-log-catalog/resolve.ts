import type {
  CatalogEntry,
  ContextRefCondition,
  FieldCondition,
  FieldRefCondition,
  ResolveScope,
  SubstitutionTokens,
} from "./types.js";

function readRefValue(
  condition: FieldRefCondition | ContextRefCondition,
  scope: ResolveScope,
): unknown {
  if ("field" in condition) return scope.answers[condition.field];
  return scope.context?.[condition.context];
}

function isAnswered(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return value != null;
}

export function evaluateCondition(
  condition: FieldCondition,
  scope: ResolveScope,
): boolean {
  if ("all" in condition) {
    return condition.all.every((c) => evaluateCondition(c, scope));
  }
  if ("any" in condition) {
    return condition.any.some((c) => evaluateCondition(c, scope));
  }

  const value = readRefValue(condition, scope);

  if ("answered" in condition) return isAnswered(value) === condition.answered;
  if ("equals" in condition) return value === condition.equals;
  if ("in" in condition) {
    return typeof value === "string" && condition.in.includes(value);
  }
  return value == null || (typeof value === "string" && !condition.notIn.includes(value));
}

function substitute(text: string, tokens: SubstitutionTokens): string {
  return text
    .replaceAll("{they}", tokens.they)
    .replaceAll("{possessive}", tokens.possessive)
    .replaceAll("{wasWere}", tokens.wasWere)
    .replaceAll("{who}", tokens.who ?? "")
    .replaceAll("{type}", tokens.type ?? "");
}

export function resolveVisible(entry: CatalogEntry, scope: ResolveScope): boolean {
  if (!entry.visibleWhen) return true;
  return evaluateCondition(entry.visibleWhen, scope);
}

export function resolveQuestion(
  entry: CatalogEntry,
  scope: ResolveScope,
  tokens: SubstitutionTokens,
): string {
  for (const variant of entry.question.variants ?? []) {
    if (evaluateCondition(variant.when, scope)) {
      return substitute(variant.text, tokens);
    }
  }
  return substitute(entry.question.default, tokens);
}

export function resolveSuggestions(
  entry: CatalogEntry,
  scope: ResolveScope,
  tokens: SubstitutionTokens,
): string[] {
  for (const variant of entry.suggestions?.variants ?? []) {
    if (evaluateCondition(variant.when, scope)) {
      return variant.phrases.map((phrase) => substitute(phrase, tokens));
    }
  }
  return (entry.suggestions?.default ?? []).map((phrase) => substitute(phrase, tokens));
}

/** Row-scoped conditions (e.g. `type` on an appointment row) resolve
 * against the row merged over the parent log, row values taking precedence. */
export function mergeRowScope(
  parentAnswers: Record<string, unknown>,
  rowAnswers: Record<string, unknown>,
): Record<string, unknown> {
  return { ...parentAnswers, ...rowAnswers };
}
