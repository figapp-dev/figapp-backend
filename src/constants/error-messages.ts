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

  CHILDREN_LOAD_FAILED: "Failed to load children",
  CHILD_NOT_FOUND: "Child not found",
  CHILD_LOAD_FAILED: "Failed to load child",
  PLACEMENTS_LOAD_FAILED: "Failed to load placements",

  DAILY_LOGS_LOAD_FAILED: "Failed to load daily logs",
  DAILY_LOG_NOT_FOUND: "Daily log not found",
  DAILY_LOG_LOAD_FAILED: "Failed to load daily log",
  DAILY_LOG_SAVE_FAILED: "Failed to save daily log",
  DAILY_LOG_INVALID_BODY: "dataJson must be an object",
  DAILY_LOG_INVALID_DATE: "date must be YYYY-MM-DD",
  DAILY_LOG_INVALID_STATUS: "status must be overdue",
  DAILY_LOG_NOT_EDITABLE: "This daily log can no longer be edited",
  DAILY_LOG_SUBMIT_EMPTY: "Cannot submit an empty daily log",
  DAILY_LOG_SUBMIT_INVALID: "Cannot submit: required fields are missing",
  DAILY_LOG_EXPECTED_UPDATED_AT_REQUIRED:
    "expectedUpdatedAt is required when the log already exists (use log.updatedAt from the last GET/PUT)",
  DAILY_LOG_CONFLICT:
    "Daily log was updated elsewhere. Reload and try again.",
  VALIDATION_ERROR: "Request validation failed",

  FILE_UPLOAD_FAILED: "Failed to create upload URL",
  FILE_SIGNED_URL_FAILED: "Failed to create signed URL",
  FILE_OBJECT_NOT_FOUND:
    "File not found in storage. Upload the file first, then request a download URL.",
  FILE_UPLOAD_BODY_REQUIRED:
    "resource, id, fieldId, and fileName are required",
  FILE_RESOURCE_NOT_SUPPORTED: "File resource not supported",
  FILE_PATH_REQUIRED: "bucket and path are required",
  FILE_BUCKET_NOT_ALLOWED: "Storage bucket not allowed",
  FILE_ACCESS_DENIED: "You cannot upload or access files for this resource",

  FIGCHAT_MESSAGE_INVALID_BODY: "content is required",
  FIGCHAT_MESSAGE_SEND_FAILED: "Failed to send message",
  FIGCHAT_ACCESS_DENIED: "You are not a participant in this conversation",
  FIGCHAT_BROADCAST_DELIVERY_BLOCKED:
    "This is a system delivery thread and can't receive messages directly.",
  FIGCHAT_BROADCAST_ADMIN_ONLY:
    "Only an agency admin can post in this broadcast conversation.",
  FIGCHAT_MARK_READ_FAILED: "Failed to mark conversation as read",

  LIFE_STORY_LOAD_FAILED: "Failed to load life story",
  LIFE_STORY_ADD_FAILED: "Failed to add life story entry",
  LIFE_STORY_INVALID_BODY:
    "section and media (path, name) are required",
  LIFE_STORY_ACCESS_DENIED:
    "This child is not currently placed with your household",

  CALENDAR_EVENTS_LOAD_FAILED: "Failed to load calendar events",
  CALENDAR_EVENT_NOT_FOUND: "Event not found",
  CALENDAR_EVENT_LOAD_FAILED: "Failed to load event",
  CALENDAR_EVENT_SAVE_FAILED: "Failed to save event",
  CALENDAR_EVENT_DELETE_FAILED: "Failed to delete event",
  CALENDAR_EVENT_INVALID_BODY:
    "title, eventType, startDatetime and endDatetime are required, and endDatetime must be after startDatetime",
  CALENDAR_EVENT_INVALID_RECURRENCE:
    "recurrencePattern is invalid, or its 'until' date is before startDatetime",
  CALENDAR_EVENT_INVALID_QUERY: "from and to must both be YYYY-MM-DD",
  CALENDAR_EVENT_ACCESS_DENIED:
    "Only the event's creator or an event admin can make this change",
  CALENDAR_NO_AGENCY: "You must belong to an agency to create events",
  CALENDAR_RSVP_FAILED: "Failed to update your RSVP",
  CALENDAR_RSVP_NOT_INVITED: "You are not a participant on this event",
  CALENDAR_ELIGIBLE_PARTICIPANTS_LOAD_FAILED:
    "Failed to load who you can invite",

  BILLING_ACCESS_LOAD_FAILED: "Failed to load billing access",
  BILLING_SUMMARY_LOAD_FAILED: "Failed to load billing summary",
  BILLING_REQUEST_FAILED: "Failed to start Direct Debit setup",
  BILLING_AGENCY_NOT_FOUND: "Agency not found",
  BILLING_FORBIDDEN: "Only the primary agency admin can manage billing",
  BILLING_EXEMPT: "This agency is billing-exempt and does not use GoCardless",
  BILLING_MANDATE_EXISTS: "Direct Debit is already set up for this agency",
  BILLING_REDIRECT_URL_INVALID:
    "successRedirectUrl must be an absolute https URL (http://localhost allowed in development)",
  BILLING_GOCARDLESS_NOT_CONFIGURED: "GoCardless is not configured",
  BILLING_WEBHOOK_INVALID_SIGNATURE: "Invalid GoCardless webhook signature",
  BILLING_WEBHOOK_INVALID_BODY: "Invalid GoCardless webhook body",
  BILLING_WEBHOOK_FAILED: "Failed to process GoCardless webhook",
  BILLING_PRICES_MISSING: "Licence prices are not configured for the starter pack",
  BILLING_EXEMPTION_FAILED: "Failed to update agency billing type",
  BILLING_EXEMPTION_FORBIDDEN:
    "Only a platform admin can change demo vs commercial billing",
  BILLING_CRON_NOT_CONFIGURED: "Billing cron secret is not configured",
  BILLING_CRON_UNAUTHORIZED: "Invalid billing cron secret",
  BILLING_COLLECT_FAILED: "Failed to collect due licence payments",
  BILLING_SEAT_CHARGE_FAILED: "Failed to charge extra licence seats",
  BILLING_SEAT_REDUCE_FAILED: "Failed to schedule this licence reduction",
  BILLING_SEAT_NO_PERIOD:
    "Cannot add seats until the first Direct Debit has confirmed and a billing period exists",
  BILLING_SEAT_NO_MANDATE: "Set up Direct Debit before buying extra seats",
  BILLING_SEAT_EXEMPT: "Exempt agencies do not buy extra seats via GoCardless",
} as const;
