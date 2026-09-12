import type { FastifyInstance } from "fastify";

const nullableString = { type: "string", nullable: true } as const;
const nullableBoolean = { type: "boolean", nullable: true } as const;

/** Shared OpenAPI / Fastify JSON Schema components ($id) for Swagger + route responses. */
export function registerOpenApiSchemas(app: FastifyInstance) {
  app.addSchema({
    $id: "ErrorResponse",
    type: "object",
    required: ["statusCode", "code", "message"],
    description:
      "Stable error envelope. `code` values: VALIDATION_ERROR (JSON schema), " +
      "VALIDATION_FAILED (submit missing fields + missingFieldIds), " +
      "EXPECTED_UPDATED_AT_REQUIRED (+ currentUpdatedAt), CONFLICT (+ currentUpdatedAt), " +
      "BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, INTERNAL_ERROR.",
    properties: {
      statusCode: { type: "integer" },
      code: { type: "string" },
      message: { type: "string" },
      missingFieldIds: { type: "array", items: { type: "string" } },
      currentUpdatedAt: nullableString,
    },
  });

  app.addSchema({
    $id: "HealthResponse",
    type: "object",
    required: ["status", "service", "timestamp"],
    properties: {
      status: { type: "string", enum: ["ok"] },
      service: { type: "string" },
      timestamp: { type: "string", format: "date-time" },
    },
  });

  app.addSchema({
    $id: "AgencyDto",
    type: "object",
    required: ["id", "name"],
    properties: {
      id: { type: "string" },
      name: { type: "string" },
    },
  });

  app.addSchema({
    $id: "HouseholdDto",
    type: "object",
    required: ["id", "name"],
    properties: {
      id: { type: "string" },
      name: { type: "string" },
      addressLine1: nullableString,
      addressLine2: nullableString,
      city: nullableString,
      postalCode: nullableString,
      country: nullableString,
    },
  });

  app.addSchema({
    $id: "ProfileDto",
    type: "object",
    required: ["id", "agencyUserId", "email", "role"],
    properties: {
      id: {
        type: "string",
        description: "Auth user id (Supabase auth.users)",
      },
      agencyUserId: {
        type: "string",
        description: "agency_users.id — use for agency-scoped FKs",
      },
      email: { type: "string" },
      firstName: nullableString,
      lastName: nullableString,
      preferredName: nullableString,
      phone: nullableString,
      role: { type: "string" },
      position: nullableString,
      jobTitle: nullableString,
      dateOfBirth: nullableString,
      gender: nullableString,
      figappId: nullableString,
      status: nullableString,
      isActive: nullableBoolean,
      agency: { anyOf: [{ $ref: "AgencyDto#" }, { type: "null" }] },
      household: { anyOf: [{ $ref: "HouseholdDto#" }, { type: "null" }] },
    },
  });

  app.addSchema({
    $id: "ChildListItemDto",
    type: "object",
    required: [
      "kind",
      "id",
      "displayName",
      "isParentChildPlacement",
      "isPlaced",
    ],
    properties: {
      kind: { type: "string", enum: ["child"] },
      id: { type: "string" },
      figappId: nullableString,
      status: nullableString,
      displayName: { type: "string" },
      legalName: nullableString,
      preferredName: nullableString,
      firstName: nullableString,
      middleName: nullableString,
      lastName: nullableString,
      dateOfBirth: nullableString,
      genderIdentity: nullableString,
      genderIdentityDescription: nullableString,
      pronouns: nullableString,
      isParentChildPlacement: { type: "boolean" },
      placedSince: nullableString,
      isPlaced: { type: "boolean" },
    },
  });

  app.addSchema({
    $id: "PlacedParentListItemDto",
    type: "object",
    required: [
      "kind",
      "id",
      "displayName",
      "badge",
      "childId",
      "isPlaced",
    ],
    properties: {
      kind: { type: "string", enum: ["placed_parent"] },
      id: { type: "string" },
      displayName: { type: "string" },
      figappId: nullableString,
      dateOfBirth: nullableString,
      relationship: nullableString,
      badge: { type: "string", enum: ["Parent Child"] },
      childId: { type: "string" },
      placedSince: nullableString,
      isPlaced: { type: "boolean" },
    },
  });

  app.addSchema({
    $id: "ChildrenListDto",
    type: "object",
    required: ["items"],
    properties: {
      items: {
        type: "array",
        items: {
          anyOf: [
            { $ref: "ChildListItemDto#" },
            { $ref: "PlacedParentListItemDto#" },
          ],
        },
      },
    },
  });

  app.addSchema({
    $id: "AllergyDto",
    type: "object",
    required: ["id", "allergy"],
    properties: {
      id: { type: "string" },
      allergy: { type: "string" },
    },
  });

  app.addSchema({
    $id: "MedicalConditionDto",
    type: "object",
    required: ["id", "condition"],
    properties: {
      id: { type: "string" },
      condition: { type: "string" },
    },
  });

  app.addSchema({
    $id: "ContactDto",
    type: "object",
    required: ["id"],
    properties: {
      id: { type: "string" },
      name: nullableString,
      phone: nullableString,
      email: nullableString,
      relationship: nullableString,
    },
  });

  app.addSchema({
    $id: "PlacementHouseholdDto",
    type: "object",
    required: ["id"],
    properties: {
      id: { type: "string" },
      name: nullableString,
      addressLine1: nullableString,
      addressLine2: nullableString,
      city: nullableString,
      postalCode: nullableString,
      country: nullableString,
    },
  });

  app.addSchema({
    $id: "CurrentPlacementDto",
    type: "object",
    required: ["id"],
    properties: {
      id: { type: "string" },
      startDate: nullableString,
      endDate: nullableString,
      household: {
        anyOf: [{ $ref: "PlacementHouseholdDto#" }, { type: "null" }],
      },
    },
  });

  app.addSchema({
    $id: "LinkedChildSummaryDto",
    type: "object",
    required: ["id", "displayName"],
    properties: {
      id: { type: "string" },
      displayName: { type: "string" },
      figappId: nullableString,
    },
  });

  app.addSchema({
    $id: "ChildDetailDto",
    type: "object",
    required: [
      "kind",
      "id",
      "displayName",
      "isParentChildPlacement",
      "allergies",
      "medicalConditions",
      "emergencyContacts",
      "professionalContacts",
    ],
    properties: {
      kind: { type: "string", enum: ["child"] },
      id: { type: "string" },
      figappId: nullableString,
      status: nullableString,
      displayName: { type: "string" },
      legalName: nullableString,
      preferredName: nullableString,
      firstName: nullableString,
      middleName: nullableString,
      lastName: nullableString,
      dateOfBirth: nullableString,
      genderIdentity: nullableString,
      genderIdentityDescription: nullableString,
      pronouns: nullableString,
      isParentChildPlacement: { type: "boolean" },
      allergies: { type: "array", items: { $ref: "AllergyDto#" } },
      medicalConditions: {
        type: "array",
        items: { $ref: "MedicalConditionDto#" },
      },
      emergencyContacts: { type: "array", items: { $ref: "ContactDto#" } },
      professionalContacts: {
        type: "array",
        items: { $ref: "ContactDto#" },
      },
      currentPlacement: {
        anyOf: [{ $ref: "CurrentPlacementDto#" }, { type: "null" }],
      },
      educationArrangement: nullableString,
    },
  });

  app.addSchema({
    $id: "PlacedParentDetailDto",
    type: "object",
    required: ["kind", "id", "displayName", "badge", "childId"],
    properties: {
      kind: { type: "string", enum: ["placed_parent"] },
      id: { type: "string" },
      displayName: { type: "string" },
      figappId: nullableString,
      dateOfBirth: nullableString,
      relationship: nullableString,
      phone: nullableString,
      email: nullableString,
      badge: { type: "string", enum: ["Parent Child"] },
      childId: { type: "string" },
      linkedChild: {
        anyOf: [{ $ref: "LinkedChildSummaryDto#" }, { type: "null" }],
      },
      currentPlacement: {
        anyOf: [{ $ref: "CurrentPlacementDto#" }, { type: "null" }],
      },
    },
  });

  app.addSchema({
    $id: "ChildrenDetailDto",
    anyOf: [{ $ref: "ChildDetailDto#" }, { $ref: "PlacedParentDetailDto#" }],
  });

  app.addSchema({
    $id: "PlacementHistoryItemDto",
    type: "object",
    required: ["id", "isActive"],
    properties: {
      id: { type: "string" },
      startDate: nullableString,
      endDate: nullableString,
      isActive: { type: "boolean" },
      status: {
        anyOf: [
          { type: "string", enum: ["Active", "Scheduled", "Ended"] },
          { type: "null" },
        ],
      },
      childId: nullableString,
      household: {
        anyOf: [{ $ref: "PlacementHouseholdDto#" }, { type: "null" }],
      },
    },
  });

  app.addSchema({
    $id: "PlacementsDto",
    type: "object",
    required: ["kind", "id", "items"],
    properties: {
      kind: { type: "string", enum: ["child", "placed_parent"] },
      id: { type: "string" },
      items: { type: "array", items: { $ref: "PlacementHistoryItemDto#" } },
    },
  });

  app.addSchema({
    $id: "DailyLogListItemDto",
    type: "object",
    required: ["id", "assignedDate", "status", "canEdit", "isOverdue"],
    properties: {
      id: { type: "string", description: "Assignment id" },
      assignedDate: { type: "string" },
      status: { type: "string" },
      assignmentStatus: nullableString,
      assignmentSubject: { type: "string" },
      childId: nullableString,
      biologicalParentId: nullableString,
      householdId: nullableString,
      dueTime: nullableString,
      completedAt: nullableString,
      subjectName: nullableString,
      canEdit: { type: "boolean" },
      isOverdue: { type: "boolean" },
      template: {
        anyOf: [
          {
            type: "object",
            required: ["id", "name"],
            properties: {
              id: { type: "string" },
              name: { type: "string" },
            },
          },
          { type: "null" },
        ],
      },
      log: {
        anyOf: [
          {
            type: "object",
            required: ["id"],
            properties: {
              id: { type: "string" },
              status: nullableString,
            },
          },
          { type: "null" },
        ],
      },
    },
  });

  app.addSchema({
    $id: "DailyLogsListDto",
    type: "object",
    required: ["items"],
    properties: {
      items: { type: "array", items: { $ref: "DailyLogListItemDto#" } },
    },
  });

  app.addSchema({
    $id: "DailyLogContributorDto",
    type: "object",
    required: ["id", "contributorId", "displayName", "lastEditAt"],
    properties: {
      id: { type: "string" },
      contributorId: { type: "string" },
      displayName: { type: "string" },
      contributedAt: nullableString,
      lastEditAt: { type: "string" },
    },
  });

  app.addSchema({
    $id: "DailyLogDetailLogDto",
    type: "object",
    required: ["id", "dataJson", "isSensitive"],
    properties: {
      id: { type: "string" },
      status: nullableString,
      date: nullableString,
      dataJson: { type: "object", additionalProperties: true },
      isSensitive: { type: "boolean" },
      childId: nullableString,
      biologicalParentId: nullableString,
      updatedAt: {
        ...nullableString,
        description: "Send as expectedUpdatedAt on later PUTs",
      },
    },
  });

  app.addSchema({
    $id: "DailyLogDetailDto",
    type: "object",
    required: [
      "id",
      "assignedDate",
      "status",
      "canEdit",
      "isOverdue",
      "contributors",
    ],
    properties: {
      id: { type: "string", description: "Assignment id" },
      assignedDate: { type: "string" },
      status: { type: "string" },
      assignmentStatus: nullableString,
      assignmentSubject: { type: "string" },
      childId: nullableString,
      biologicalParentId: nullableString,
      householdId: nullableString,
      dueTime: nullableString,
      completedAt: nullableString,
      subjectName: nullableString,
      educationArrangement: nullableString,
      canEdit: { type: "boolean" },
      isOverdue: { type: "boolean" },
      template: {
        anyOf: [
          {
            type: "object",
            required: ["id", "name", "templateFields"],
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              templateFields: {
                type: "array",
                description:
                  "Agency form structure: sections with nested fields (same shape as web template_fields)",
                items: {
                  type: "object",
                  additionalProperties: true,
                  properties: {
                    id: { type: "string" },
                    title: { type: "string" },
                    fields: {
                      type: "array",
                      items: {
                        type: "object",
                        additionalProperties: true,
                        properties: {
                          id: { type: "string" },
                          label: { type: "string" },
                          type: { type: "string" },
                          required: { type: "boolean" },
                          isRequired: { type: "boolean" },
                          meta: {
                            type: "object",
                            additionalProperties: true,
                            properties: {
                              group: { type: "string" },
                              role: { type: "string" },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          { type: "null" },
        ],
      },
      log: {
        anyOf: [{ $ref: "DailyLogDetailLogDto#" }, { type: "null" }],
      },
      contributors: {
        type: "array",
        items: { $ref: "DailyLogContributorDto#" },
      },
    },
  });

  app.addSchema({
    $id: "CreateFileUploadDto",
    type: "object",
    required: [
      "resource",
      "id",
      "bucket",
      "path",
      "token",
      "signedUrl",
      "fileName",
    ],
    properties: {
      resource: { type: "string", enum: ["daily_log"] },
      id: { type: "string" },
      bucket: { type: "string" },
      path: { type: "string" },
      token: { type: "string" },
      signedUrl: { type: "string" },
      fileName: { type: "string" },
    },
  });

  app.addSchema({
    $id: "SignedUrlDto",
    type: "object",
    required: ["bucket", "path", "signedUrl", "expiresIn"],
    properties: {
      bucket: { type: "string" },
      path: { type: "string" },
      signedUrl: { type: "string" },
      expiresIn: { type: "integer" },
    },
  });

  app.addSchema({
    $id: "BillingMoneyLineItemDto",
    type: "object",
    required: ["code", "label", "quantity", "unitAmountPence", "amountPence"],
    properties: {
      code: { type: "string" },
      label: { type: "string" },
      quantity: { type: "integer" },
      unitAmountPence: { type: "integer" },
      amountPence: { type: "integer" },
    },
  });

  app.addSchema({
    $id: "BillingAccessDto",
    type: "object",
    required: [
      "agencyId",
      "billingExempt",
      "billingStatus",
      "canUseApp",
      "needsPaymentSetup",
    ],
    properties: {
      agencyId: { type: "string", nullable: true },
      billingExempt: { type: "boolean" },
      billingStatus: {
        type: "string",
        enum: [
          "pending_setup",
          "active",
          "past_due",
          "suspended",
          "billing_exempt",
        ],
      },
      canUseApp: { type: "boolean" },
      needsPaymentSetup: { type: "boolean" },
    },
  });

  app.addSchema({
    $id: "BillingSummaryDto",
    type: "object",
    required: [
      "agencyId",
      "agencyName",
      "billingExempt",
      "billingStatus",
      "mandateExists",
      "mandateStatus",
      "setupFeeSelected",
      "lineItems",
      "monthlyTotalPence",
      "setupFeePence",
      "dueNowPence",
      "billingCycleAnchor",
      "currentPeriodStart",
      "currentPeriodEnd",
    ],
    properties: {
      agencyId: { type: "string" },
      agencyName: { type: "string" },
      billingExempt: { type: "boolean" },
      billingStatus: {
        type: "string",
        enum: [
          "pending_setup",
          "active",
          "past_due",
          "suspended",
          "billing_exempt",
        ],
      },
      mandateExists: { type: "boolean" },
      mandateStatus: nullableString,
      setupFeeSelected: { type: "boolean" },
      lineItems: {
        type: "array",
        items: { $ref: "BillingMoneyLineItemDto#" },
      },
      monthlyTotalPence: { type: "integer" },
      setupFeePence: { type: "integer" },
      dueNowPence: { type: "integer" },
      billingCycleAnchor: nullableString,
      currentPeriodStart: nullableString,
      currentPeriodEnd: nullableString,
    },
  });

  app.addSchema({
    $id: "CreateBillingRequestDto",
    type: "object",
    required: ["billingRequestId", "authorisationUrl", "expiresAt"],
    properties: {
      billingRequestId: { type: "string" },
      authorisationUrl: { type: "string" },
      expiresAt: nullableString,
    },
  });

  app.addSchema({
    $id: "BillingExemptionDto",
    type: "object",
    required: [
      "agencyId",
      "billingExempt",
      "billingStatus",
      "setupFeeSelected",
      "setupFeeAmountGbp",
      "setupFeeDiscountPercent",
    ],
    properties: {
      agencyId: { type: "string" },
      billingExempt: { type: "boolean" },
      billingStatus: {
        type: "string",
        enum: [
          "pending_setup",
          "active",
          "past_due",
          "suspended",
          "billing_exempt",
        ],
      },
      setupFeeSelected: { type: "boolean" },
      setupFeeAmountGbp: { type: "number" },
      setupFeeDiscountPercent: { type: "number" },
    },
  });

  app.addSchema({
    $id: "GoCardlessWebhookAckDto",
    type: "object",
    required: ["received"],
    properties: {
      received: { type: "boolean" },
    },
  });

  app.addSchema({
    $id: "BillingCollectDto",
    type: "object",
    required: [
      "agenciesConsidered",
      "paymentsCreated",
      "skipped",
      "noticesSent",
      "agenciesSuspended",
      "reductionsApplied",
      "errors",
    ],
    properties: {
      agenciesConsidered: { type: "integer" },
      paymentsCreated: { type: "integer" },
      skipped: { type: "integer" },
      noticesSent: { type: "integer" },
      agenciesSuspended: { type: "integer" },
      reductionsApplied: { type: "integer" },
      errors: {
        type: "array",
        items: {
          type: "object",
          required: ["agencyId", "message"],
          properties: {
            agencyId: { type: "string" },
            message: { type: "string" },
          },
        },
      },
    },
  });

  app.addSchema({
    $id: "SeatChargeDto",
    type: "object",
    required: [
      "agencyId",
      "licenceCode",
      "quantity",
      "seatsPurchased",
      "amountPence",
      "periodStart",
      "periodEnd",
      "gocardlessPaymentId",
    ],
    properties: {
      agencyId: { type: "string" },
      licenceCode: { type: "string" },
      quantity: { type: "integer" },
      seatsPurchased: { type: "integer" },
      amountPence: { type: "integer" },
      periodStart: { type: "string" },
      periodEnd: { type: "string" },
      gocardlessPaymentId: nullableString,
    },
  });

  app.addSchema({
    $id: "SeatReductionDto",
    type: "object",
    required: [
      "agencyId",
      "licenceCode",
      "quantity",
      "seatsPurchased",
      "seatsAfterReduction",
      "effectiveAt",
    ],
    properties: {
      agencyId: { type: "string" },
      licenceCode: { type: "string" },
      quantity: { type: "integer" },
      seatsPurchased: { type: "integer" },
      seatsAfterReduction: { type: "integer" },
      effectiveAt: { type: "string" },
    },
  });

  app.addSchema({
    $id: "FigChatMessageDto",
    type: "object",
    required: ["id", "conversationId"],
    properties: {
      id: { type: "string" },
      conversationId: { type: "string" },
      senderId: nullableString,
      content: nullableString,
      createdAt: nullableString,
      updatedAt: nullableString,
      attachmentUrl: nullableString,
      attachmentType: nullableString,
      attachmentName: nullableString,
      attachmentSize: { type: "number", nullable: true },
    },
  });

  app.addSchema({
    $id: "LifeStoryEntryDto",
    type: "object",
    required: [
      "id",
      "section",
      "sectionLabel",
      "notes",
      "mediaPath",
      "mediaType",
      "mediaName",
      "createdAt",
      "createdBy",
    ],
    properties: {
      id: { type: "string" },
      section: {
        type: "string",
        enum: ["leisure_fun", "academic_achievements", "other_achievements"],
      },
      sectionLabel: { type: "string" },
      notes: { type: "string" },
      mediaPath: nullableString,
      mediaType: { type: "string", enum: ["photo", "video", "file"] },
      mediaName: nullableString,
      createdAt: { type: "string" },
      createdBy: { type: "string" },
    },
  });

  app.addSchema({
    $id: "LifeStoryListDto",
    type: "object",
    required: ["childId", "entries"],
    properties: {
      childId: { type: "string" },
      entries: {
        type: "array",
        items: { $ref: "LifeStoryEntryDto#" },
      },
    },
  });

  const eventTypeEnum = [
    "meeting",
    "visit",
    "appointment",
    "training",
    "court",
    "activity",
    "other",
  ];

  app.addSchema({
    $id: "CalendarParticipantSummaryDto",
    type: "object",
    required: ["total", "accepted", "pending", "declined", "tentative"],
    properties: {
      total: { type: "integer" },
      accepted: { type: "integer" },
      pending: { type: "integer" },
      declined: { type: "integer" },
      tentative: { type: "integer" },
    },
  });

  app.addSchema({
    $id: "CalendarEventParticipantDto",
    type: "object",
    required: ["id", "userId", "status", "role", "isAdmin"],
    properties: {
      id: { type: "string" },
      userId: { type: "string" },
      status: {
        type: "string",
        enum: ["pending", "accepted", "declined", "tentative"],
      },
      role: { type: "string", enum: ["organizer", "attendee", "optional"] },
      responseAt: nullableString,
      notes: nullableString,
      isAdmin: { type: "boolean" },
      displayName: nullableString,
      figappId: nullableString,
      profileRole: nullableString,
    },
  });

  app.addSchema({
    $id: "CalendarEventReminderDto",
    type: "object",
    required: ["id", "offsetNumber", "offsetUnit"],
    properties: {
      id: { type: "string" },
      offsetNumber: { type: "integer" },
      offsetUnit: { type: "string", enum: ["minutes", "hours", "days"] },
      label: nullableString,
    },
  });

  const recurrenceEndDto = {
    type: "object",
    required: ["type"],
    properties: {
      type: { type: "string", enum: ["never", "after", "until"] },
      count: { type: "integer" },
      until: { type: "string" },
    },
  } as const;

  const recurrencePatternDto = {
    type: "object",
    nullable: true,
    required: ["repeat"],
    properties: {
      repeat: {
        type: "object",
        required: ["every", "unit", "end"],
        properties: {
          every: { type: "integer" },
          unit: { type: "string", enum: ["days", "weeks", "months", "years"] },
          end: recurrenceEndDto,
        },
      },
    },
  } as const;

  const calendarEventListItemProperties = {
    id: { type: "string" },
    title: { type: "string" },
    eventType: { type: "string", enum: eventTypeEnum },
    startDatetime: { type: "string" },
    endDatetime: { type: "string" },
    location: nullableString,
    isRecurring: { type: "boolean" },
    seriesId: nullableString,
    occurrenceIndex: { type: "integer" },
    taggedChildIds: { type: "array", items: { type: "string" } },
    createdBy: nullableString,
    isOwnEvent: { type: "boolean" },
    participantSummary: { $ref: "CalendarParticipantSummaryDto#" },
  } as const;

  const calendarEventListItemRequired = [
    "id",
    "title",
    "eventType",
    "startDatetime",
    "endDatetime",
    "location",
    "isRecurring",
    "seriesId",
    "occurrenceIndex",
    "taggedChildIds",
    "createdBy",
    "isOwnEvent",
    "participantSummary",
  ];

  app.addSchema({
    $id: "CalendarEventListItemDto",
    type: "object",
    required: calendarEventListItemRequired,
    properties: calendarEventListItemProperties,
  });

  app.addSchema({
    $id: "CalendarEventDetailDto",
    type: "object",
    required: [
      ...calendarEventListItemRequired,
      "description",
      "recurrencePattern",
      "isSeriesException",
      "participants",
      "reminders",
      "canEdit",
      "canDelete",
    ],
    properties: {
      ...calendarEventListItemProperties,
      description: nullableString,
      recurrencePattern: recurrencePatternDto,
      isSeriesException: { type: "boolean" },
      participants: {
        type: "array",
        items: { $ref: "CalendarEventParticipantDto#" },
      },
      reminders: {
        type: "array",
        items: { $ref: "CalendarEventReminderDto#" },
      },
      canEdit: { type: "boolean" },
      canDelete: { type: "boolean" },
    },
  });

  app.addSchema({
    $id: "CalendarEventListDto",
    type: "object",
    required: ["events"],
    properties: {
      events: { type: "array", items: { $ref: "CalendarEventListItemDto#" } },
    },
  });

  app.addSchema({
    $id: "CalendarEligibleChildDto",
    type: "object",
    required: ["id", "displayName", "figappId"],
    properties: {
      id: { type: "string" },
      displayName: { type: "string" },
      figappId: nullableString,
    },
  });

  app.addSchema({
    $id: "CalendarEligibleUserDto",
    type: "object",
    required: ["userId", "displayName", "role", "figappId"],
    properties: {
      userId: { type: "string" },
      displayName: { type: "string" },
      role: { type: "string" },
      figappId: nullableString,
    },
  });

  app.addSchema({
    $id: "CalendarEligibleParticipantsDto",
    type: "object",
    required: ["children", "linkedCarers", "socialWorkers"],
    properties: {
      children: { type: "array", items: { $ref: "CalendarEligibleChildDto#" } },
      linkedCarers: {
        type: "array",
        items: { $ref: "CalendarEligibleUserDto#" },
      },
      socialWorkers: {
        type: "array",
        items: { $ref: "CalendarEligibleUserDto#" },
      },
    },
  });

  app.addSchema({
    $id: "DocumentAssignmentDto",
    type: "object",
    required: ["id", "status", "hasRead", "readAt", "signedAt"],
    properties: {
      id: { type: "string" },
      status: { type: "string" },
      hasRead: { type: "boolean" },
      readAt: nullableString,
      signedAt: nullableString,
    },
  });

  app.addSchema({
    $id: "DocumentListItemDto",
    type: "object",
    required: [
      "id",
      "title",
      "documentType",
      "description",
      "filePath",
      "fileType",
      "fileSizeBytes",
      "status",
      "displayStatus",
      "createdAt",
      "updatedAt",
      "childId",
      "finalFilePath",
      "finalizationStatus",
      "previewPath",
      "canSign",
      "assignment",
    ],
    properties: {
      id: { type: "string" },
      title: { type: "string" },
      documentType: nullableString,
      description: nullableString,
      filePath: nullableString,
      fileType: nullableString,
      fileSizeBytes: { type: "integer", nullable: true },
      status: nullableString,
      displayStatus: { type: "string", enum: ["assigned", "completed"] },
      createdAt: nullableString,
      updatedAt: nullableString,
      childId: nullableString,
      finalFilePath: nullableString,
      finalizationStatus: nullableString,
      previewPath: nullableString,
      canSign: { type: "boolean" },
      assignment: { $ref: "DocumentAssignmentDto#" },
    },
  });

  app.addSchema({
    $id: "DocumentListDto",
    type: "object",
    required: ["documents", "toReviewCount"],
    properties: {
      documents: {
        type: "array",
        items: { $ref: "DocumentListItemDto#" },
      },
      toReviewCount: { type: "integer" },
    },
  });

  app.addSchema({
    $id: "DocumentSignResultDto",
    type: "object",
    required: ["document", "finalized", "finalizationMessage"],
    properties: {
      document: { $ref: "DocumentListItemDto#" },
      finalized: { type: "boolean" },
      finalizationMessage: nullableString,
    },
  });
}
