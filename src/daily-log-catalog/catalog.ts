import type { CatalogDocument } from "./types.js";

// Authored content for the Daily Log question catalog. Every entry is
// keyed strictly by the real field id from the production template
// (verified against `daily_log_templates` in Supabase, agency default
// template, 2026-05-29) -- never by label text.
//
// `suggestions` on an entry represents only the STATIC "typical" tier from
// proactive_suggestions.dart (source: AiSuggestionSource.typical, the
// fieldId/regex-keyed template lists). It deliberately excludes:
//   - prior-day "yesterday" suggestions (AiSuggestionSource.yesterday) --
//     depends on that child's actual log history, not authorable content
//   - contradiction-dropping (dropContradictorySuggestions) -- runtime logic
//   - repeatable-row dedup against rows already added this session
//   - the generic "Yes" fallback for an empty yes/no field, and "Nothing
//     unusual to report" for an empty text field -- mechanical fallbacks
//     with no field-specific content, not something to author per field
// All of the above stay exactly as they are in each platform's app code.
// An entry with no `suggestions` key does not mean "no suggestions shown" --
// it means "no *typical* suggestions beyond the app's generic fallback."

export const dailyLogCatalog: CatalogDocument = {
  schemaVersion: 1,
  catalogVersion: 5,
  fields: {
    // -- Section: Morning routine & meals (page_morning) --

    waking_time: {
      fieldId: "waking_time",
      question: { default: "What time did {they} wake up today?" },
    },

    breakfast: {
      fieldId: "breakfast",
      question: { default: "Did {they} have breakfast this morning?" },
    },

    breakfast_details: {
      fieldId: "breakfast_details",
      question: {
        default: "What did {they} have for breakfast?",
        variants: [
          {
            when: { field: "breakfast", equals: "No" },
            text: "Why didn't {they} have breakfast this morning?",
          },
        ],
      },
      visibleWhen: { field: "breakfast", in: ["Yes", "No"] },
      suggestions: {
        default: ["Cereal and toast", "Eggs and toast", "Porridge and fruit"],
        variants: [
          {
            when: { field: "breakfast", equals: "No" },
            phrases: [
              "Wasn't hungry",
              "Refused to eat",
              "Not enough time before school",
              "Feeling unwell",
              "Ate elsewhere",
            ],
          },
        ],
      },
    },

    lunch: {
      fieldId: "lunch",
      question: { default: "Did {they} have lunch today?" },
    },

    lunch_details: {
      fieldId: "lunch_details",
      question: {
        default: "What did {they} have for lunch?",
        variants: [
          {
            when: { field: "lunch", equals: "No" },
            text: "Why didn't {they} have lunch today?",
          },
        ],
      },
      visibleWhen: { field: "lunch", in: ["Yes", "No"] },
      suggestions: {
        default: ["Packed lunch from home", "School dinner", "Sandwich and fruit"],
        variants: [
          {
            when: { field: "lunch", equals: "No" },
            phrases: [
              "Wasn't hungry",
              "Refused to eat",
              "Not enough time before school",
              "Feeling unwell",
              "Ate elsewhere",
            ],
          },
        ],
      },
    },

    dinner: {
      fieldId: "dinner",
      question: { default: "Did {they} have dinner today?" },
    },

    dinner_details: {
      fieldId: "dinner_details",
      question: {
        default: "What did {they} have for dinner?",
        variants: [
          {
            when: { field: "dinner", equals: "No" },
            text: "Why didn't {they} have dinner today?",
          },
        ],
      },
      visibleWhen: { field: "dinner", in: ["Yes", "No"] },
      suggestions: {
        default: ["Pasta and vegetables", "Chicken and rice", "Homemade meal together"],
        variants: [
          {
            when: { field: "dinner", equals: "No" },
            phrases: [
              "Wasn't hungry",
              "Refused to eat",
              "Not enough time before school",
              "Feeling unwell",
              "Ate elsewhere",
            ],
          },
        ],
      },
    },

    snack: {
      fieldId: "snack",
      question: { default: "Did {they} have any snacks today?" },
    },

    // Rule E: snacks have no follow-up on No or Unknown -- visible only on
    // Yes, unlike breakfast/lunch/dinner_details (which also ask why on
    // No). No suggestion variant needed either, since the "why didn't"
    // branch is unreachable here by construction.
    snack_details: {
      fieldId: "snack_details",
      question: { default: "What snacks did {they} have today?" },
      visibleWhen: { field: "snack", equals: "Yes" },
      suggestions: {
        default: ["Fruit and yoghurt", "Crackers and cheese", "Biscuit and milk"],
      },
    },

    // -- Section: Leisure activities & family time (page_leisure_family) --
    // No visibility gates in this section -- confirmed against
    // field_visibility.dart: none of these six fields match the meal-details
    // check (no meal keyword in id/label) or any yes/no-toggle gate (there
    // is no yes/no field in this section for _yesNoGateFor to match against).

    leisure_activities: {
      fieldId: "leisure_activities",
      question: { default: "What did {they} get up to for fun today?" },
    },

    leisure_comments: {
      fieldId: "leisure_comments",
      question: {
        default: "Would you like to add anything about {possessive} leisure time?",
      },
    },

    leisure_attachments: {
      fieldId: "leisure_attachments",
      question: {
        default: "Would you like to attach any photos from {possessive} activities today?",
      },
    },

    family_time: {
      fieldId: "family_time",
      question: {
        default: "How did {they} spend time with their foster family today?",
      },
    },

    family_time_comments: {
      fieldId: "family_time_comments",
      question: {
        default: "Would you like to add anything about {possessive} foster family experience today?",
      },
    },

    family_time_attachments: {
      fieldId: "family_time_attachments",
      question: {
        default: "Would you like to add any photos from {possessive} foster family experience today?",
      },
    },

    // -- Section: Appointments, medications & contact (page_appointments_meds_contact) --
    // Toggles are always visible (repeatableToggleLabel); the items list
    // for a group is visible only when that group's own toggle is Yes
    // (isRepeatableItemsFieldVisible in repeatable_items.dart). Row sub-
    // question order/UI stays in daily_log_repeatable_field.dart -- only
    // the strings move here.

    has_appointments: {
      fieldId: "has_appointments",
      question: {
        default: "Were there any appointments or meetings for {they} today?",
      },
    },

    // This field's own `question` is never rendered as a chat/form step --
    // the wizard shows the repeatableFields list UI instead. Present only
    // to satisfy the schema; kept as a reasonable label in case that
    // changes.
    appointments: {
      fieldId: "appointments",
      question: { default: "Appointments" },
      visibleWhen: { field: "has_appointments", equals: "Yes" },
      repeatableFields: [
        {
          fieldId: "type",
          question: { default: "What type of appointment was it?" },
        },
        {
          fieldId: "time",
          question: { default: "What time was the appointment?" },
        },
        {
          fieldId: "comments",
          question: {
            default: "Would you like to add anything about this appointment?",
          },
          suggestions: {
            // {type} is this row's own `type` value, substituted by the
            // caller -- covers every appointmentType not in one of the
            // named categories below (PEP, Parents Evening, CLA Review,
            // Solicitor, Home Office, Placement Planning, Other Meetings).
            default: [
              "{type} appointment attended as scheduled.",
              "Child cooperative throughout the {type} appointment.",
              "No concerns raised during the {type} appointment.",
            ],
            variants: [
              {
                when: { field: "type", equals: "Optician" },
                phrases: [
                  "Eye test completed, vision checked as planned.",
                  "No change to prescription; follow-up as advised.",
                  "New glasses or lenses discussed with the carer.",
                ],
              },
              {
                when: { field: "type", equals: "Dentist" },
                phrases: [
                  "Check-up completed; teeth cleaned as planned.",
                  "No treatment needed today; next review booked if required.",
                  "Oral health advice given; child cooperative throughout.",
                ],
              },
              {
                when: { field: "type", equals: "GP" },
                phrases: [
                  "Seen by GP; advice given and followed as discussed.",
                  "No further treatment needed today.",
                  "Prescription or referral arranged if required.",
                ],
              },
              {
                when: { field: "type", equals: "CLA Medical" },
                phrases: [
                  "Statutory medical completed as scheduled.",
                  "Health review discussed; no urgent concerns raised.",
                  "Recommendations shared with carer for follow-up.",
                ],
              },
              {
                when: { field: "type", equals: "Hospital" },
                phrases: [
                  "Hospital appointment attended as scheduled.",
                  "Seen by clinician; treatment or advice given.",
                  "Discharge advice followed; carer updated.",
                ],
              },
              {
                // CSW Visit and SSW Visit share the same suggestions in
                // the current app (both match the same "csw|...|sw visit"
                // pattern there).
                when: { field: "type", in: ["CSW Visit", "SSW Visit"] },
                phrases: [
                  "Visit completed; progress and support needs discussed.",
                  "No safeguarding concerns raised during the visit.",
                  "Actions agreed and shared with the carer.",
                ],
              },
            ],
          },
        },
      ],
    },

    has_medications: {
      fieldId: "has_medications",
      question: { default: "Was any medication given to {they} today?" },
    },

    // Question unused in practice, same as `appointments` above.
    medications: {
      fieldId: "medications",
      question: { default: "Medications" },
      visibleWhen: { field: "has_medications", equals: "Yes" },
      repeatableFields: [
        {
          fieldId: "medication",
          question: { default: "What medication was given?" },
          // Never a canned drug list here -- matches the app's own rule.
        },
        {
          fieldId: "time",
          question: { default: "What time was the medication given?" },
        },
        {
          fieldId: "dose",
          question: { default: "What was the dose given?" },
        },
        {
          fieldId: "comments",
          question: {
            default: "Would you like to add anything about this medication?",
          },
        },
      ],
    },

    has_contacts: {
      fieldId: "has_contacts",
      question: {
        default: "Did {they} have any family contact or visit today?",
      },
    },

    // Question unused in practice, same as `appointments` above.
    contacts: {
      fieldId: "contacts",
      question: { default: "Contacts" },
      visibleWhen: { field: "has_contacts", equals: "Yes" },
      repeatableFields: [
        {
          fieldId: "contact_type",
          question: {
            default: "Was the family visit & contact supervised or unsupervised?",
          },
        },
        {
          fieldId: "mode",
          question: {
            default: "How did the family visit & contact take place?",
          },
        },
        {
          fieldId: "time",
          question: {
            default: "What time did the family visit & contact happen?",
          },
        },
        {
          fieldId: "who_with",
          question: { default: "Who was the family visit & contact with?" },
          suggestions: {
            default: ["Mother", "Father", "Both parents"],
            variants: [
              { when: { field: "mode", equals: "Letterbox" }, phrases: ["Mother", "Father", "Maternal grandmother"] },
              { when: { field: "mode", equals: "Text Message" }, phrases: ["Mother", "Father", "Sibling"] },
              {
                when: { all: [{ field: "mode", equals: "Phone Call" }, { field: "contact_type", equals: "Supervised" }] },
                phrases: ["Mother", "Father", "Both parents"],
              },
              { when: { field: "mode", equals: "Phone Call" }, phrases: ["Mother", "Father", "Sibling"] },
              { when: { field: "mode", equals: "Video Call" }, phrases: ["Mother", "Father", "Both parents"] },
              {
                when: { all: [{ field: "mode", equals: "Face to Face" }, { field: "contact_type", equals: "Unsupervised" }] },
                phrases: ["Mother", "Father", "Sibling"],
              },
              { when: { field: "mode", equals: "Face to Face" }, phrases: ["Mother", "Father", "Both parents"] },
            ],
          },
        },
        {
          fieldId: "comments",
          question: {
            default: "Would you like to add anything about this family visit or contact?",
          },
          suggestions: {
            // {who} is this row's own `who_with` value, or "family" when
            // unanswered -- the caller building tokens is responsible for
            // that fallback (see substitution-token note at the top of this
            // file); resolve.ts itself just substitutes literally.
            default: [
              "Face-to-face contact with {who} went well.",
              "Child engaged positively during the contact.",
              "No concerns raised; next contact as arranged.",
            ],
            variants: [
              {
                when: { field: "mode", equals: "Letterbox" },
                phrases: [
                  "Letterbox contact exchanged with {who} as arranged.",
                  "Letter received and shared appropriately with the child.",
                  "No concerns noted about the letterbox exchange.",
                ],
              },
              {
                when: { field: "mode", equals: "Text Message" },
                phrases: [
                  "Text message contact with {who} as agreed.",
                  "Messages appropriate; child responded positively.",
                  "No safeguarding concerns from the message exchange.",
                ],
              },
              {
                when: { all: [{ field: "mode", equals: "Phone Call" }, { field: "contact_type", equals: "Supervised" }] },
                phrases: [
                  "Phone call with {who} completed as planned.",
                  "Supervised call; conversation appropriate throughout.",
                  "No concerns raised during the call.",
                ],
              },
              {
                when: { field: "mode", equals: "Phone Call" },
                phrases: [
                  "Phone call with {who} completed as planned.",
                  "Call went well; child engaged positively.",
                  "No concerns raised during the call.",
                ],
              },
              {
                when: { all: [{ field: "mode", equals: "Video Call" }, { field: "contact_type", equals: "Supervised" }] },
                phrases: [
                  "Video call with {who} attended as arranged.",
                  "Supervised video contact; interaction was positive.",
                  "No concerns noted during the session.",
                ],
              },
              {
                when: { field: "mode", equals: "Video Call" },
                phrases: [
                  "Video call with {who} attended as arranged.",
                  "Child engaged well throughout the video call.",
                  "No concerns noted during the session.",
                ],
              },
              {
                when: { all: [{ field: "mode", equals: "Face to Face" }, { field: "contact_type", equals: "Supervised" }] },
                phrases: [
                  "Supervised face-to-face contact with {who} went as planned.",
                  "Child engaged positively during the contact.",
                  "No concerns raised; next contact as arranged.",
                ],
              },
            ],
          },
        },
      ],
    },

    // -- Section: Evening, household tasks & mood (page_evening_household) --

    return_home_status: {
      fieldId: "return_home_status",
      question: { default: "Did {they} return home at the agreed time?" },
    },

    return_home_late_details: {
      fieldId: "return_home_late_details",
      question: { default: "Why did {they} return home late?" },
      visibleWhen: { field: "return_home_status", equals: "Returned late" },
      suggestions: {
        default: ["Held up by traffic", "Stayed longer with friends", "Public transport delayed"],
      },
    },

    return_home_not_return_details: {
      fieldId: "return_home_not_return_details",
      question: { default: "Why didn't {they} return home?" },
      visibleWhen: { field: "return_home_status", equals: "Did not return" },
      suggestions: {
        default: [
          "Staying overnight with agreed family or friends",
          "Reported to placing authority",
          "Whereabouts being followed up",
        ],
      },
    },

    bed_time: {
      fieldId: "bed_time",
      question: { default: "What time did {they} go to bed?" },
    },

    household_tasks: {
      fieldId: "household_tasks",
      question: { default: "Did {they} help with any household tasks today?" },
    },

    household_tasks_performed: {
      fieldId: "household_tasks_performed",
      question: { default: "Which household tasks did {they} help with today?" },
      visibleWhen: { field: "household_tasks", equals: "Yes" },
    },

    household_task_comments: {
      fieldId: "household_task_comments",
      question: {
        default: "Would you like to add anything about the household tasks {they} helped with today?",
      },
      visibleWhen: { field: "household_tasks", equals: "Yes" },
    },

    mood_of_the_day: {
      fieldId: "mood_of_the_day",
      question: { default: "How would you describe {possessive} mood today?" },
    },

    mood_comments: {
      fieldId: "mood_comments",
      question: {
        default: "Would you like to add anything about {possessive} mood today?",
      },
      // hasMoodSelection(mood_of_the_day) in the current app -- any mood
      // picked, not specifically "Other". (Requiring comments when "Other"
      // is picked is required-ness, stays in required_fields.dart.)
      visibleWhen: { field: "mood_of_the_day", answered: true },
      suggestions: {
        default: ["Calm and settled", "Happy and engaged", "A bit tired but cooperative"],
      },
    },

    religious_cultural_activity: {
      fieldId: "religious_cultural_activity",
      question: { default: "Was there religious and cultural activity today?" },
    },

    // Reworded from the ported-as-is "Any comments about the religious and
    // cultural?" (a generic comment-fallback artifact, not real spec
    // wording) after the developer spotted it live in the running app --
    // matches the house style used by every other *_comments field.
    religious_cultural_comments: {
      fieldId: "religious_cultural_comments",
      question: {
        default: "Would you like to add anything about {possessive} religious or cultural activities today?",
      },
    },

    allowances_given: {
      fieldId: "allowances_given",
      question: { default: "Was pocket money or allowance given to {they} today?" },
    },

    allowance_amount: {
      fieldId: "allowance_amount",
      question: { default: "How much pocket money or allowance was given today?" },
      visibleWhen: { field: "allowances_given", equals: "Yes" },
      suggestions: {
        default: ["Given in full, no issues", "Given for completing chores", "Discussed saving and spending"],
      },
    },

    payment_mode: {
      fieldId: "payment_mode",
      question: { default: "How was {possessive} pocket money or allowance paid?" },
      visibleWhen: { field: "allowances_given", equals: "Yes" },
    },

    allowances_details: {
      fieldId: "allowances_details",
      question: {
        default: "Would you like to add anything about {possessive} pocket money or allowance today?",
      },
      visibleWhen: { field: "allowances_given", equals: "Yes" },
      suggestions: {
        default: ["Given in full, no issues", "Given for completing chores", "Discussed saving and spending"],
      },
    },

    // -- Section: Incidents & final comments (page_incidents_other) --
    //
    // DOCUMENTED EXCEPTION to the template-intersection rule (ADR section 8):
    // the real template's own incidents fields (incidents_details,
    // incident_type, incident_report_status, incident_attachments) are dead
    // in the current app -- chat_question_order.dart's `_incidentsOrdered()`
    // silently discards all four and substitutes a synthetic, template-less
    // field (`_syntheticIncidentItems`, id "incident_items") that actually
    // drives the repeatable add-incident sheet. `incident_items` below is
    // that same id, carried into the catalog as one deliberate, tracked
    // exception -- preserving today's real behavior instead of the
    // undocumented code-only substitution. Decided explicitly, not a
    // default. The four dead template fields are not given entries here;
    // they are unreachable today and porting them would misrepresent
    // current behavior.

    incidents: {
      fieldId: "incidents",
      question: { default: "Was there an incident involving {they} today?" },
    },

    incident_items: {
      fieldId: "incident_items",
      question: { default: "Incidents" }, // unused in practice, see appointments/medications/contacts
      visibleWhen: { field: "incidents", equals: "Yes" },
      repeatableFields: [
        {
          fieldId: "type",
          question: { default: "What type of incident was it?" },
        },
        {
          fieldId: "time",
          question: { default: "What time did the incident occur?" },
        },
        {
          fieldId: "details",
          question: { default: "Please describe what happened." },
          // AI-assisted, not a static "typical" list -- suggestions here
          // come from a live model call keyed on the row's `type`, not
          // authorable content (see _reloadIncidentDetailsSuggestions).
        },
        {
          fieldId: "status",
          question: {
            default: "Have you already reported this incident through the Agency's incident reporting process?",
          },
        },
      ],
    },

    other_comments: {
      fieldId: "other_comments",
      question: { default: "Would you like to add anything else about {possessive} day?" },
    },

    // -- Section 2 rebuild (spec v2.4, ED-A..E) — School / Education --
    // Five arrangement-specific question sets; the *ordered field list*,
    // type/options/required-ness per set still lives client-side
    // (education_question_sets.ts / .dart — the catalog has no concept of
    // "which fields, in what order, belong to arrangement X", only flat
    // per-field wording/visibility) — this is the wording+visibility
    // source of truth those files check FIRST, falling back to their own
    // hand-authored content when catalog is unavailable (same pattern as
    // every other catalog-covered field in this app). Every condition here
    // uses `context: "educationArrangementId"` with the canonical id
    // (formal_schooling/home_learning/early_years/sixteen_plus/not_in_eet)
    // -- never the raw profile string -- exact match only.
    //
    // attended_on_time / reason_for_lateness / progress_from_school /
    // school_attachments are shared storage between formal_schooling and
    // home_learning (ED-B3-B6 reuse ED-A3-A6's fields per the spec), so
    // their wording branches on context too.

    attended_school: {
      fieldId: "attended_school",
      question: { default: "Did {they} attend school today?" },
      visibleWhen: { context: "educationArrangementId", equals: "formal_schooling" },
    },

    reason_for_absence: {
      fieldId: "reason_for_absence",
      question: { default: "Why didn't {they} attend school today?" },
      visibleWhen: {
        all: [
          { context: "educationArrangementId", equals: "formal_schooling" },
          { field: "attended_school", equals: "No" },
        ],
      },
      // Ported from proactive_suggestions.dart's old regex-keyed table --
      // once this field is catalog-covered it's the single source of truth
      // for its suggestions (even an authored empty list would win over the
      // old table), so the useful pre-rebuild content moves here rather
      // than silently disappearing.
      suggestions: {
        default: ["Feeling unwell", "Medical or dental appointment", "Family circumstances"],
      },
    },

    attended_on_time: {
      fieldId: "attended_on_time",
      question: {
        default: "Was {they} on time for school today?",
        variants: [
          {
            when: { context: "educationArrangementId", equals: "home_learning" },
            text: "Was {they} on time for home learning or tuition today?",
          },
        ],
      },
      visibleWhen: {
        any: [
          {
            all: [
              { context: "educationArrangementId", equals: "formal_schooling" },
              { field: "attended_school", equals: "Yes" },
            ],
          },
          {
            all: [
              { context: "educationArrangementId", equals: "home_learning" },
              { field: "home_learning_attended", equals: "Yes" },
            ],
          },
        ],
      },
    },

    reason_for_lateness: {
      fieldId: "reason_for_lateness",
      question: {
        default: "Why was {they} late for school?",
        variants: [
          {
            when: { context: "educationArrangementId", equals: "home_learning" },
            text: "Why was {they} late for home learning or tuition?",
          },
        ],
      },
      visibleWhen: {
        any: [
          {
            all: [
              { context: "educationArrangementId", equals: "formal_schooling" },
              { field: "attended_school", equals: "Yes" },
              { field: "attended_on_time", equals: "No" },
            ],
          },
          {
            all: [
              { context: "educationArrangementId", equals: "home_learning" },
              { field: "home_learning_attended", equals: "Yes" },
              { field: "attended_on_time", equals: "No" },
            ],
          },
        ],
      },
      // Ported from proactive_suggestions.dart's old regex-keyed table --
      // see the note on reason_for_absence above.
      suggestions: {
        default: ["Overslept", "Missed the bus or lift", "Traffic delay"],
      },
    },

    progress_from_school: {
      fieldId: "progress_from_school",
      question: {
        default: "Would you like to add anything about {possessive} school day?",
        variants: [
          {
            when: { context: "educationArrangementId", equals: "home_learning" },
            text: "Would you like to add anything about {possessive} home learning or tuition today?",
          },
        ],
      },
      visibleWhen: {
        any: [
          {
            all: [
              { context: "educationArrangementId", equals: "formal_schooling" },
              { field: "attended_school", in: ["Yes", "No"] },
            ],
          },
          {
            all: [
              { context: "educationArrangementId", equals: "home_learning" },
              { field: "home_learning_attended", in: ["Yes", "No"] },
            ],
          },
        ],
      },
    },

    school_attachments: {
      fieldId: "school_attachments",
      question: {
        default: "Would you like to add any photos or files from {possessive} school day?",
        variants: [
          {
            when: { context: "educationArrangementId", equals: "home_learning" },
            text: "Would you like to add any photos or files from {possessive} home learning or tuition today?",
          },
        ],
      },
      visibleWhen: {
        any: [
          {
            all: [
              { context: "educationArrangementId", equals: "formal_schooling" },
              { field: "attended_school", in: ["Yes", "No"] },
            ],
          },
          {
            all: [
              { context: "educationArrangementId", equals: "home_learning" },
              { field: "home_learning_attended", in: ["Yes", "No"] },
            ],
          },
        ],
      },
    },

    home_learning_attended: {
      fieldId: "home_learning_attended",
      question: { default: "Did {they} have home learning or tuition today?" },
      visibleWhen: { context: "educationArrangementId", equals: "home_learning" },
    },

    home_learning_absence_reason: {
      fieldId: "home_learning_absence_reason",
      question: { default: "Why didn't {they} have home learning or tuition today?" },
      visibleWhen: {
        all: [
          { context: "educationArrangementId", equals: "home_learning" },
          { field: "home_learning_attended", equals: "No" },
        ],
      },
    },

    nursery_attended: {
      fieldId: "nursery_attended",
      question: { default: "Did {they} attend nursery, pre-school or a childminder today?" },
      visibleWhen: { context: "educationArrangementId", equals: "early_years" },
    },

    nursery_absence_reason: {
      fieldId: "nursery_absence_reason",
      question: { default: "Why didn't {they} attend today?" },
      visibleWhen: {
        all: [
          { context: "educationArrangementId", equals: "early_years" },
          { field: "nursery_attended", equals: "No" },
        ],
      },
    },

    nursery_on_time: {
      fieldId: "nursery_on_time",
      question: {
        default: "Was {they} on time for nursery, pre-school or the childminder today?",
      },
      visibleWhen: {
        all: [
          { context: "educationArrangementId", equals: "early_years" },
          { field: "nursery_attended", equals: "Yes" },
        ],
      },
    },

    nursery_late_reason: {
      fieldId: "nursery_late_reason",
      question: { default: "Why was {they} late today?" },
      visibleWhen: {
        all: [
          { context: "educationArrangementId", equals: "early_years" },
          { field: "nursery_attended", equals: "Yes" },
          { field: "nursery_on_time", equals: "No" },
        ],
      },
    },

    nursery_comments: {
      fieldId: "nursery_comments",
      question: {
        default: "Would you like to add anything about {possessive} learning or play today?",
      },
      // Always shown regardless of the gate answer (ED-C5, unlike A/B/D).
      visibleWhen: { context: "educationArrangementId", equals: "early_years" },
    },

    nursery_attachments: {
      fieldId: "nursery_attachments",
      question: { default: "Would you like to add any photos or files from {possessive} day?" },
      // Always shown regardless of the gate answer (ED-C6, unlike A/B/D).
      visibleWhen: { context: "educationArrangementId", equals: "early_years" },
    },

    eet_attended: {
      fieldId: "eet_attended",
      question: { default: "Did {they} attend education, employment or training today?" },
      visibleWhen: { context: "educationArrangementId", equals: "sixteen_plus" },
    },

    eet_absence_reason: {
      fieldId: "eet_absence_reason",
      question: { default: "Why didn't {they} attend today?" },
      visibleWhen: {
        all: [
          { context: "educationArrangementId", equals: "sixteen_plus" },
          { field: "eet_attended", equals: "No" },
        ],
      },
    },

    eet_on_time: {
      fieldId: "eet_on_time",
      question: {
        default: "Was {they} on time for education, employment or training today?",
      },
      visibleWhen: {
        all: [
          { context: "educationArrangementId", equals: "sixteen_plus" },
          { field: "eet_attended", equals: "Yes" },
        ],
      },
    },

    eet_late_reason: {
      fieldId: "eet_late_reason",
      question: { default: "Why was {they} late today?" },
      visibleWhen: {
        all: [
          { context: "educationArrangementId", equals: "sixteen_plus" },
          { field: "eet_attended", equals: "Yes" },
          { field: "eet_on_time", equals: "No" },
        ],
      },
    },

    eet_comments: {
      fieldId: "eet_comments",
      question: {
        default:
          "Would you like to add anything about {possessive} education, employment or training today?",
      },
      visibleWhen: {
        all: [
          { context: "educationArrangementId", equals: "sixteen_plus" },
          { field: "eet_attended", in: ["Yes", "No"] },
        ],
      },
    },

    eet_attachments: {
      fieldId: "eet_attachments",
      question: { default: "Would you like to add any photos or files from today?" },
      visibleWhen: {
        all: [
          { context: "educationArrangementId", equals: "sixteen_plus" },
          { field: "eet_attended", in: ["Yes", "No"] },
        ],
      },
    },

    learning_development_participated: {
      fieldId: "learning_development_participated",
      question: {
        default:
          "Did {they} take part in any learning, skills or development activities today?",
      },
      visibleWhen: { context: "educationArrangementId", equals: "not_in_eet" },
    },

    learning_development_details: {
      fieldId: "learning_development_details",
      question: { default: "What did {they} take part in?" },
      visibleWhen: {
        all: [
          { context: "educationArrangementId", equals: "not_in_eet" },
          { field: "learning_development_participated", equals: "Yes" },
        ],
      },
    },

    learning_development_comments: {
      fieldId: "learning_development_comments",
      question: {
        default: "Would you like to add anything about {possessive} learning or development today?",
      },
      visibleWhen: { context: "educationArrangementId", equals: "not_in_eet" },
    },

    learning_development_attachments: {
      fieldId: "learning_development_attachments",
      question: { default: "Would you like to add any photos or files from today?" },
      visibleWhen: { context: "educationArrangementId", equals: "not_in_eet" },
    },

    // -- Parenting Assessment (parent & child placements only) --
    // Injected client-side when the log is for a placed parent; not on the
    // default foster-carer template. Spec DL-35 / DL-36.

    parenting_assessed_parent: {
      fieldId: "parenting_assessed_parent",
      question: { default: "Which parent are you assessing today?" },
    },

    parenting_daily_observations: {
      fieldId: "parenting_daily_observations",
      question: {
        default:
          "What did you observe about the parent's care and interaction with {they} today?",
      },
    },

    parenting_care_meeting_needs: {
      fieldId: "parenting_care_meeting_needs",
      question: {
        default: "How well did the parent meet {possessive} care needs today?",
      },
    },

    parenting_safety_awareness: {
      fieldId: "parenting_safety_awareness",
      question: {
        default: "How would you rate the parent's safety awareness today?",
      },
    },

    parenting_emotional_regulation: {
      fieldId: "parenting_emotional_regulation",
      question: {
        default: "How would you rate the parent's emotional regulation today?",
      },
    },

    parenting_concerns: {
      fieldId: "parenting_concerns",
      question: {
        default: "Any concerns or follow-up notes about the parent's care today?",
      },
    },

    parenting_follow_up_needed: {
      fieldId: "parenting_follow_up_needed",
      question: {
        default:
          "Is follow-up needed with the agency or social worker about the parent's care?",
      },
    },
  },
};
