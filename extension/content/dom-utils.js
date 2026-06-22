import { FIELD_ATTR } from "./constants.js";
import { uid } from "../core/utils.js";

export function ensureFieldId(element) {
  if (!element.getAttribute(FIELD_ATTR)) {
    element.setAttribute(FIELD_ATTR, uid());
  }
  return element.getAttribute(FIELD_ATTR);
}

export function getFieldElement(fieldId) {
  return document.querySelector(`[${FIELD_ATTR}="${CSS.escape(fieldId)}"]`);
}

export function isVisible(element) {
  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden" && element.offsetParent !== null;
}

export function isCollapsed(element) {
  const details = element.closest("details");
  if (details && !details.open) {
    return true;
  }
  return !isVisible(element);
}

export function isEditableTarget(target) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}
