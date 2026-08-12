import { ErrorMessages } from "../constants/error-messages.js";

export type AppErrorDetails = {
  missingFieldIds?: string[];
  currentUpdatedAt?: string | null;
};

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details: AppErrorDetails;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details: AppErrorDetails = {},
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function unauthorized(message: string = ErrorMessages.UNAUTHORIZED) {
  return new AppError(401, "UNAUTHORIZED", message);
}
export function forbidden(message: string = ErrorMessages.FORBIDDEN) {
  return new AppError(403, "FORBIDDEN", message);
}
export function badRequest(message: string = ErrorMessages.BAD_REQUEST) {
  return new AppError(400, "BAD_REQUEST", message);
}
export function notFound(message: string = ErrorMessages.NOT_FOUND) {
  return new AppError(404, "NOT_FOUND", message);
}
export function conflict(
  message: string = ErrorMessages.CONFLICT,
  details: AppErrorDetails = {},
) {
  return new AppError(409, "CONFLICT", message, details);
}
export function internalError(message: string = ErrorMessages.INTERNAL_ERROR) {
  return new AppError(500, "INTERNAL_ERROR", message);
}

export function validationFailed(
  message: string,
  missingFieldIds: string[],
) {
  return new AppError(400, "VALIDATION_FAILED", message, { missingFieldIds });
}

export function expectedUpdatedAtRequired(
  message: string,
  currentUpdatedAt: string | null | undefined,
) {
  return new AppError(400, "EXPECTED_UPDATED_AT_REQUIRED", message, {
    currentUpdatedAt: currentUpdatedAt ?? null,
  });
}
