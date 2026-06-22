import { REPEATED_SECTION_BUTTONS } from "./constants.js";
import { getFieldElement } from "./dom-utils.js";
import { scanFields } from "./scanner.js";

function setElementValue(element, value) {
  if (element instanceof HTMLInputElement) {
    if (element.type === "checkbox") {
      element.checked = Array.isArray(value) ? value.includes(element.value) : Boolean(value);
    } else if (element.type === "radio") {
      element.checked = Array.isArray(value) ? value.includes(element.value) : String(value) === element.value;
    } else {
      element.value = Array.isArray(value) ? value.join(", ") : String(value || "");
    }
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    return;
  }

  if (element instanceof HTMLSelectElement) {
    const display = Array.isArray(value) ? value[0] || "" : String(value || "");
    const option = Array.from(element.options).find((item) => item.textContent?.trim() === display || item.value === display);
    element.value = option?.value || display;
    element.dispatchEvent(new Event("change", { bubbles: true }));
    return;
  }

  if (element instanceof HTMLTextAreaElement) {
    element.value = Array.isArray(value) ? value.join("\n") : String(value || "");
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    return;
  }

  if (element instanceof HTMLElement && element.isContentEditable) {
    element.focus();
    element.innerText = Array.isArray(value) ? value.join("\n") : String(value || "");
    element.dispatchEvent(new InputEvent("input", { bubbles: true, data: element.innerText }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

function clickAddButtons(resume) {
  for (const module of resume.modules) {
    if (module.entries.length <= 1) continue;
    const texts = REPEATED_SECTION_BUTTONS[module.key] || [];
    for (let index = 1; index < module.entries.length; index += 1) {
      const button = Array.from(document.querySelectorAll("button, a, [role='button']")).find((node) => {
        const text = node.textContent?.trim().toLowerCase() || "";
        return texts.some((keyword) => text.includes(keyword.toLowerCase()));
      });
      if (button instanceof HTMLElement) {
        button.click();
      }
    }
  }
}

function buildUnfilledAfterAutofill(fields, suggestionIds) {
  const unfilled = [];
  for (const field of fields) {
    if (field.isEmpty || (field.required && field.isEmpty)) {
      unfilled.push({
        fieldId: field.id,
        label: field.label || field.name || "未命名字段",
        reason: field.collapsed ? "collapsed" : field.required ? "required" : "empty"
      });
      continue;
    }
    if (!suggestionIds.has(field.id) && field.isEmpty) {
      unfilled.push({
        fieldId: field.id,
        label: field.label || field.name || "未命名字段",
        reason: field.collapsed ? "collapsed" : "match_failed"
      });
    }
  }
  return unfilled;
}

export function autofill(suggestions, resume) {
  clickAddButtons(resume);
  let filled = 0;
  const suggestionIds = new Set(suggestions.map((item) => item.fieldId));

  for (const suggestion of suggestions) {
    const element = getFieldElement(suggestion.fieldId);
    if (element) {
      setElementValue(element, suggestion.value);
      filled += 1;
    }
  }

  const fields = scanFields();
  return {
    filled,
    unfilled: buildUnfilledAfterAutofill(fields, suggestionIds)
  };
}

export function scrollToField(fieldId) {
  const element = getFieldElement(fieldId);
  if (element instanceof HTMLElement) {
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    element.focus();
  }
}
