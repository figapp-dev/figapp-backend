export const STORAGE_BUCKETS = {
  DAILY_LOGS: "daily-logs",
  FIGCHAT: "figchat",
  LIFE_STORY: "life_story",
  DOCUMENTS: "documents",
} as const;

export type StorageBucket =
  (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];

/** Default signed download URL lifetime (1 hour). */
export const DEFAULT_SIGNED_URL_EXPIRES_SECONDS = 60 * 60;

const ALLOWED_BUCKETS = new Set<string>([
  STORAGE_BUCKETS.DAILY_LOGS,
  STORAGE_BUCKETS.FIGCHAT,
  STORAGE_BUCKETS.LIFE_STORY,
  STORAGE_BUCKETS.DOCUMENTS,
]);

export function isAllowedStorageBucket(bucket: string): bucket is StorageBucket {
  return ALLOWED_BUCKETS.has(bucket);
}
