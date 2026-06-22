import type {
  FillSuggestion,
  FormFieldSnapshot,
  LearnedValue,
  ResumeDocument,
  ResumeField,
  ResumeModuleKey,
  UnfilledItem
} from "./types";

const keywordMap: Record<string, string[]> = {
  name: ["name", "姓名", "candidate name"],
  email: ["email", "邮箱", "mail"],
  phone: ["phone", "mobile", "电话", "手机号", "联系方式"],
  location: ["location", "city", "地址", "所在地"],
  linkedin: ["linkedin"],
  github: ["github"],
  school: ["学校", "school", "university", "college"],
  degree: ["degree", "学位", "学历"],
  major: ["major", "专业"],
  company: ["company", "公司", "employer"],
  title: ["title", "职位", "岗位", "role"],
  startDate: ["start", "开始", "from"],
  endDate: ["end", "结束", "to"],
  description: ["description", "职责", "描述", "summary"],
  projectName: ["project", "项目"],
  skill: ["skill", "技能"],
  certificate: ["certificate", "证书"],
  language: ["language", "语言"]
};

const moduleKeywords: Record<ResumeModuleKey, string[]> = {
  profile: ["个人", "profile", "basic", "contact"],
  education: ["教育", "education"],
  experience: ["工作", "experience", "employment"],
  projects: ["项目", "project"],
  skills: ["技能", "skill"],
  certificates: ["证书", "certificate"],
  languages: ["语言", "language"],
  other: ["其他", "other"]
};

function normalize(input: string): string {
  return input.trim().toLowerCase();
}

function scoreText(source: string, targets: string[]): number {
  const normalized = normalize(source);
  return targets.reduce((score, keyword) => {
    return normalized.includes(normalize(keyword)) ? score + 3 : score;
  }, 0);
}

function scoreModule(field: FormFieldSnapshot, moduleKey: ResumeModuleKey): number {
  return scoreText(field.sectionLabel, moduleKeywords[moduleKey] ?? []);
}

function fieldToString(value: ResumeField["value"]): string | string[] | boolean {
  return value;
}

function flattenResumeFields(resume: ResumeDocument, learned: LearnedValue[]) {
  const result: Array<{ moduleKey: ResumeModuleKey; field: ResumeField }> = [];
  for (const module of resume.modules) {
    for (const entry of module.entries) {
      for (const field of entry.fields) {
        result.push({ moduleKey: module.key, field });
      }
    }
  }
  for (const item of learned) {
    result.push({
      moduleKey: item.moduleKey ?? "other",
      field: {
        id: `learned-${item.label}`,
        key: item.label,
        label: item.label,
        value: item.value,
        reusable: true
      }
    });
  }
  return result;
}

export function buildSuggestions(
  resume: ResumeDocument,
  fields: FormFieldSnapshot[],
  learned: LearnedValue[]
): { suggestions: FillSuggestion[]; unfilled: UnfilledItem[] } {
  const pool = flattenResumeFields(resume, learned);
  const suggestions: FillSuggestion[] = [];
  const unfilled: UnfilledItem[] = [];

  for (const target of fields) {
    let bestScore = 0;
    let best: (typeof pool)[number] | undefined;
    for (const candidate of pool) {
      const labelScore = scoreText(target.label, keywordMap[candidate.field.key] ?? [candidate.field.label]);
      const placeholderScore = scoreText(target.placeholder, keywordMap[candidate.field.key] ?? [candidate.field.label]);
      const nameScore = scoreText(target.name, keywordMap[candidate.field.key] ?? [candidate.field.label]);
      const sectionScore = scoreModule(target, candidate.moduleKey);
      const total = labelScore + placeholderScore + nameScore + sectionScore;
      if (total > bestScore) {
        bestScore = total;
        best = candidate;
      }
    }
    if (best && bestScore >= 3) {
      suggestions.push({
        fieldId: target.id,
        resumeFieldId: best.field.id,
        value: fieldToString(best.field.value),
        label: target.label,
        sectionLabel: target.sectionLabel
      });
    } else {
      unfilled.push({
        fieldId: target.id,
        label: target.label || target.name || "未命名字段",
        reason: target.collapsed ? "collapsed" : "match_failed"
      });
    }
  }

  return { suggestions, unfilled };
}
