import { useEffect, useMemo, useState } from "react";
import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import mammoth from "mammoth";
import { buildSuggestions } from "../shared/semantic";
import { getAppState, getLearnedValues, saveAppState, saveLearnedValues, saveOriginalFile, setCurrentResume, upsertResume } from "../shared/storage";
import type { RuntimeMessage } from "../shared/messages";
import type {
  AppSettings,
  AutofillRunResult,
  FormFieldSnapshot,
  LearnedValue,
  ResumeDocument,
  ResumeEntry,
  ResumeField,
  ResumeModule,
  ResumeModuleKey,
  ResumeFileRecord,
  StoredAppState,
  UnfilledItem
} from "../shared/types";

const MODULE_LABELS: Record<ResumeModuleKey, string> = {
  profile: "个人信息",
  education: "教育经历",
  experience: "工作经历",
  projects: "项目经历",
  skills: "技能",
  certificates: "证书",
  languages: "语言",
  other: "其他"
};

const DEFAULT_MODULE_ORDER: ResumeModuleKey[] = [
  "profile",
  "education",
  "experience",
  "projects",
  "skills",
  "certificates",
  "languages",
  "other"
];

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createEmptyModules(): ResumeModule[] {
  return DEFAULT_MODULE_ORDER.map((key) => ({
    key,
    label: MODULE_LABELS[key],
    entries: key === "profile" ? [{ id: uid(), title: "基础信息", fields: [] }] : []
  }));
}

function normalizeText(text: string) {
  return text.replace(/\r/g, "").trim();
}

function detectSection(line: string): ResumeModuleKey | undefined {
  const value = line.toLowerCase().trim();
  if (/(教育|education)/.test(value)) return "education";
  if (/(工作|experience|employment)/.test(value)) return "experience";
  if (/(项目|project)/.test(value)) return "projects";
  if (/(技能|skill)/.test(value)) return "skills";
  if (/(证书|certificate)/.test(value)) return "certificates";
  if (/(语言|language)/.test(value)) return "languages";
  if (/(个人|profile|basic|contact)/.test(value)) return "profile";
  return undefined;
}

function parseStructuredResume(text: string, fileName: string, fileType: string): ResumeDocument {
  const lines = normalizeText(text)
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

  const modules = createEmptyModules();
  const moduleMap = new Map(modules.map((module) => [module.key, module] as const));
  const profile = moduleMap.get("profile")!.entries[0];

  const pushProfile = (key: string, label: string, value: string, sourceExcerpt?: string) => {
    if (!value.trim()) return;
    profile.fields.push({
      id: uid(),
      key,
      label,
      value,
      reusable: true,
      sourceExcerpt
    });
  };

  pushProfile("name", "姓名", lines[0] ?? "");
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "";
  const phone =
    text.match(/(\+?\d[\d\s-]{7,}\d)/)?.[0] ??
    text.match(/(1[3-9]\d{9})/)?.[0] ??
    "";
  const linkedin = text.match(/https?:\/\/(www\.)?linkedin\.com\/[^\s]+/i)?.[0] ?? "";
  const github = text.match(/https?:\/\/(www\.)?github\.com\/[^\s]+/i)?.[0] ?? "";

  pushProfile("email", "邮箱", email, email);
  pushProfile("phone", "手机号", phone, phone);
  pushProfile("linkedin", "LinkedIn", linkedin, linkedin);
  pushProfile("github", "GitHub", github, github);

  let currentModule: ResumeModuleKey = "other";
  let currentEntry: ResumeEntry | undefined;

  for (const line of lines) {
    const section = detectSection(line);
    if (section) {
      currentModule = section;
      currentEntry = undefined;
      continue;
    }
    if (line === lines[0] || line === email || line === phone || line === linkedin || line === github) {
      continue;
    }

    const module = moduleMap.get(currentModule);
    if (!module) continue;

    if (["education", "experience", "projects", "certificates", "languages"].includes(currentModule)) {
      if (!currentEntry || /^[-*•]/.test(line) === false) {
        currentEntry = {
          id: uid(),
          title: line.slice(0, 80),
          fields: [
            {
              id: uid(),
              key:
                currentModule === "education"
                  ? "school"
                  : currentModule === "projects"
                    ? "projectName"
                    : currentModule === "certificates"
                      ? "certificate"
                      : currentModule === "languages"
                        ? "language"
                        : "company",
              label:
                currentModule === "education"
                  ? "学校"
                  : currentModule === "projects"
                    ? "项目名称"
                    : currentModule === "certificates"
                      ? "证书"
                      : currentModule === "languages"
                        ? "语言"
                        : "公司",
              value: line,
              reusable: true,
              sourceExcerpt: line
            }
          ]
        };
        module.entries.push(currentEntry);
      } else {
        currentEntry.fields.push({
          id: uid(),
          key: "description",
          label: "描述",
          value: line.replace(/^[-*•]\s*/, ""),
          reusable: true,
          sourceExcerpt: line
        });
      }
      continue;
    }

    if (currentModule === "skills") {
      if (module.entries.length === 0) {
        module.entries.push({ id: uid(), title: "技能", fields: [] });
      }
      module.entries[0].fields.push({
        id: uid(),
        key: "skill",
        label: "技能",
        value: line.replace(/^[-*•]\s*/, ""),
        reusable: true,
        sourceExcerpt: line
      });
      continue;
    }

    if (currentModule === "other") {
      if (module.entries.length === 0) {
        module.entries.push({ id: uid(), title: "其他", fields: [] });
      }
      module.entries[0].fields.push({
        id: uid(),
        key: "description",
        label: "其他信息",
        value: line,
        reusable: true,
        sourceExcerpt: line
      });
    }
  }

  return {
    id: uid(),
    name: fileName.replace(/\.[^.]+$/, ""),
    fileName,
    fileType,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    rawText: text,
    modules
  };
}

async function callRemoteParser(file: File, settings: AppSettings): Promise<string | undefined> {
  if (!settings.ocrEndpoint) {
    return undefined;
  }
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(settings.ocrEndpoint, {
    method: "POST",
    body: formData
  });
  if (!response.ok) {
    throw new Error("OCR parsing failed");
  }
  const result = await response.json();
  return typeof result.text === "string" ? result.text : undefined;
}

async function parsePdf(file: File, settings: AppSettings): Promise<string> {
  const remote = await callRemoteParser(file, settings).catch(() => undefined);
  if (remote) {
    return remote;
  }
  throw new Error("PDF 解析需要配置 OCR 接口");
}

async function parseDocx(file: File, settings: AppSettings): Promise<string> {
  const buffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  if (result.value.trim()) {
    return result.value;
  }
  const remote = await callRemoteParser(file, settings);
  if (!remote) {
    throw new Error("DOCX extraction failed");
  }
  return remote;
}

async function parseDoc(file: File, settings: AppSettings): Promise<string> {
  const remote = await callRemoteParser(file, settings);
  if (!remote) {
    throw new Error("DOC requires an OCR endpoint");
  }
  return remote;
}

async function parseResumeFile(file: File, settings: AppSettings): Promise<ResumeDocument> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  let rawText = "";
  if (extension === "pdf") {
    rawText = await parsePdf(file, settings);
  } else if (extension === "docx") {
    rawText = await parseDocx(file, settings);
  } else if (extension === "doc") {
    rawText = await parseDoc(file, settings);
  } else {
    throw new Error("Unsupported file type");
  }
  return parseStructuredResume(rawText, file.name, file.type || extension || "unknown");
}

async function getActiveTabId(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

async function scanCurrentPage(): Promise<FormFieldSnapshot[]> {
  const tabId = await getActiveTabId();
  if (!tabId) return [];
  const response = (await chrome.tabs.sendMessage(tabId, {
    type: "SCAN_FORM"
  } satisfies RuntimeMessage)) as Extract<RuntimeMessage, { type: "SCAN_FORM_RESPONSE" }>;
  return response.fields;
}

async function autofillCurrentPage(resume: ResumeDocument, learnedValues: LearnedValue[]) {
  const fields = await scanCurrentPage();
  const { suggestions, unfilled: unmatched } = buildSuggestions(resume, fields, learnedValues);
  const tabId = await getActiveTabId();
  if (!tabId) {
    throw new Error("No active tab");
  }
  const response = (await chrome.tabs.sendMessage(tabId, {
    type: "AUTOFILL_FORM",
    suggestions,
    resume
  } satisfies RuntimeMessage)) as Extract<RuntimeMessage, { type: "AUTOFILL_FORM_RESPONSE" }>;

  const merged = dedupeUnfilled([...response.result.unfilled, ...unmatched]);
  return {
    filled: response.result.filled,
    unfilled: merged
  };
}

function dedupeUnfilled(items: UnfilledItem[]) {
  const map = new Map<string, UnfilledItem>();
  for (const item of items) {
    if (!map.has(item.fieldId)) {
      map.set(item.fieldId, item);
    }
  }
  return Array.from(map.values());
}

function updateResumeField(
  resume: ResumeDocument,
  moduleKey: ResumeModuleKey,
  entryId: string,
  fieldId: string,
  patch: Partial<ResumeField>
) {
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

function addField(resume: ResumeDocument, moduleKey: ResumeModuleKey, entryId: string) {
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
                reusable: true
              }
            ]
          };
        })
      };
    })
  };
}

function removeField(resume: ResumeDocument, moduleKey: ResumeModuleKey, entryId: string, fieldId: string) {
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

function addEntry(resume: ResumeDocument, moduleKey: ResumeModuleKey) {
  return {
    ...resume,
    updatedAt: Date.now(),
    modules: resume.modules.map((module) => {
      if (module.key !== moduleKey) return module;
      return {
        ...module,
        entries: [
          ...module.entries,
          {
            id: uid(),
            title: "新条目",
            fields: []
          }
        ]
      };
    })
  };
}

function SortableEntryCard({
  entry,
  children
}: {
  entry: ResumeEntry;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: entry.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  return (
    <div ref={setNodeRef} style={style} className="entry-card">
      <div className="entry-head">
        <span>{entry.title || "未命名条目"}</span>
        <button className="ghost-button" {...attributes} {...listeners}>
          拖拽
        </button>
      </div>
      {children}
    </div>
  );
}

export default function App() {
  const [appState, setAppState] = useState<StoredAppState | null>(null);
  const [draftResume, setDraftResume] = useState<ResumeDocument | null>(null);
  const [activeTab, setActiveTab] = useState<"structured" | "raw">("structured");
  const [status, setStatus] = useState("准备就绪");
  const [unfilled, setUnfilled] = useState<UnfilledItem[]>([]);
  const [learnedValues, setLearnedValuesState] = useState<LearnedValue[]>([]);

  const sensors = useSensors(useSensor(PointerSensor));

  useEffect(() => {
    const bootstrap = async () => {
      const state = await getAppState();
      const learned = await getLearnedValues();
      setLearnedValuesState(learned);
      setAppState(state);
      const current = state.resumes.find((item) => item.id === state.currentResumeId) ?? state.resumes[0] ?? null;
      setDraftResume(current ? structuredClone(current) : null);
    };
    void bootstrap();
  }, []);

  useEffect(() => {
    const listener = (message: RuntimeMessage) => {
      if (message.type === "LEARNED_VALUES") {
        const merged = new Map<string, LearnedValue>();
        for (const item of learnedValues) {
          merged.set(item.label, item);
        }
        for (const item of message.values) {
          merged.set(item.label, item);
        }
        const values = Array.from(merged.values());
        setLearnedValuesState(values);
        void saveLearnedValues(values);
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, [learnedValues]);

  const currentResume = useMemo(() => {
    if (!appState) return null;
    if (draftResume) return draftResume;
    return appState.resumes.find((item) => item.id === appState.currentResumeId) ?? null;
  }, [appState, draftResume]);

  async function handleUpload(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file || !appState) return;
    setStatus("正在解析简历...");
    try {
      const parsed = await parseResumeFile(file, appState.settings);
      const record: ResumeFileRecord = {
        id: parsed.id,
        docId: parsed.id,
        fileName: file.name,
        fileType: file.type,
        createdAt: Date.now()
      };
      await saveOriginalFile(record, file);
      await upsertResume(parsed);
      const next = await getAppState();
      setAppState(next);
      setDraftResume(structuredClone(parsed));
      setStatus("解析完成");
    } catch (error) {
      console.error(error);
      setStatus(error instanceof Error ? error.message : "解析失败");
    }
  }

  async function handleResumeSwitch(id: string) {
    if (!appState) return;
    await setCurrentResume(id);
    const next = await getAppState();
    const current = next.resumes.find((item) => item.id === id) ?? null;
    setAppState(next);
    setDraftResume(current ? structuredClone(current) : null);
    setStatus("已切换当前简历");
  }

  async function handleSave() {
    if (!draftResume) return;
    await upsertResume(draftResume);
    const next = await getAppState();
    setAppState(next);
    setDraftResume(structuredClone(draftResume));
    setStatus("已保存");
  }

  async function handleAutofill() {
    if (!currentResume) return;
    setStatus("正在扫描页面并预填充...");
    try {
      const result = await autofillCurrentPage(currentResume, learnedValues);
      setUnfilled(result.unfilled);
      setStatus(`预填充完成，已填充 ${result.filled} 项`);
    } catch (error) {
      console.error(error);
      setStatus("预填充失败");
    }
  }

  async function handleScrollToField(fieldId: string) {
    const tabId = await getActiveTabId();
    if (!tabId) return;
    await chrome.tabs.sendMessage(tabId, {
      type: "SCROLL_TO_FIELD",
      fieldId
    } satisfies RuntimeMessage);
  }

  function reorderModule(moduleKey: ResumeModuleKey, event: DragEndEvent) {
    if (!draftResume || !event.over || event.active.id === event.over.id) {
      return;
    }
    const nextModules = draftResume.modules.map((module) => {
      if (module.key !== moduleKey) return module;
      const oldIndex = module.entries.findIndex((entry) => entry.id === event.active.id);
      const newIndex = module.entries.findIndex((entry) => entry.id === event.over?.id);
      return {
        ...module,
        entries: arrayMove(module.entries, oldIndex, newIndex)
      };
    });
    setDraftResume({
      ...draftResume,
      updatedAt: Date.now(),
      modules: nextModules
    });
  }

  function renderStructuredEditor() {
    if (!currentResume) {
      return <div className="empty-state">上传 PDF / DOC / DOCX 后开始使用</div>;
    }

    return (
      <div className="editor-shell">
        {currentResume.modules.map((module) => (
          <section key={module.key} className="module-block">
            <div className="module-head">
              <h3>{module.label}</h3>
              {module.key !== "profile" && (
                <button className="ghost-button" onClick={() => setDraftResume((prev) => (prev ? addEntry(prev, module.key) : prev))}>
                  新增条目
                </button>
              )}
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => reorderModule(module.key, event)}>
              <SortableContext items={module.entries.map((item) => item.id)} strategy={verticalListSortingStrategy}>
                {module.entries.map((entry) => (
                  <SortableEntryCard key={entry.id} entry={entry}>
                    {entry.fields.map((field) => (
                      <div key={field.id} className="field-row">
                        <input
                          className="field-label"
                          value={field.label}
                          onChange={(event) =>
                            setDraftResume((prev) =>
                              prev ? updateResumeField(prev, module.key, entry.id, field.id, { label: event.target.value }) : prev
                            )
                          }
                        />
                        <textarea
                          className="field-value"
                          value={Array.isArray(field.value) ? field.value.join("\n") : String(field.value)}
                          onChange={(event) =>
                            setDraftResume((prev) =>
                              prev
                                ? updateResumeField(prev, module.key, entry.id, field.id, {
                                    value: event.target.value
                                  })
                                : prev
                            )
                          }
                        />
                        <input
                          className="field-source"
                          placeholder="原文映射片段"
                          value={field.sourceExcerpt ?? ""}
                          onChange={(event) =>
                            setDraftResume((prev) =>
                              prev ? updateResumeField(prev, module.key, entry.id, field.id, { sourceExcerpt: event.target.value }) : prev
                            )
                          }
                        />
                        <label className="checkbox-row">
                          <input
                            type="checkbox"
                            checked={field.reusable}
                            onChange={(event) =>
                              setDraftResume((prev) =>
                                prev ? updateResumeField(prev, module.key, entry.id, field.id, { reusable: event.target.checked }) : prev
                              )
                            }
                          />
                          可复用
                        </label>
                        <button
                          className="danger-button"
                          onClick={() => setDraftResume((prev) => (prev ? removeField(prev, module.key, entry.id, field.id) : prev))}
                        >
                          删除字段
                        </button>
                      </div>
                    ))}
                    <button className="ghost-button" onClick={() => setDraftResume((prev) => (prev ? addField(prev, module.key, entry.id) : prev))}>
                      新增字段
                    </button>
                  </SortableEntryCard>
                ))}
              </SortableContext>
            </DndContext>
          </section>
        ))}
      </div>
    );
  }

  if (!appState) {
    return <div className="app-shell">加载中...</div>;
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>ApplyJob</h1>
          <p>{status}</p>
        </div>
        <button className="primary-button" onClick={handleSave} disabled={!draftResume}>
          保存
        </button>
      </header>

      <section className="panel-card">
        <label className="upload-box">
          上传简历
          <input type="file" accept=".pdf,.doc,.docx" onChange={(event) => void handleUpload(event.target.files)} />
        </label>
        <select
          className="resume-select"
          value={currentResume?.id ?? ""}
          onChange={(event) => void handleResumeSwitch(event.target.value)}
        >
          <option value="">选择当前简历</option>
          {appState.resumes.map((resume) => (
            <option key={resume.id} value={resume.id}>
              {resume.name}
            </option>
          ))}
        </select>
        <div className="action-row">
          <button className="primary-button" onClick={() => void handleAutofill()} disabled={!currentResume}>
            预填充
          </button>
          <button
            className="ghost-button"
            onClick={async () => {
              const fields = await scanCurrentPage();
              setUnfilled(
                fields
                  .filter((field) => field.isEmpty || (field.required && field.isEmpty))
                  .map((field) => ({
                    fieldId: field.id,
                    label: field.label || field.name || "未命名字段",
                    reason: field.collapsed ? "collapsed" : field.required ? "required" : "empty"
                  }))
              );
              setStatus("已刷新未填项");
            }}
          >
            刷新未填项
          </button>
        </div>
      </section>

      <section className="panel-card settings-card">
        <input
          className="settings-input"
          placeholder="OCR 接口地址"
          value={appState.settings.ocrEndpoint}
          onChange={(event) =>
            setAppState((prev) =>
              prev
                ? {
                    ...prev,
                    settings: { ...prev.settings, ocrEndpoint: event.target.value }
                  }
                : prev
            )
          }
          onBlur={async () => {
            if (appState) {
              await saveAppState(appState);
            }
          }}
        />
      </section>

      <section className="panel-card">
        <div className="tabs">
          <button className={activeTab === "structured" ? "tab active" : "tab"} onClick={() => setActiveTab("structured")}>
            标准化字段
          </button>
          <button className={activeTab === "raw" ? "tab active" : "tab"} onClick={() => setActiveTab("raw")}>
            简历原文
          </button>
        </div>
        {activeTab === "structured" ? (
          renderStructuredEditor()
        ) : (
          <pre className="raw-text">{currentResume?.rawText ?? "暂无原文"}</pre>
        )}
      </section>

      <section className="panel-card">
        <div className="module-head">
          <h3>未填项</h3>
          <button
            className="ghost-button"
            onClick={async () => {
              if (unfilled.length > 0) {
                await handleScrollToField(unfilled[0].fieldId);
              }
            }}
          >
            下一个未填项
          </button>
        </div>
        <div className="unfilled-list">
          {unfilled.length === 0 ? (
            <div className="empty-state">当前没有未填项</div>
          ) : (
            unfilled.map((item) => (
              <button key={`${item.fieldId}-${item.reason}`} className="unfilled-item" onClick={() => void handleScrollToField(item.fieldId)}>
                <span>{item.label}</span>
                <span className="reason-text">
                  {item.reason === "required"
                    ? "必填未填"
                    : item.reason === "collapsed"
                      ? "位于折叠区域"
                      : item.reason === "not_on_page"
                        ? "当前字段不在本页"
                        : item.reason === "match_failed"
                          ? "匹配失败"
                          : "空值"}
                </span>
              </button>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
