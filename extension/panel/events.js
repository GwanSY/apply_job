export function bindPanelEvents(state, controller) {
  document.addEventListener("change", async (event) => {
    const target = event.target;
    if (target.id === "resume-upload" && target.files?.[0]) {
      await controller.handleUpload(target.files[0]);
      return;
    }

    if (target.id === "resume-select") {
      await controller.handleResumeSwitch(target.value);
      return;
    }

    if (target.id === "template-name") {
      controller.setTemplateName(target.value);
      return;
    }

    const action = target.dataset.action;
    if (!action) return;
    const moduleKey = target.dataset.module;
    const entryId = target.dataset.entry;
    const fieldId = target.dataset.field;

    if (action === "field-label") controller.patchField(moduleKey, entryId, fieldId, { label: target.value });
    if (action === "field-value") controller.patchField(moduleKey, entryId, fieldId, { value: target.value });
    if (action === "field-source") controller.patchField(moduleKey, entryId, fieldId, { sourceExcerpt: target.value });
    if (action === "field-reusable") controller.patchField(moduleKey, entryId, fieldId, { reusable: target.checked });
  });

  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    const moduleKey = button.dataset.module;
    const entryId = button.dataset.entry;
    const fieldId = button.dataset.field;

    if (action === "save") return await controller.handleSave();
    if (action === "save-template") return await controller.handleSaveTemplate();
    if (action === "delete-resume") return await controller.handleResumeDelete();
    if (action === "autofill") return await controller.handleAutofill();
    if (action === "refresh-unfilled") return await controller.refreshUnfilled();
    if (action === "tab") return controller.switchTab(button.dataset.tab);
    if (action === "add-entry") return controller.createEntry(moduleKey);
    if (action === "add-field") return controller.createField(moduleKey, entryId);
    if (action === "delete-field") return controller.deleteField(moduleKey, entryId, fieldId);
    if (action === "next-unfilled") return await controller.goToNextUnfilled();
    if (action === "scroll-unfilled") return await controller.goToUnfilled(button.dataset.fieldId);
  });

  document.addEventListener("dragstart", (event) => {
    const card = event.target.closest(".entry-card");
    if (!card) return;
    controller.startDrag(card.dataset.entry, card.dataset.module, card);
  });

  document.addEventListener("dragend", (event) => {
    controller.endDrag(event.target.closest(".entry-card"));
  });

  document.addEventListener("dragover", (event) => {
    controller.allowDrop(event.target.closest(".entry-card"), event);
  });

  document.addEventListener("drop", (event) => {
    controller.handleDrop(event.target.closest(".entry-card"), event);
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "LEARNED_VALUES") {
      void controller.mergeLearnedValues(message.values);
    }
  });
}
