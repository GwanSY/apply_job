import { autofill, scrollToField } from "./filler.js";
import { scanFields } from "./scanner.js";

export function bindRuntimeMessages() {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "SCAN_FORM") {
      sendResponse({ type: "SCAN_FORM_RESPONSE", fields: scanFields() });
      return true;
    }

    if (message.type === "AUTOFILL_FORM") {
      sendResponse({
        type: "AUTOFILL_FORM_RESPONSE",
        result: autofill(message.suggestions, message.resume)
      });
      return true;
    }

    if (message.type === "SCROLL_TO_FIELD") {
      scrollToField(message.fieldId);
      return false;
    }

    return false;
  });
}
