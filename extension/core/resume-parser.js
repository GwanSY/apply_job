import { createEmptyModules } from "./resume-model.js";
import { invokeDocumentOcr } from "./ocr-adapter.js";
import { normalizeText, uid } from "./utils.js";

function summarizeTitle(line, fallbackLabel, index) {
  const text = line.replace(/\s+/g, " ").trim();
  if (!text) {
    return `${fallbackLabel}${index}`;
  }
  if (text.length <= 24) {
    return text;
  }
  return `${fallbackLabel}${index}`;
}

function detectSection(line) {
  const value = line.toLowerCase().trim();
  if (/(教育|education)/.test(value)) return "education";
  if (/(工作|experience|employment)/.test(value)) return "experience";
  if (/(项目|project)/.test(value)) return "projects";
  if (/(技能|skill)/.test(value)) return "skills";
  if (/(证书|certificate)/.test(value)) return "certificates";
  if (/(语言|language)/.test(value)) return "languages";
  if (/(个人|profile|basic|contact)/.test(value)) return "profile";
  return undefined;
}

function buildPrimaryField(moduleKey, line) {
  return {
    id: uid(),
    key:
      moduleKey === "education"
        ? "school"
        : moduleKey === "projects"
          ? "projectName"
          : moduleKey === "certificates"
            ? "certificate"
            : moduleKey === "languages"
              ? "language"
              : "company",
    label:
      moduleKey === "education"
        ? "学校"
        : moduleKey === "projects"
          ? "项目名称"
          : moduleKey === "certificates"
            ? "证书"
            : moduleKey === "languages"
              ? "语言"
              : "公司",
    value: line,
    reusable: true,
    sourceExcerpt: line
  };
}

export function parseStructuredResume(text, fileName, fileType) {
  const lines = normalizeText(text)
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

  const modules = createEmptyModules();
  const moduleMap = new Map(modules.map((item) => [item.key, item]));
  const profile = moduleMap.get("profile").entries[0];

  const pushProfile = (key, label, value, sourceExcerpt) => {
    if (!value || !value.trim()) return;
    profile.fields.push({
      id: uid(),
      key,
      label,
      value,
      reusable: true,
      sourceExcerpt: sourceExcerpt || value
    });
  };

  pushProfile("name", "姓名", lines[0] || "");
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
  const phone = text.match(/(\+?\d[\d\s-]{7,}\d)/)?.[0] || text.match(/(1[3-9]\d{9})/)?.[0] || "";
  const linkedin = text.match(/https?:\/\/(www\.)?linkedin\.com\/[^\s]+/i)?.[0] || "";
  const github = text.match(/https?:\/\/(www\.)?github\.com\/[^\s]+/i)?.[0] || "";

  pushProfile("email", "邮箱", email, email);
  pushProfile("phone", "手机号", phone, phone);
  pushProfile("linkedin", "LinkedIn", linkedin, linkedin);
  pushProfile("github", "GitHub", github, github);

  let currentModule = "other";
  let currentEntry = null;

  for (const line of lines) {
    const section = detectSection(line);
    if (section) {
      currentModule = section;
      currentEntry = null;
      continue;
    }

    if ([lines[0], email, phone, linkedin, github].includes(line)) {
      continue;
    }

    const module = moduleMap.get(currentModule);
    if (!module) continue;

    if (["education", "experience", "projects", "certificates", "languages"].includes(currentModule)) {
      if (!currentEntry || !/^[-*•]/.test(line)) {
        const entryIndex = module.entries.length + 1;
        const fallbackLabel =
          currentModule === "education"
            ? "教育经历"
            : currentModule === "experience"
              ? "工作经历"
              : currentModule === "projects"
                ? "项目经历"
                : currentModule === "certificates"
                  ? "证书"
                  : "语言";
        currentEntry = {
          id: uid(),
          title: summarizeTitle(line, fallbackLabel, entryIndex),
          fields: [buildPrimaryField(currentModule, line)]
        };
        module.entries.push(currentEntry);
      } else {
        currentEntry.fields.push({
          id: uid(),
          key: "description",
          label: "描述",
          value: line.replace(/^[-*•]\s*/, ""),
          reusable: true,
          sourceExcerpt: line
        });
      }
      continue;
    }

    if (currentModule === "skills") {
      if (module.entries.length === 0) {
        module.entries.push({ id: uid(), title: "技能", fields: [] });
      }
      module.entries[0].fields.push({
        id: uid(),
        key: "skill",
        label: "技能",
        value: line.replace(/^[-*•]\s*/, ""),
        reusable: true,
        sourceExcerpt: line
      });
      continue;
    }

    if (module.entries.length === 0) {
      module.entries.push({ id: uid(), title: "其他", fields: [] });
    }
    module.entries[0].fields.push({
      id: uid(),
      key: "description",
      label: "其他信息",
      value: line,
      reusable: true,
      sourceExcerpt: line
    });
  }

  return {
    id: uid(),
    name: fileName.replace(/\.[^.]+$/, ""),
    fileName,
    fileType,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    rawText: text,
    modules
  };
}

export async function parseResumeFile(file) {
  const text = await invokeDocumentOcr(file);
  return parseStructuredResume(text, file.name, file.type || "unknown");
}
