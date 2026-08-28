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
}
