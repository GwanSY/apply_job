import type {
  AppSettings,
  LearnedValue,
  ResumeDocument,
  ResumeFileRecord,
  StoredAppState
} from "./types";

const APP_STATE_KEY = "applyjob-app-state";
const LEARNED_VALUES_KEY = "applyjob-learned-values";
const DB_NAME = "applyjob-files";
const FILE_STORE = "files";

const defaultSettings: AppSettings = {
  ocrEndpoint: "",
  matchingEndpoint: ""
};

export async function getAppState(): Promise<StoredAppState> {
  const result = await chrome.storage.local.get(APP_STATE_KEY);
  return (
    result[APP_STATE_KEY] ?? {
      resumes: [],
      currentResumeId: undefined,
      settings: defaultSettings
    }
  );
}

export async function saveAppState(state: StoredAppState): Promise<void> {
  await chrome.storage.local.set({ [APP_STATE_KEY]: state });
}

export async function upsertResume(resume: ResumeDocument): Promise<void> {
  const state = await getAppState();
  const resumes = state.resumes.filter((item) => item.id !== resume.id);
  resumes.unshift(resume);
  await saveAppState({
    ...state,
    resumes,
    currentResumeId: resume.id
  });
}

export async function setCurrentResume(id: string): Promise<void> {
  const state = await getAppState();
  await saveAppState({ ...state, currentResumeId: id });
}

export async function saveLearnedValues(values: LearnedValue[]): Promise<void> {
  await chrome.storage.local.set({ [LEARNED_VALUES_KEY]: values });
}

export async function getLearnedValues(): Promise<LearnedValue[]> {
  const result = await chrome.storage.local.get(LEARNED_VALUES_KEY);
  return result[LEARNED_VALUES_KEY] ?? [];
}

async function openDb(): Promise<IDBDatabase> {
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

export async function saveOriginalFile(record: ResumeFileRecord, file: File): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(FILE_STORE, "readwrite");
    tx.objectStore(FILE_STORE).put({
      ...record,
      file
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getOriginalFile(id: string): Promise<File | undefined> {
  const db = await openDb();
  return await new Promise<File | undefined>((resolve, reject) => {
    const tx = db.transaction(FILE_STORE, "readonly");
    const request = tx.objectStore(FILE_STORE).get(id);
    request.onsuccess = () => resolve(request.result?.file);
    request.onerror = () => reject(request.error);
  });
}
