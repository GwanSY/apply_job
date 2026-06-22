import { createEmptyModules } from "./resume-model.js";
import { invokeDocumentOcr } from "./ocr-adapter.js";
import { normalizeText, uid } from "./utils.js";

const DATE_RANGE_PATTERN =
  /((19|20)\d{2}[./年-]?\d{1,2}([月])?)\s*[-–—~至]\s*((19|20)\d{2}[./年-]?\d{1,2}([月])?|至今|现在|present)/i;

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

function isBulletLine(line) {
  return /^[>*•\-·]\s*/.test(line.trim());
}

function hasDateRange(line) {
  return DATE_RANGE_PATTERN.test(line);
}

function normalizeBulletText(line) {
  return line.replace(/^[>*•\-·]\s*/, "").trim();
}

function inferModuleFromLine(line) {
  const value = line.toLowerCase().trim();
  if (!hasDateRange(line)) {
    return undefined;
  }
  if (/(project|项目|rag|mcp|agent|langgraph|llm|platform|dashboard|系统|平台|插件)/i.test(value)) {
    return "projects";
  }
  if (/(intern|实习|company|公司|engineer|开发|research|研究|manager|经理|岗位|工作)/i.test(value)) {
    return "experience";
  }
  return "projects";
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

function isLikelyContinuation(previousLine, currentLine) {
  if (!previousLine || !currentLine) return false;
  if (detectSection(currentLine) || hasDateRange(currentLine) || isBulletLine(currentLine)) return false;
  if (hasDateRange(previousLine)) return false;
  if (/[。；;:：!?]$/.test(previousLine.trim())) return false;
  if (previousLine.trim().length >= 18) return true;
  if (/^[,，、.)）]/.test(currentLine.trim())) return true;
  return false;
}

function buildLogicalLines(text) {
  const rawLines = normalizeText(text)
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

  const merged = [];
  for (const line of rawLines) {
    const previous = merged[merged.length - 1];
    if (isLikelyContinuation(previous, line)) {
      merged[merged.length - 1] = `${previous} ${line}`.replace(/\s+/g, " ").trim();
    } else {
      merged.push(line);
    }
  }
  return merged;
}

function fallbackTitle(moduleKey) {
  return moduleKey === "education"
    ? "教育经历"
    : moduleKey === "experience"
      ? "工作经历"
      : moduleKey === "projects"
        ? "项目经历"
        : moduleKey === "certificates"
          ? "证书"
          : moduleKey === "languages"
            ? "语言"
            : "其他信息";
}

function shouldStartStructuredEntry(moduleKey, line, currentEntry) {
  if (!currentEntry) return true;
  if (hasDateRange(line)) return true;
  if (isBulletLine(line)) return false;
  if (moduleKey === "education" || moduleKey === "experience" || moduleKey === "projects") {
    return line.length <= 32 && !/[。；;:：]/.test(line);
  }
  return false;
}

function pushOrAppendDescription(entry, line, label = "描述") {
  const cleanText = normalizeBulletText(line);
  if (!cleanText) return;
  const existingField = entry.fields.find((field) => field.key === "description" && field.label === label);
  if (existingField) {
    existingField.value = `${existingField.value}\n${cleanText}`.trim();
    existingField.sourceExcerpt = `${existingField.sourceExcerpt || ""}\n${line}`.trim();
    return;
  }
  entry.fields.push({
    id: uid(),
    key: "description",
    label,
    value: cleanText,
    reusable: true,
    sourceExcerpt: line
  });
}

function createGenericEntry(module, moduleKey, line) {
  const entryIndex = module.entries.length + 1;
  const title = summarizeTitle(line, fallbackTitle(moduleKey), entryIndex);
  const entry = {
    id: uid(),
    title,
    fields: []
  };

  if (hasDateRange(line)) {
    entry.fields.push({
      id: uid(),
      key: moduleKey === "projects" ? "projectName" : "description",
      label: moduleKey === "projects" ? "项目名称" : "内容",
      value: line,
      reusable: true,
      sourceExcerpt: line
    });
  } else {
    entry.fields.push({
      id: uid(),
      key: "description",
      label: moduleKey === "projects" ? "项目内容" : "内容",
      value: line,
      reusable: true,
      sourceExcerpt: line
    });
  }

  module.entries.push(entry);
  return entry;
}

export function parseStructuredResume(text, fileName, fileType) {
  const lines = buildLogicalLines(text);

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

    if (currentModule === "other") {
      const inferredModule = inferModuleFromLine(line);
      if (inferredModule) {
        currentModule = inferredModule;
        currentEntry = null;
      }
    }

    const module = moduleMap.get(currentModule);
    if (!module) continue;

    if (["education", "experience", "projects", "certificates", "languages"].includes(currentModule)) {
      if (shouldStartStructuredEntry(currentModule, line, currentEntry)) {
        const entryIndex = module.entries.length + 1;
        currentEntry = {
          id: uid(),
          title: summarizeTitle(line, fallbackTitle(currentModule), entryIndex),
          fields: [buildPrimaryField(currentModule, line)]
        };
        module.entries.push(currentEntry);
      } else {
        pushOrAppendDescription(currentEntry, line, "描述");
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

    if (!currentEntry || hasDateRange(line)) {
      currentEntry = createGenericEntry(module, currentModule, line);
      continue;
    }

    pushOrAppendDescription(currentEntry, line, currentModule === "projects" ? "项目内容" : "内容");
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
