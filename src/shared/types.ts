export type ResumeModuleKey =
  | "profile"
  | "education"
  | "experience"
  | "projects"
  | "skills"
  | "certificates"
  | "languages"
  | "other";

export type ResumeFieldValue = string | string[] | boolean;

export interface ResumeField {
  id: string;
  key: string;
  label: string;
  value: ResumeFieldValue;
  reusable: boolean;
  sourceExcerpt?: string;
}

export interface ResumeEntry {
  id: string;
  title: string;
  fields: ResumeField[];
}

export interface ResumeModule {
  key: ResumeModuleKey;
  label: string;
  entries: ResumeEntry[];
}

export interface ResumeDocument {
  id: string;
  name: string;
  fileName: string;
  fileType: string;
  createdAt: number;
  updatedAt: number;
  rawText: string;
  modules: ResumeModule[];
}

export interface ResumeFileRecord {
  id: string;
  docId: string;
  fileName: string;
  fileType: string;
  createdAt: number;
}

export interface AppSettings {
  ocrEndpoint: string;
  matchingEndpoint: string;
}

export interface StoredAppState {
  resumes: ResumeDocument[];
  currentResumeId?: string;
  settings: AppSettings;
}

export interface FormFieldOption {
  label: string;
  value: string;
}

export interface FormFieldSnapshot {
  id: string;
  label: string;
  placeholder: string;
  name: string;
  type: string;
  required: boolean;
  visible: boolean;
  options: FormFieldOption[];
  sectionLabel: string;
  valueText: string;
  isEmpty: boolean;
  collapsed: boolean;
}

export interface FillSuggestion {
  fieldId: string;
  resumeFieldId: string;
  value: string | string[] | boolean;
  label: string;
  sectionLabel: string;
}

export interface UnfilledItem {
  fieldId: string;
  label: string;
  reason: "empty" | "required" | "match_failed" | "not_on_page" | "collapsed";
}

export interface LearnedValue {
  label: string;
  value: string | string[] | boolean;
  moduleKey?: ResumeModuleKey;
  updatedAt: number;
}

export interface AutofillRunResult {
  filled: number;
  unfilled: UnfilledItem[];
}
