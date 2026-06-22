import { escapeHtml } from "../core/utils.js";
import { getCurrentResume } from "../core/resume-model.js";
import { reasonText } from "./view-helpers.js";

function entryDisplayTitle(entry) {
  const primaryField = entry.fields.find((field) => field.label && field.value);
  const text = String(primaryField?.value || entry.title || "未命名条目").replace(/\s+/g, " ").trim();
  if (text.length <= 28) {
    return text;
  }
  return `${text.slice(0, 28)}...`;
}

function renderModule(module) {
  return `
    <section class="module-block">
      <div class="module-head">
        <h3>${module.label}</h3>
        ${module.key !== "profile" ? `<button class="ghost-button" data-action="add-entry" data-module="${module.key}">新增条目</button>` : ""}
      </div>
      ${module.entries
        .map(
          (entry) => `
          <div class="entry-card" draggable="true" data-entry="${entry.id}" data-module="${module.key}">
            <div class="entry-head">
              <span class="entry-title">${escapeHtml(entryDisplayTitle(entry))}</span>
              <button class="drag-handle" data-action="drag-hint" aria-label="拖拽排序" title="拖拽排序">⋮⋮</button>
            </div>
            ${entry.fields
              .map(
                (field) => `
                <div class="field-row">
                  <input class="field-label" data-action="field-label" data-module="${module.key}" data-entry="${entry.id}" data-field="${field.id}" value="${escapeHtml(field.label)}" />
                  <textarea class="field-value" data-action="field-value" data-module="${module.key}" data-entry="${entry.id}" data-field="${field.id}">${escapeHtml(
                    Array.isArray(field.value) ? field.value.join("\n") : String(field.value || "")
                  )}</textarea>
                  <input class="field-source" data-action="field-source" data-module="${module.key}" data-entry="${entry.id}" data-field="${field.id}" placeholder="原文映射片段" value="${escapeHtml(field.sourceExcerpt || "")}" />
                  <label class="checkbox-row">
                    <input type="checkbox" data-action="field-reusable" data-module="${module.key}" data-entry="${entry.id}" data-field="${field.id}" ${field.reusable ? "checked" : ""} />
                    可复用
                  </label>
                  <button class="danger-button" data-action="delete-field" data-module="${module.key}" data-entry="${entry.id}" data-field="${field.id}">删除字段</button>
                </div>
              `
              )
              .join("")}
            <button class="ghost-button" data-action="add-field" data-module="${module.key}" data-entry="${entry.id}">新增字段</button>
          </div>
        `
        )
        .join("")}
    </section>
  `;
}

function renderStructuredTab(resume) {
  if (!resume) {
    return `<div class="empty-state">上传 PDF / DOC / DOCX 后开始使用</div>`;
  }
  return `<div class="editor-shell">${resume.modules.map((module) => renderModule(module)).join("")}</div>`;
}

function renderRawTab(resume) {
  return `<pre class="raw-text">${escapeHtml(resume?.rawText || "暂无原文")}</pre>`;
}

export function renderPanel(state) {
  const app = document.getElementById("app");
  if (!app || !state.appState) return;
  const resume = getCurrentResume(state);
  app.innerHTML = `
    <div class="topbar">
      <div>
        <h1>ApplyJob</h1>
        <p>${escapeHtml(state.status)}</p>
      </div>
      <button class="primary-button" data-action="save" ${resume ? "" : "disabled"}>保存</button>
    </div>

    <section class="panel-card">
      <label class="upload-box">
        上传简历
        <input id="resume-upload" type="file" accept=".pdf,.doc,.docx" />
      </label>
      <select class="resume-select" id="resume-select">
        <option value="">选择当前简历</option>
        ${state.appState.resumes
          .map((item) => `<option value="${item.id}" ${resume?.id === item.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`)
          .join("")}
      </select>
      <div class="action-row">
        <button class="primary-button" data-action="autofill" ${resume ? "" : "disabled"}>预填充</button>
        <button class="ghost-button" data-action="refresh-unfilled">刷新未填项</button>
      </div>
    </section>

    <section class="panel-card">
      <div class="tabs">
        <button class="tab ${state.activeTab === "structured" ? "active" : ""}" data-action="tab" data-tab="structured">标准化字段</button>
        <button class="tab ${state.activeTab === "raw" ? "active" : ""}" data-action="tab" data-tab="raw">简历原文</button>
      </div>
      ${
        state.activeTab === "structured"
          ? `
            <div class="template-bar">
              <input class="template-input" id="template-name" placeholder="输入模板名称" value="${escapeHtml(state.templateName || "")}" />
              <button class="ghost-button" data-action="save-template" ${resume ? "" : "disabled"}>保存模板</button>
            </div>
            ${renderStructuredTab(resume)}
          `
          : renderRawTab(resume)
      }
    </section>

    <section class="panel-card">
      <div class="module-head">
        <h3>未填项</h3>
        <button class="ghost-button" data-action="next-unfilled">下一个未填项</button>
      </div>
      <div class="unfilled-list">
        ${
          state.unfilled.length === 0
            ? `<div class="empty-state">当前没有未填项</div>`
            : state.unfilled
                .map(
                  (item) => `
                  <button class="unfilled-item" data-action="scroll-unfilled" data-field-id="${item.fieldId}">
                    <span>${escapeHtml(item.label)}</span>
                    <span class="reason-text">${reasonText(item.reason)}</span>
                  </button>
                `
                )
                .join("")
        }
      </div>
    </section>
  `;
}
