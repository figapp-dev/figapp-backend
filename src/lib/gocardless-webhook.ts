/** agency_id we stamp on GC resources / events. */
export function agencyIdFromGcMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const value = (metadata as Record<string, unknown>).agency_id;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function gocardlessEventResourceId(event: {
  links?: {
    payment?: string | null;
    mandate?: string | null;
    subscription?: string | null;
    billing_request?: string | null;
    customer?: string | null;
  } | null;
}): string | null {
  const links = event.links;
  return (
    links?.payment ??
    links?.mandate ??
    links?.subscription ??
    links?.billing_request ??
    links?.customer ??
    null
  );
}
