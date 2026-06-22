export async function getActiveTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

export async function scanCurrentPage() {
  const tabId = await getActiveTabId();
  if (!tabId) return [];
  const response = await chrome.tabs.sendMessage(tabId, { type: "SCAN_FORM" });
  return response.fields || [];
}

export async function runPageAutofill(tabId, suggestions, resume) {
  return await chrome.tabs.sendMessage(tabId, {
    type: "AUTOFILL_FORM",
    suggestions,
    resume
  });
}

export async function scrollToField(fieldId) {
  const tabId = await getActiveTabId();
  if (!tabId) return;
  await chrome.tabs.sendMessage(tabId, { type: "SCROLL_TO_FIELD", fieldId });
}
