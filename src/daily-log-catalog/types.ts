export type FieldRefCondition =
  | { field: string; equals: string }
  | { field: string; in: string[] }
  | { field: string; notIn: string[] }
  | { field: string; answered: boolean };

export type ContextRefCondition =
  | { context: string; equals: string }
  | { context: string; in: string[] }
  | { context: string; notIn: string[] };

export type CompoundCondition =
  | { all: FieldCondition[] }
  | { any: FieldCondition[] };

export type FieldCondition =
  | FieldRefCondition
  | ContextRefCondition
  | CompoundCondition;

export type QuestionVariant = { when: FieldCondition; text: string };

export type Question = {
  default: string;
  variants?: QuestionVariant[];
};

export type SuggestionVariant = { when: FieldCondition; phrases: string[] };

export type SuggestionSet = {
  default: string[];
  variants?: SuggestionVariant[];
};

export type CatalogEntry = {
  fieldId: string;
  question: Question;
  visibleWhen?: FieldCondition;
  suggestions?: SuggestionSet;
  reportingKey?: string;
  repeatableFields?: CatalogEntry[];
};

export type CatalogDocument = {
  schemaVersion: number;
  catalogVersion: number;
  fields: Record<string, CatalogEntry>;
};

export type ResolveScope = {
  answers: Record<string, unknown>;
  context?: Record<string, unknown>;
};

export type SubstitutionTokens = {
  they: string;
  possessive: string;
  wasWere: string;
  who?: string;
  type?: string;
};
