import type { RuntimeMessage } from "../shared/messages";
import type {
  AutofillRunResult,
  FillSuggestion,
  FormFieldSnapshot,
  LearnedValue,
  ResumeDocument,
  ResumeModuleKey,
  UnfilledItem
} from "../shared/types";

const FIELD_ATTR = "data-applyjob-field-id";
const learnedBuffer = new Map<string, LearnedValue>();

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function visible(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden" && element.offsetParent !== null;
}

function collapsed(element: HTMLElement): boolean {
  const details = element.closest("details");
  if (details && !details.open) {
    return true;
  }
  return !visible(element);
}

function fieldLabel(el: HTMLElement): string {
  const aria = el.getAttribute("aria-label");
  if (aria) {
    return aria.trim();
  }
  const id = el.getAttribute("id");
  if (id) {
    const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (label?.textContent) {
      return label.textContent.trim();
    }
  }
  const wrapperLabel = el.closest("label");
  if (wrapperLabel?.textContent) {
    return wrapperLabel.textContent.trim();
  }
  return "";
}

function sectionLabel(el: HTMLElement): string {
  const heading = el.closest("section, fieldset, [role='group'], .form-section, .section");
  const title = heading?.querySelector("h1, h2, h3, h4, legend, .title, .section-title");
  return title?.textContent?.trim() ?? "";
}

function optionList(el: Element): Array<{ label: string; value: string }> {
  if (el instanceof HTMLSelectElement) {
    return Array.from(el.options).map((item) => ({
      label: item.textContent?.trim() ?? "",
      value: item.value
    }));
  }
  return [];
}

function readValue(el: Element): string {
  if (el instanceof HTMLInputElement) {
    if (el.type === "checkbox" || el.type === "radio") {
      return el.checked ? el.value || "true" : "";
    }
    return el.value;
  }
  if (el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
    return el.value;
  }
  if (el instanceof HTMLElement && el.isContentEditable) {
    return el.innerText.trim();
  }
  return "";
}

function scanFields(): FormFieldSnapshot[] {
  const elements = Array.from(
    document.querySelectorAll("input, select, textarea, [contenteditable='true']")
  ).filter((node) => node instanceof HTMLElement) as HTMLElement[];

  return elements.map((el) => {
    if (!el.getAttribute(FIELD_ATTR)) {
      el.setAttribute(FIELD_ATTR, uid());
    }
    const fieldId = el.getAttribute(FIELD_ATTR)!;
    const type =
      el instanceof HTMLInputElement
        ? el.type
        : el instanceof HTMLSelectElement
          ? "select"
          : el instanceof HTMLTextAreaElement
            ? "textarea"
            : "richtext";
    const valueText = readValue(el);
    const label = fieldLabel(el);
    const placeholder =
      el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el.placeholder : "";
    const name = (el as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).name ?? "";
    const required =
      "required" in el ? Boolean((el as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).required) : false;

    return {
      id: fieldId,
      label,
      placeholder,
      name,
      type,
      required,
      visible: visible(el),
      options: optionList(el),
      sectionLabel: sectionLabel(el),
      valueText,
      isEmpty: valueText.trim().length === 0,
      collapsed: collapsed(el)
    };
  });
}

function setFieldValue(el: Element, value: string | string[] | boolean) {
  if (el instanceof HTMLInputElement) {
    if (el.type === "checkbox") {
      const target = Array.isArray(value) ? value.includes(el.value) : Boolean(value);
      el.checked = target;
    } else if (el.type === "radio") {
      const target = Array.isArray(value) ? value.includes(el.value) : String(value) === el.value;
      el.checked = target;
    } else {
      el.value = Array.isArray(value) ? value.join(", ") : String(value ?? "");
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return;
  }

  if (el instanceof HTMLSelectElement) {
    const display = Array.isArray(value) ? value[0] ?? "" : String(value ?? "");
    const option = Array.from(el.options).find((item) => {
      return item.textContent?.trim() === display || item.value === display;
    });
    el.value = option?.value ?? display;
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return;
  }

  if (el instanceof HTMLTextAreaElement) {
    el.value = Array.isArray(value) ? value.join("\n") : String(value ?? "");
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return;
  }

  if (el instanceof HTMLElement && el.isContentEditable) {
    el.focus();
    el.innerText = Array.isArray(value) ? value.join("\n") : String(value ?? "");
    el.dispatchEvent(new InputEvent("input", { bubbles: true, data: el.innerText }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

function clickAddButtonsForRepeatedSections(resume: ResumeDocument) {
  const sectionMap: Record<ResumeModuleKey, string[]> = {
    profile: [],
    education: ["新增教育", "add education"],
    experience: ["新增经历", "add experience", "add employment", "添加工作"],
    projects: ["新增项目", "add project", "添加项目"],
    skills: [],
    certificates: ["新增证书", "add certificate"],
    languages: ["新增语言", "add language"],
    other: []
  };

  for (const module of resume.modules) {
    if (module.entries.length <= 1) {
      continue;
    }
    const texts = sectionMap[module.key] ?? [];
    for (let i = 1; i < module.entries.length; i += 1) {
      const button = Array.from(document.querySelectorAll("button, a, [role='button']")).find((node) => {
        const text = node.textContent?.trim().toLowerCase() ?? "";
        return texts.some((keyword) => text.includes(keyword.toLowerCase()));
      });
      if (button instanceof HTMLElement) {
        button.click();
      }
    }
  }
}

function runAutofill(suggestions: FillSuggestion[], resume: ResumeDocument): AutofillRunResult {
  clickAddButtonsForRepeatedSections(resume);
  let filled = 0;
  const suggestionIds = new Set(suggestions.map((item) => item.fieldId));
  for (const suggestion of suggestions) {
    const element = document.querySelector(`[${FIELD_ATTR}="${CSS.escape(suggestion.fieldId)}"]`);
    if (element) {
      setFieldValue(element, suggestion.value);
      filled += 1;
    }
  }

  const all = scanFields();
  const unfilled: UnfilledItem[] = all
    .filter((item) => item.isEmpty || (item.required && item.isEmpty))
    .map((item) => ({
      fieldId: item.id,
      label: item.label || item.name || "未命名字段",
      reason: item.collapsed ? "collapsed" : item.required ? "required" : "empty"
    }));

  for (const field of all) {
    if (!suggestionIds.has(field.id) && field.isEmpty) {
      unfilled.push({
        fieldId: field.id,
        label: field.label || field.name || "未命名字段",
        reason: field.collapsed ? "collapsed" : "match_failed"
      });
    }
  }

  return { filled, unfilled };
}

function scrollToField(fieldId: string) {
  const element = document.querySelector(`[${FIELD_ATTR}="${CSS.escape(fieldId)}"]`);
  if (element instanceof HTMLElement) {
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    element.focus();
  }
}

function inferModule(label: string): ResumeModuleKey | undefined {
  const normalized = label.toLowerCase();
  if (/(name|email|phone|city|linkedin|github|姓名|邮箱|电话)/.test(normalized)) {
    return "profile";
  }
  if (/(school|university|degree|major|学校|学历|学位|专业)/.test(normalized)) {
    return "education";
  }
  if (/(company|employer|title|role|职责|公司|职位|工作)/.test(normalized)) {
    return "experience";
  }
  if (/(project|项目)/.test(normalized)) {
    return "projects";
  }
  if (/(skill|技能)/.test(normalized)) {
    return "skills";
  }
  if (/(certificate|证书)/.test(normalized)) {
    return "certificates";
  }
  if (/(language|语言)/.test(normalized)) {
    return "languages";
  }
  return "other";
}

function captureLearnedValues() {
  for (const field of scanFields()) {
    if (field.valueText.trim()) {
      learnedBuffer.set(field.label || field.name, {
        label: field.label || field.name || "未命名字段",
        value: field.valueText,
        moduleKey: inferModule(field.label || field.name),
        updatedAt: Date.now()
      });
    }
  }
  chrome.runtime.sendMessage({
    type: "LEARNED_VALUES",
    values: Array.from(learnedBuffer.values())
  } satisfies RuntimeMessage);
}

document.addEventListener(
  "focusout",
  (event) => {
    const target = event.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      (target instanceof HTMLElement && target.isContentEditable)
    ) {
      captureLearnedValues();
    }
  },
  true
);

document.addEventListener(
  "submit",
  () => {
    captureLearnedValues();
  },
  true
);

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message.type === "SCAN_FORM") {
    sendResponse({ type: "SCAN_FORM_RESPONSE", fields: scanFields() });
    return true;
  }

  if (message.type === "AUTOFILL_FORM") {
    sendResponse({ type: "AUTOFILL_FORM_RESPONSE", result: runAutofill(message.suggestions, message.resume) });
    return true;
  }

  if (message.type === "SCROLL_TO_FIELD") {
    scrollToField(message.fieldId);
    return false;
  }

  if (message.type === "REQUEST_UNFILLED") {
    const items = scanFields()
      .filter((item) => item.isEmpty || (item.required && item.isEmpty))
      .map((item) => ({
        fieldId: item.id,
        label: item.label || item.name || "未命名字段",
        reason: item.collapsed ? "collapsed" : item.required ? "required" : "empty"
      }));
    sendResponse({ type: "REQUEST_UNFILLED_RESPONSE", items });
    return true;
  }

  return false;
});
