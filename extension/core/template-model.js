import { uid } from "./utils.js";

export function createTemplateFromResume(resume, name) {
  return {
    id: uid(),
    name: name.trim(),
    sourceResumeId: resume.id,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    modules: structuredClone(resume.modules)
  };
}
