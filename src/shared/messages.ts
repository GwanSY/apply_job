import type {
  AutofillRunResult,
  FillSuggestion,
  FormFieldSnapshot,
  LearnedValue,
  ResumeDocument,
  UnfilledItem
} from "./types";

export type RuntimeMessage =
  | { type: "SCAN_FORM" }
  | { type: "SCAN_FORM_RESPONSE"; fields: FormFieldSnapshot[] }
  | { type: "AUTOFILL_FORM"; suggestions: FillSuggestion[]; resume: ResumeDocument }
  | { type: "AUTOFILL_FORM_RESPONSE"; result: AutofillRunResult }
  | { type: "SCROLL_TO_FIELD"; fieldId: string }
  | { type: "LEARNED_VALUES"; values: LearnedValue[] }
  | { type: "REQUEST_UNFILLED" }
  | { type: "REQUEST_UNFILLED_RESPONSE"; items: UnfilledItem[] };
