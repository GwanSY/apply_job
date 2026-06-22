import { isEditableTarget } from "./dom-utils.js";
import { captureLearnedValues } from "./learner.js";

export function bindContentEvents() {
  document.addEventListener(
    "focusout",
    (event) => {
      if (isEditableTarget(event.target)) {
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
}
