import { env } from "../config/env.js";

export function isAllowedRedirectUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol === "https:") return true;
    if (
      !env.isProduction &&
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1")
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
