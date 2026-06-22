import { MODULE_LABELS, MODULE_ORDER } from "./constants.js";
import { uid } from "./utils.js";

export function createEmptyModules() {
  return MODULE_ORDER.map((key) => ({
    key,
    label: MODULE_LABELS[key],
    entries: key === "profile" ? [{ id: uid(), title: "基础信息", fields: [] }] : []
  }));
}

export function getCurrentResume(state) {
  if (state.draftResume) return state.draftResume;
  if (!state.appState) return null;
  return state.appState.resumes.find((item) => item.id === state.appState.currentResumeId) || null;
}

export function cloneCurrentResume(appState) {
  const current = appState.resumes.find((item) => item.id === appState.currentResumeId) || appState.resumes[0] || null;
  return current ? structuredClone(current) : null;
}

export function updateResumeField(resume, moduleKey, entryId, fieldId, patch) {
  return {
    ...resume,
    updatedAt: Date.now(),
    modules: resume.modules.map((module) => {
      if (module.key !== moduleKey) return module;
      return {
        ...module,
        entries: module.entries.map((entry) => {
          if (entry.id !== entryId) return entry;
          return {
            ...entry,
            fields: entry.fields.map((field) => (field.id === fieldId ? { ...field, ...patch } : field))
          };
        })
      };
    })
  };
}

export function addField(resume, moduleKey, entryId) {
  return {
    ...resume,
    updatedAt: Date.now(),
    modules: resume.modules.map((module) => {
      if (module.key !== moduleKey) return module;
      return {
        ...module,
        entries: module.entries.map((entry) => {
          if (entry.id !== entryId) return entry;
          return {
            ...entry,
            fields: [
              ...entry.fields,
              {
                id: uid(),
                key: "custom",
                label: "自定义字段",
                value: "",
                reusable: true,
                sourceExcerpt: ""
              }
            ]
          };
        })
      };
    })
  };
}

export function removeField(resume, moduleKey, entryId, fieldId) {
  return {
    ...resume,
    updatedAt: Date.now(),
    modules: resume.modules.map((module) => {
      if (module.key !== moduleKey) return module;
      return {
        ...module,
        entries: module.entries.map((entry) => {
          if (entry.id !== entryId) return entry;
          return {
            ...entry,
            fields: entry.fields.filter((field) => field.id !== fieldId)
          };
        })
      };
    })
  };
}

export function addEntry(resume, moduleKey) {
  return {
    ...resume,
    updatedAt: Date.now(),
    modules: resume.modules.map((module) => {
      if (module.key !== moduleKey) return module;
      return {
        ...module,
        entries: [...module.entries, { id: uid(), title: "新条目", fields: [] }]
      };
    })
  };
}

export function reorderEntries(resume, moduleKey, fromEntryId, toEntryId) {
  return {
    ...resume,
    updatedAt: Date.now(),
    modules: resume.modules.map((module) => {
      if (module.key !== moduleKey) return module;
      const entries = [...module.entries];
      const from = entries.findIndex((item) => item.id === fromEntryId);
      const to = entries.findIndex((item) => item.id === toEntryId);
      if (from === -1 || to === -1) return module;
      const [moved] = entries.splice(from, 1);
      entries.splice(to, 0, moved);
      return { ...module, entries };
    })
  };
}
