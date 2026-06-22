import { APP_STATE_KEY, DB_NAME, DEFAULT_APP_STATE, FILE_STORE, LEARNED_VALUES_KEY } from "./constants.js";

export async function getAppState() {
  const result = await chrome.storage.local.get(APP_STATE_KEY);
  return result[APP_STATE_KEY] || DEFAULT_APP_STATE;
}

export async function saveAppState(state) {
  await chrome.storage.local.set({ [APP_STATE_KEY]: state });
}

export async function getLearnedValues() {
  const result = await chrome.storage.local.get(LEARNED_VALUES_KEY);
  return result[LEARNED_VALUES_KEY] || [];
}

export async function saveLearnedValues(values) {
  await chrome.storage.local.set({ [LEARNED_VALUES_KEY]: values });
}

export async function upsertResume(resume) {
  const state = await getAppState();
  const resumes = state.resumes.filter((item) => item.id !== resume.id);
  resumes.unshift(resume);
  await saveAppState({
    ...state,
    resumes,
    currentResumeId: resume.id
  });
}

export async function setCurrentResume(id) {
  const state = await getAppState();
  await saveAppState({ ...state, currentResumeId: id });
}

export async function saveTemplate(template) {
  const state = await getAppState();
  const templates = (state.templates || []).filter((item) => item.name !== template.name);
  templates.unshift(template);
  await saveAppState({
    ...state,
    templates
  });
}

async function openDb() {
  return await new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(FILE_STORE)) {
        db.createObjectStore(FILE_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveOriginalFile(record, file) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(FILE_STORE, "readwrite");
    tx.objectStore(FILE_STORE).put({ ...record, file });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
