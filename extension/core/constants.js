export const MODULE_ORDER = [
  "profile",
  "education",
  "experience",
  "projects",
  "skills",
  "certificates",
  "languages",
  "other"
];

export const MODULE_LABELS = {
  profile: "个人信息",
  education: "教育经历",
  experience: "工作经历",
  projects: "项目经历",
  skills: "技能",
  certificates: "证书",
  languages: "语言",
  other: "其他"
};

export const APP_STATE_KEY = "applyjob-app-state";
export const LEARNED_VALUES_KEY = "applyjob-learned-values";
export const DB_NAME = "applyjob-files";
export const FILE_STORE = "files";

export const DEFAULT_APP_STATE = {
  resumes: [],
  currentResumeId: "",
  templates: []
};
