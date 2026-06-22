import { isVisible, isCollapsed } from "./dom-utils.js";

export function getFieldLabel(element) {
  const aria = element.getAttribute("aria-label");
  if (aria) return aria.trim();
  const id = element.getAttribute("id");
  if (id) {
    const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (label?.textContent) return label.textContent.trim();
  }
  const wrapper = element.closest("label");
  return wrapper?.textContent?.trim() || "";
}

export function getSectionLabel(element) {
  const section = element.closest("section, fieldset, [role='group'], .form-section, .section");
  const title = section?.querySelector("h1, h2, h3, h4, legend, .title, .section-title");
  return title?.textContent?.trim() || "";
}

export function getOptions(element) {
  if (element instanceof HTMLSelectElement) {
    return Array.from(element.options).map((item) => ({
      label: item.textContent?.trim() || "",
      value: item.value
    }));
  }
  return [];
}

export function readValue(element) {
  if (element instanceof HTMLInputElement) {
    if (element.type === "checkbox" || element.type === "radio") {
      return element.checked ? element.value || "true" : "";
    }
    return element.value;
  }
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    return element.value;
  }
  if (element instanceof HTMLElement && element.isContentEditable) {
    return element.innerText.trim();
  }
  return "";
}

export function buildFieldSnapshot(element, id) {
  const type =
    element instanceof HTMLInputElement
      ? element.type
      : element instanceof HTMLSelectElement
        ? "select"
        : element instanceof HTMLTextAreaElement
          ? "textarea"
          : "richtext";
  const valueText = readValue(element);

  return {
    id,
    label: getFieldLabel(element),
    placeholder:
      element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement ? element.placeholder : "",
    name: element.name || "",
    type,
    required: "required" in element ? Boolean(element.required) : false,
    visible: isVisible(element),
    options: getOptions(element),
    sectionLabel: getSectionLabel(element),
    valueText,
    isEmpty: !String(valueText || "").trim(),
    collapsed: isCollapsed(element)
  };
}
