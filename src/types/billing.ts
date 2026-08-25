import type {
  BillableLicenceCode,
  MoneyLineItem,
} from "../lib/billing-calculator.js";

export type AgencyBillingStatus =
  | "pending_setup"
  | "active"
  | "past_due"
  | "suspended"
  | "billing_exempt";

export type GlobalAdminRole = "super_admin" | "app_admin";

export type BillingAccessDto = {
  agencyId: string | null;
  billingExempt: boolean;
  billingStatus: AgencyBillingStatus;
  canUseApp: boolean;
  needsPaymentSetup: boolean;
};

export type BillingSummaryDto = {
  agencyId: string;
  agencyName: string;
  billingExempt: boolean;
  billingStatus: AgencyBillingStatus;
  mandateExists: boolean;
  mandateStatus: string | null;
  setupFeeSelected: boolean;
  lineItems: MoneyLineItem[];
  monthlyTotalPence: number;
  setupFeePence: number;
  dueNowPence: number;
  billingCycleAnchor: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
};

export type CreateBillingRequestBody = {
  successRedirectUrl: string;
  exitRedirectUrl?: string;
};

export type CreateBillingRequestDto = {
  billingRequestId: string;
  authorisationUrl: string;
  expiresAt: string | null;
};

export type BillingExemptionBody = {
  billingExempt: boolean;
  setupFeeSelected?: boolean;
  setupFeeAmountGbp?: number;
  setupFeeDiscountPercent?: number;
};

export type BillingExemptionDto = {
  agencyId: string;
  billingExempt: boolean;
  billingStatus: AgencyBillingStatus;
  setupFeeSelected: boolean;
  setupFeeAmountGbp: number;
  setupFeeDiscountPercent: number;
};

export type AgencyBillingRow = {
  id: string;
  name: string;
  contact_email: string;
  billing_email: string | null;
  address_line1: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
  billing_exempt: boolean;
  billing_status: AgencyBillingStatus;
  setup_fee_selected: boolean;
  setup_fee_amount_gbp: number | string;
  setup_fee_discount_percent: number | string;
  billing_cycle_anchor: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  past_due_since: string | null;
  suspended_at: string | null;
  primary_admin_id: string | null;
};

export type AgencyUserBillingRow = {
  id: string;
  user_id: string | null;
  agency_id: string | null;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  is_active: boolean | null;
  is_archived: boolean | null;
};

export type GlobalUserRoleRow = {
  user_id: string;
  role: GlobalAdminRole;
  is_active: boolean;
  is_archived: boolean;
};

export type LicenceTypeRow = {
  code: string;
  name: string;
  price_monthly: number | string;
  price_additional: number | string | null;
  is_active: boolean | null;
};

export type TenantLicenceRow = {
  agency_id: string | null;
  licence_code: string;
  seats_purchased: number | null;
  seats_used: number | null;
};

export type BillingCustomerRow = {
  id: string;
  agency_id: string;
  gocardless_customer_id: string;
  billing_email: string | null;
};

export type BillingPaymentMethodRow = {
  id: string;
  agency_id: string;
  billing_customer_id: string;
  gocardless_mandate_id: string;
  status: string;
  scheme: string;
  bank_name: string | null;
  account_number_ending: string | null;
  is_default: boolean;
};

export type BillingSubscriptionRow = {
  id: string;
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
};

export type BillingEventRow = {
  id: string;
  agency_id: string | null;
  provider: string;
  event_id: string;
  event_type: string;
  resource_type: string | null;
  resource_id: string | null;
  payload: unknown;
  processed_at: string | null;
  processing_error: string | null;
};

export type InvoiceRow = {
  id: string;
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
};

export type BillingCaller = {
  userId: string;
  agencyUser: AgencyUserBillingRow | null;
  isSuperAdmin: boolean;
  isPlatformAdmin: boolean;
};

export type CreateSeatChargeBody = {
  licenceCode: string;
  quantity?: number;
};

export type SeatChargeDto = {
  agencyId: string;
  licenceCode: string;
  quantity: number;
  seatsPurchased: number;
  amountPence: number;
  periodStart: string;
  periodEnd: string;
  gocardlessPaymentId: string | null;
};

export type CreateSeatReductionBody = {
  licenceCode: string;
  quantity?: number;
};

export type SeatReductionDto = {
  agencyId: string;
  licenceCode: string;
  quantity: number;
  seatsPurchased: number;
  seatsAfterReduction: number;
  effectiveAt: string;
};

export type { BillableLicenceCode, MoneyLineItem };
