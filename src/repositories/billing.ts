import type { SupabaseClient } from "@supabase/supabase-js";
import { TABLES } from "../lib/tables.js";
import type {
  AgencyBillingRow,
  AgencyUserBillingRow,
  BillingCustomerRow,
  BillingEventRow,
  BillingPaymentMethodRow,
  BillingSubscriptionRow,
  GlobalUserRoleRow,
  InvoiceRow,
  LicenceTypeRow,
  TenantLicenceRow,
} from "../types/billing.js";

const AGENCY_BILLING_SELECT = `
  id,
  name,
  contact_email,
  billing_email,
  address_line1,
  city,
  postal_code,
  country,
  billing_exempt,
  billing_status,
  setup_fee_selected,
  setup_fee_amount_gbp,
  setup_fee_discount_percent,
  billing_cycle_anchor,
  current_period_start,
  current_period_end,
  past_due_since,
  suspended_at,
  primary_admin_id
`;

export async function findAgencyUserByUserId(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ data: AgencyUserBillingRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.AGENCY_USERS)
    .select(
      "id, user_id, agency_id, email, first_name, last_name, role, is_active, is_archived",
    )
    .eq("user_id", userId)
    .eq("is_archived", false)
    .maybeSingle();

  return {
    data: (data as AgencyUserBillingRow | null) ?? null,
    error,
  };
}

export async function findGlobalUserRole(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ data: GlobalUserRoleRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.GLOBAL_USER_ROLES)
    .select("user_id, role, is_active, is_archived")
    .eq("user_id", userId)
    .eq("is_archived", false)
    .maybeSingle();

  return {
    data: (data as GlobalUserRoleRow | null) ?? null,
    error,
  };
}

const COLLECTABLE_BILLING_STATUSES = ["pending_setup", "active", "past_due"] as const;

/** Commercial agencies that may need a licence one-off (cron). RLS bypassed via service role. */
export async function listAgenciesForLicenceCollection(
  supabase: SupabaseClient,
): Promise<{ data: AgencyBillingRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.AGENCIES)
    .select(AGENCY_BILLING_SELECT)
    .eq("billing_exempt", false)
    .in("billing_status", [...COLLECTABLE_BILLING_STATUSES])
    .limit(500);

  return {
    data: (data as AgencyBillingRow[] | null) ?? [],
    error,
  };
}

export async function findAgencyBillingById(
  supabase: SupabaseClient,
  agencyId: string,
): Promise<{ data: AgencyBillingRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.AGENCIES)
    .select(AGENCY_BILLING_SELECT)
    .eq("id", agencyId)
    .maybeSingle();

  return {
    data: (data as AgencyBillingRow | null) ?? null,
    error,
  };
}

export async function listActiveLicenceTypes(
  supabase: SupabaseClient,
): Promise<{ data: LicenceTypeRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.LICENCE_TYPES)
    .select("code, name, price_monthly, price_additional, is_active")
    .eq("is_active", true);

  return {
    data: (data as LicenceTypeRow[] | null) ?? [],
    error,
  };
}

export async function listTenantLicences(
  supabase: SupabaseClient,
  agencyId: string,
): Promise<{ data: TenantLicenceRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.TENANT_LICENCES)
    .select("agency_id, licence_code, seats_purchased, seats_used")
    .eq("agency_id", agencyId);

  return {
    data: (data as TenantLicenceRow[] | null) ?? [],
    error,
  };
}

export async function findBillingCustomerByAgencyId(
  supabase: SupabaseClient,
  agencyId: string,
): Promise<{ data: BillingCustomerRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.BILLING_CUSTOMERS)
    .select("id, agency_id, gocardless_customer_id, billing_email")
    .eq("agency_id", agencyId)
    .maybeSingle();

  return {
    data: (data as BillingCustomerRow | null) ?? null,
    error,
  };
}

export async function findBillingCustomerByGcId(
  supabase: SupabaseClient,
  gocardlessCustomerId: string,
): Promise<{ data: BillingCustomerRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.BILLING_CUSTOMERS)
    .select("id, agency_id, gocardless_customer_id, billing_email")
    .eq("gocardless_customer_id", gocardlessCustomerId)
    .maybeSingle();

  return {
    data: (data as BillingCustomerRow | null) ?? null,
    error,
  };
}

export async function upsertBillingCustomer(
  supabase: SupabaseClient,
  row: {
    agency_id: string;
    gocardless_customer_id: string;
    billing_email: string | null;
  },
): Promise<{ data: BillingCustomerRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.BILLING_CUSTOMERS)
    .upsert(row, { onConflict: "agency_id" })
    .select("id, agency_id, gocardless_customer_id, billing_email")
    .maybeSingle();

  return {
    data: (data as BillingCustomerRow | null) ?? null,
    error,
  };
}

export async function listPaymentMethods(
  supabase: SupabaseClient,
  agencyId: string,
): Promise<{ data: BillingPaymentMethodRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.BILLING_PAYMENT_METHODS)
    .select(
      "id, agency_id, billing_customer_id, gocardless_mandate_id, status, scheme, bank_name, account_number_ending, is_default",
    )
    .eq("agency_id", agencyId)
    .order("created_at", { ascending: false });

  return {
    data: (data as BillingPaymentMethodRow[] | null) ?? [],
    error,
  };
}

export async function findPaymentMethodByMandateId(
  supabase: SupabaseClient,
  mandateId: string,
): Promise<{ data: BillingPaymentMethodRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.BILLING_PAYMENT_METHODS)
    .select(
      "id, agency_id, billing_customer_id, gocardless_mandate_id, status, scheme, bank_name, account_number_ending, is_default",
    )
    .eq("gocardless_mandate_id", mandateId)
    .maybeSingle();

  return {
    data: (data as BillingPaymentMethodRow | null) ?? null,
    error,
  };
}

export async function upsertPaymentMethod(
  supabase: SupabaseClient,
  row: {
    agency_id: string;
    billing_customer_id: string;
    gocardless_mandate_id: string;
    status: string;
    scheme: string;
    bank_name: string | null;
    account_number_ending: string | null;
    is_default: boolean;
  },
): Promise<{ data: BillingPaymentMethodRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.BILLING_PAYMENT_METHODS)
    .upsert(row, { onConflict: "gocardless_mandate_id" })
    .select(
      "id, agency_id, billing_customer_id, gocardless_mandate_id, status, scheme, bank_name, account_number_ending, is_default",
    )
    .maybeSingle();

  return {
    data: (data as BillingPaymentMethodRow | null) ?? null,
    error,
  };
}

export async function findSubscriptionByAgencyId(
  supabase: SupabaseClient,
  agencyId: string,
): Promise<{ data: BillingSubscriptionRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.BILLING_SUBSCRIPTIONS)
    .select(
      "id, agency_id, gocardless_subscription_id, gocardless_mandate_id, amount_pence, currency, interval_unit, status, name, start_date, upcoming_charge_date",
    )
    .eq("agency_id", agencyId)
    .not("status", "in", "(cancelled,finished)")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    data: (data as BillingSubscriptionRow | null) ?? null,
    error,
  };
}

export async function findSubscriptionByGcId(
  supabase: SupabaseClient,
  subscriptionId: string,
): Promise<{ data: BillingSubscriptionRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.BILLING_SUBSCRIPTIONS)
    .select(
      "id, agency_id, gocardless_subscription_id, gocardless_mandate_id, amount_pence, currency, interval_unit, status, name, start_date, upcoming_charge_date",
    )
    .eq("gocardless_subscription_id", subscriptionId)
    .maybeSingle();

  return {
    data: (data as BillingSubscriptionRow | null) ?? null,
    error,
  };
}

export async function upsertBillingSubscription(
  supabase: SupabaseClient,
  row: {
    agency_id: string;
    gocardless_subscription_id: string;
    gocardless_mandate_id: string | null;
    amount_pence: number;
    currency: string;
    interval_unit: string;
    status: string;
    name: string | null;
    start_date: string | null;
    upcoming_charge_date: string | null;
  },
): Promise<{ data: BillingSubscriptionRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.BILLING_SUBSCRIPTIONS)
    .upsert(row, { onConflict: "gocardless_subscription_id" })
    .select(
      "id, agency_id, gocardless_subscription_id, gocardless_mandate_id, amount_pence, currency, interval_unit, status, name, start_date, upcoming_charge_date",
    )
    .maybeSingle();

  return {
    data: (data as BillingSubscriptionRow | null) ?? null,
    error,
  };
}

export async function insertBillingEvent(
  supabase: SupabaseClient,
  row: {
    agency_id: string | null;
    provider: string;
    event_id: string;
    event_type: string;
    resource_type: string | null;
    resource_id: string | null;
    payload: unknown;
  },
): Promise<{
  data: BillingEventRow | null;
  error: Error | null;
  duplicate: boolean;
}> {
  const { data, error } = await supabase
    .from(TABLES.BILLING_EVENTS)
    .insert(row)
    .select(
      "id, agency_id, provider, event_id, event_type, resource_type, resource_id, payload, processed_at, processing_error",
    )
    .maybeSingle();

  if (error && error.code === "23505") {
    const existing = await findBillingEventByEventId(
      supabase,
      row.provider,
      row.event_id,
    );
    return {
      data: existing.data,
      error: existing.error,
      duplicate: true,
    };
  }

  return {
    data: (data as BillingEventRow | null) ?? null,
    error,
    duplicate: false,
  };
}

export async function findBillingEventByEventId(
  supabase: SupabaseClient,
  provider: string,
  eventId: string,
): Promise<{ data: BillingEventRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.BILLING_EVENTS)
    .select(
      "id, agency_id, provider, event_id, event_type, resource_type, resource_id, payload, processed_at, processing_error",
    )
    .eq("provider", provider)
    .eq("event_id", eventId)
    .maybeSingle();

  return {
    data: (data as BillingEventRow | null) ?? null,
    error,
  };
}

export async function markBillingEventProcessed(
  supabase: SupabaseClient,
  id: string,
  patch: {
    agency_id?: string | null;
    processed_at: string | null;
    processing_error: string | null;
  },
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from(TABLES.BILLING_EVENTS)
    .update(patch)
    .eq("id", id);

  return { error };
}

export async function updateAgencyBilling(
  supabase: SupabaseClient,
  agencyId: string,
  patch: Record<string, unknown>,
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from(TABLES.AGENCIES)
    .update(patch)
    .eq("id", agencyId);

  return { error };
}

export async function listInvoicesByAgency(
  supabase: SupabaseClient,
  agencyId: string,
): Promise<{ data: InvoiceRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.INVOICES)
    .select(
      "id, agency_id, gocardless_payment_id, gocardless_subscription_id, amount_total, amount_paid, currency, status, line_items, period_start, period_end",
    )
    .eq("agency_id", agencyId)
    .order("created_at", { ascending: false })
    .limit(50);

  return {
    data: (data as InvoiceRow[] | null) ?? [],
    error,
  };
}

export async function findInvoiceByGcPaymentId(
  supabase: SupabaseClient,
  paymentId: string,
): Promise<{ data: InvoiceRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.INVOICES)
    .select(
      "id, agency_id, gocardless_payment_id, gocardless_subscription_id, amount_total, amount_paid, currency, status, line_items, period_start, period_end",
    )
    .eq("gocardless_payment_id", paymentId)
    .maybeSingle();

  return {
    data: (data as InvoiceRow | null) ?? null,
    error,
  };
}

export async function insertInvoice(
  supabase: SupabaseClient,
  row: {
    agency_id: string;
    gocardless_payment_id: string | null;
    gocardless_subscription_id: string | null;
    amount_total: number;
    amount_paid: number;
    currency: string;
    status: string;
    line_items: unknown;
    period_start: string;
    period_end: string;
  },
): Promise<{ data: InvoiceRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.INVOICES)
    .insert(row)
    .select(
      "id, agency_id, gocardless_payment_id, gocardless_subscription_id, amount_total, amount_paid, currency, status, line_items, period_start, period_end",
    )
    .maybeSingle();

  return {
    data: (data as InvoiceRow | null) ?? null,
    error,
  };
}

export async function updateInvoice(
  supabase: SupabaseClient,
  id: string,
  patch: Record<string, unknown>,
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from(TABLES.INVOICES).update(patch).eq("id", id);
  return { error };
}
