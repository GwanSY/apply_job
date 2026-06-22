import { scanFields } from "./scanner.js";

const learnedBuffer = new Map();

function inferModule(label) {
  const text = (label || "").toLowerCase();
  if (/(name|email|phone|city|linkedin|github|姓名|邮箱|电话)/.test(text)) return "profile";
  if (/(school|university|degree|major|学校|学历|学位|专业)/.test(text)) return "education";
  if (/(company|employer|title|role|职责|公司|职位|工作)/.test(text)) return "experience";
  if (/(project|项目)/.test(text)) return "projects";
  if (/(skill|技能)/.test(text)) return "skills";
  if (/(certificate|证书)/.test(text)) return "certificates";
  if (/(language|语言)/.test(text)) return "languages";
  return "other";
}

export function captureLearnedValues() {
  for (const field of scanFields()) {
    if (field.valueText && String(field.valueText).trim()) {
      learnedBuffer.set(field.label || field.name, {
        label: field.label || field.name || "未命名字段",
        value: field.valueText,
        moduleKey: inferModule(field.label || field.name),
        updatedAt: Date.now()
      });
    }
  }

  chrome.runtime.sendMessage({
    type: "LEARNED_VALUES",
    values: Array.from(learnedBuffer.values())
  });
}
