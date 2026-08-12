type ValidationIssue = {
  instancePath?: string;
  schemaPath?: string;
  keyword?: string;
  message?: string;
  params?: Record<string, unknown>;
};

function fieldPath(issue: ValidationIssue): string {
  const fromInstance = String(issue.instancePath ?? "")
    .replace(/^\//, "")
    .replace(/\//g, ".");
  if (fromInstance) return fromInstance;

  const missing = issue.params?.missingProperty;
  if (typeof missing === "string" && missing.trim()) return missing;

  return "request";
}

function formatAllowedValues(values: unknown): string | null {
  if (!Array.isArray(values) || values.length === 0) return null;
  return values.map((v) => String(v)).join(", ");
}

/** Turn Ajv/Fastify validation issues into short client-facing messages. */
export function formatValidationMessage(
  validation: unknown,
  fallback: string = "Request validation failed",
): string {
  if (!Array.isArray(validation) || validation.length === 0) {
    return fallback;
  }

  const issue = validation[0] as ValidationIssue;
  const field = fieldPath(issue);
  const keyword = issue.keyword ?? "";

  switch (keyword) {
    case "required":
      return `${field} is required`;
    case "enum": {
      const allowed = formatAllowedValues(issue.params?.allowedValues);
      return allowed
        ? `${field} must be one of: ${allowed}`
        : `${field} has an invalid value`;
    }
    case "type": {
      const type = issue.params?.type;
      if (typeof type !== "string") {
        return `${field} has an invalid type`;
      }
      const article = /^[aeiou]/i.test(type) ? "an" : "a";
      return `${field} must be ${article} ${type}`;
    }
    case "additionalProperties": {
      const extra = issue.params?.additionalProperty;
      return typeof extra === "string"
        ? `Unknown field: ${extra}`
        : "Unknown fields are not allowed";
    }
    case "minLength":
      return `${field} must not be empty`;
    case "minimum": {
      const limit = issue.params?.limit;
      return typeof limit === "number"
        ? `${field} must be at least ${limit}`
        : `${field} is too small`;
    }
    case "maximum": {
      const limit = issue.params?.limit;
      return typeof limit === "number"
        ? `${field} must be at most ${limit}`
        : `${field} is too large`;
    }
    case "pattern":
      return `${field} has an invalid format`;
    default:
      if (issue.message) {
        return field === "request"
          ? issue.message
          : `${field} ${issue.message}`;
      }
      return fallback;
  }
}
