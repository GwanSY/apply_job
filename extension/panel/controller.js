import { buildSuggestions } from "../core/matcher.js";
import { addEntry, addField, cloneCurrentResume, getCurrentResume, removeField, reorderEntries, updateResumeField } from "../core/resume-model.js";
import { parseResumeFile } from "../core/resume-parser.js";
import { getAppState, getLearnedValues, saveLearnedValues, saveOriginalFile, saveTemplate, setCurrentResume, upsertResume } from "../core/storage.js";
import { getActiveTabId, runPageAutofill, scanCurrentPage, scrollToField } from "../core/tab-bridge.js";
import { createTemplateFromResume } from "../core/template-model.js";
import { dedupeBy } from "../core/utils.js";
import { renderPanel } from "./render.js";

function mapUnfilledFields(fields) {
  return fields
    .filter((field) => field.isEmpty || (field.required && field.isEmpty))
    .map((field) => ({
      fieldId: field.id,
      label: field.label || field.name || "未命名字段",
      reason: field.collapsed ? "collapsed" : field.required ? "required" : "empty"
    }));
}

export function createPanelController(state) {
  function render() {
    renderPanel(state);
  }

  async function bootstrap() {
    state.appState = await getAppState();
    state.learnedValues = await getLearnedValues();
    state.draftResume = cloneCurrentResume(state.appState);
    state.templateName = "";
    render();
  }

  async function handleUpload(file) {
    state.status = "正在解析简历...";
    render();
    try {
      const resume = await parseResumeFile(file);
      await saveOriginalFile(
        {
          id: resume.id,
          docId: resume.id,
          fileName: file.name,
          fileType: file.type,
          createdAt: Date.now()
        },
        file
      );
      await upsertResume(resume);
      state.appState = await getAppState();
      state.draftResume = structuredClone(resume);
      state.status = "解析完成";
    } catch (error) {
      state.status = error instanceof Error ? error.message : "解析失败";
    }
    render();
  }

  async function handleResumeSwitch(id) {
    await setCurrentResume(id);
    state.appState = await getAppState();
    state.draftResume = cloneCurrentResume(state.appState);
    state.status = "已切换当前简历";
    render();
  }

  async function handleSave() {
    if (!state.draftResume) return;
    await upsertResume(state.draftResume);
    state.appState = await getAppState();
    state.status = "已保存";
    render();
  }

  async function handleAutofill() {
    const resume = getCurrentResume(state);
    if (!resume) return;
    state.status = "正在扫描页面并预填充...";
    render();
    const fields = await scanCurrentPage();
    const { suggestions, unmatched } = buildSuggestions(resume, fields, state.learnedValues);
    const tabId = await getActiveTabId();
    if (!tabId) {
      state.status = "未找到当前页面";
      render();
      return;
    }
    const response = await runPageAutofill(tabId, suggestions, resume);
    state.unfilled = dedupeBy([...(response.result?.unfilled || []), ...unmatched], (item) => item.fieldId);
    state.status = `预填充完成，已填充 ${response.result?.filled || 0} 项`;
    render();
  }

  async function refreshUnfilled() {
    const fields = await scanCurrentPage();
    state.unfilled = mapUnfilledFields(fields);
    state.status = "已刷新未填项";
    render();
  }

  function setTemplateName(value) {
    state.templateName = value;
  }

  async function handleSaveTemplate() {
    if (!state.draftResume) {
      state.status = "没有可保存的标准化字段";
      render();
      return;
    }

    const templateName = state.templateName.trim();
    if (!templateName) {
      state.status = "请输入模板名称";
      render();
      return;
    }

    const template = createTemplateFromResume(state.draftResume, templateName);
    await saveTemplate(template);
    state.appState = await getAppState();
    state.templateName = "";
    state.status = `模板已保存：${template.name}`;
    render();
  }

  function patchField(moduleKey, entryId, fieldId, patch) {
    if (!state.draftResume) return;
    state.draftResume = updateResumeField(state.draftResume, moduleKey, entryId, fieldId, patch);
  }

  function createField(moduleKey, entryId) {
    if (!state.draftResume) return;
    state.draftResume = addField(state.draftResume, moduleKey, entryId);
    render();
  }

  function deleteField(moduleKey, entryId, fieldId) {
    if (!state.draftResume) return;
    state.draftResume = removeField(state.draftResume, moduleKey, entryId, fieldId);
    render();
  }

  function createEntry(moduleKey) {
    if (!state.draftResume) return;
    state.draftResume = addEntry(state.draftResume, moduleKey);
    render();
  }

  function switchTab(tab) {
    state.activeTab = tab;
    render();
  }

  async function goToNextUnfilled() {
    if (state.unfilled[0]) {
      await scrollToField(state.unfilled[0].fieldId);
    }
  }

  async function goToUnfilled(fieldId) {
    await scrollToField(fieldId);
  }

  function startDrag(entryId, moduleKey, card) {
    state.drag = { entryId, moduleKey };
    card.classList.add("dragging");
  }

  function endDrag(card) {
    if (card) {
      card.classList.remove("dragging");
    }
  }

  function allowDrop(card, event) {
    if (card) {
      event.preventDefault();
    }
  }

  function handleDrop(card, event) {
    if (!card || !state.drag || !state.draftResume) return;
    event.preventDefault();
    const moduleKey = card.dataset.module;
    if (moduleKey !== state.drag.moduleKey) return;
    state.draftResume = reorderEntries(state.draftResume, moduleKey, state.drag.entryId, card.dataset.entry);
    state.drag = null;
    render();
  }

  async function mergeLearnedValues(values) {
    const map = new Map(state.learnedValues.map((item) => [item.label, item]));
    for (const item of values || []) {
      map.set(item.label, item);
    }
    state.learnedValues = Array.from(map.values());
    await saveLearnedValues(state.learnedValues);
  }

  return {
    bootstrap,
    render,
    handleUpload,
    handleResumeSwitch,
    handleSave,
    setTemplateName,
    handleSaveTemplate,
    handleAutofill,
    refreshUnfilled,
    patchField,
    createField,
    deleteField,
    createEntry,
    switchTab,
    goToNextUnfilled,
    goToUnfilled,
    startDrag,
    endDrag,
    allowDrop,
    handleDrop,
    mergeLearnedValues
  };
}
