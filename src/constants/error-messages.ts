export const ErrorMessages = {
  UNAUTHORIZED: "Unauthorized",
  FORBIDDEN: "Forbidden",
  BAD_REQUEST: "Bad request",
  NOT_FOUND: "Not found",
  CONFLICT: "Conflict",
  INTERNAL_ERROR: "Internal server error",

  MISSING_AUTH_HEADER: "Missing or invalid Authorization header",
  MISSING_ACCESS_TOKEN: "Missing access token",
  INVALID_ACCESS_TOKEN: "Invalid or expired token",

  PROFILE_NOT_FOUND: "Profile not found",
  PROFILE_LOAD_FAILED: "Failed to load profile",
} as const;
