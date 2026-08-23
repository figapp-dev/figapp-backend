import gocardless, {
  Environments,
  IdempotentCreationConflictError,
  type GoCardlessClient,
} from "gocardless-nodejs";
import { env } from "../config/env.js";

let cached: GoCardlessClient | null = null;
let cachedToken = "";
let cachedEnv: typeof env.gocardlessEnv | "" = "";

export function getGoCardlessClient(): GoCardlessClient {
  if (!env.gocardlessAccessToken) {
    throw new Error("GOCARDLESS_ACCESS_TOKEN is not configured");
  }

  if (
    cached &&
    cachedToken === env.gocardlessAccessToken &&
    cachedEnv === env.gocardlessEnv
  ) {
    return cached;
  }

  cached = gocardless(
    env.gocardlessAccessToken,
    env.gocardlessEnv === "live" ? Environments.Live : Environments.Sandbox,
    { raiseOnIdempotencyConflict: true },
  );
  cachedToken = env.gocardlessAccessToken;
  cachedEnv = env.gocardlessEnv;
  return cached;
}

export function penceToGcAmount(pence: number): string {
  return String(Math.round(pence));
}

export function gcAmountToPence(amount: string | number | undefined): number {
  if (amount == null) return 0;
  const n = typeof amount === "number" ? amount : Number(amount);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

export const GC_CURRENCY = "GBP";
export const GC_SCHEME = "bacs";
export const GC_PROVIDER = "gocardless";
export const GC_LICENCE_PAYMENT_NAME = "FigApp licences";
/** @deprecated Use GC_LICENCE_PAYMENT_NAME. Kept for leftover GC subscription webhooks. */
export const GC_SUBSCRIPTION_NAME = GC_LICENCE_PAYMENT_NAME;

/**
 * If the conflicting GoCardless resource was deleted (sandbox reset),
 * `findById` throws. Caller should then create with a new idempotency key.
 */
export async function createOrFindOnIdempotencyConflict<T>(
  create: () => Promise<T>,
  findById: (id: string) => Promise<T>,
): Promise<T> {
  try {
    return await create();
  } catch (error) {
    if (
      error instanceof IdempotentCreationConflictError &&
      error.conflictingResourceId
    ) {
      try {
        return await findById(error.conflictingResourceId);
      } catch {
        throw error;
      }
    }
    throw error;
  }
}
