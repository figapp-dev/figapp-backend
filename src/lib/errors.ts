import { ErrorMessages } from "../constants/error-messages.js";

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
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
export function conflict(message: string = ErrorMessages.CONFLICT) {
  return new AppError(409, "CONFLICT", message);
}
export function internalError(message: string = ErrorMessages.INTERNAL_ERROR) {
  return new AppError(500, "INTERNAL_ERROR", message);
}
