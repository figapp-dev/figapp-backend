/**
 * Shared service result helpers.
 * Prefer these over ad-hoc saveFail copies; set only the flags that apply.
 */
export type ServiceFailureFlags = {
  error?: Error | null;
  notFound?: boolean;
  forbidden?: boolean;
  badRequest?: boolean;
  conflict?: boolean;
  notEditable?: boolean;
  submitEmpty?: boolean;
  validationFailed?: boolean;
  unsupported?: boolean;
  /** Log exists but PUT omitted expectedUpdatedAt. */
  missingLock?: boolean;
  missingFieldIds?: string[];
  /** Present on optimistic-lock conflicts / missing lock. */
  currentUpdatedAt?: string | null;
};

export type ServiceFailureResult = {
  data: null;
  error: Error | null;
  notFound: boolean;
  forbidden: boolean;
  badRequest: boolean;
  conflict: boolean;
  notEditable: boolean;
  submitEmpty: boolean;
  validationFailed: boolean;
  unsupported: boolean;
  missingLock: boolean;
  missingFieldIds: string[];
  currentUpdatedAt: string | null;
};

export function serviceFailure(
  flags: ServiceFailureFlags = {},
): ServiceFailureResult {
  return {
    data: null,
    error: flags.error ?? null,
    notFound: flags.notFound ?? false,
    forbidden: flags.forbidden ?? false,
    badRequest: flags.badRequest ?? false,
    conflict: flags.conflict ?? false,
    notEditable: flags.notEditable ?? false,
    submitEmpty: flags.submitEmpty ?? false,
    validationFailed: flags.validationFailed ?? false,
    unsupported: flags.unsupported ?? false,
    missingLock: flags.missingLock ?? false,
    missingFieldIds: flags.missingFieldIds ?? [],
    currentUpdatedAt: flags.currentUpdatedAt ?? null,
  };
}

export function serviceSuccess<T>(data: T): {
  data: T;
  error: null;
  notFound: false;
  forbidden: false;
  badRequest: false;
  conflict: false;
  notEditable: false;
  submitEmpty: false;
  validationFailed: false;
  unsupported: false;
  missingLock: false;
  missingFieldIds: [];
  currentUpdatedAt: null;
} {
  return {
    data,
    error: null,
    notFound: false,
    forbidden: false,
    badRequest: false,
    conflict: false,
    notEditable: false,
    submitEmpty: false,
    validationFailed: false,
    unsupported: false,
    missingLock: false,
    missingFieldIds: [],
    currentUpdatedAt: null,
  };
}
