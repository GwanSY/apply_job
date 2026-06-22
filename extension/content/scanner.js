import { ensureFieldId } from "./dom-utils.js";
import { buildFieldSnapshot } from "./field-metadata.js";

export function scanFields() {
  const elements = Array.from(
    document.querySelectorAll("input, select, textarea, [contenteditable='true']")
  ).filter((item) => item instanceof HTMLElement);

  return elements.map((element) => {
    const id = ensureFieldId(element);
    return buildFieldSnapshot(element, id);
  });
}

export function collectCurrentUnfilled() {
  return scanFields()
    .filter((field) => field.isEmpty || (field.required && field.isEmpty))
    .map((field) => ({
      fieldId: field.id,
      label: field.label || field.name || "未命名字段",
      reason: field.collapsed ? "collapsed" : field.required ? "required" : "empty"
    }));
}
