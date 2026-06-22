chrome.runtime.onInstalled.addListener(async () => {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

chrome.tabs.onUpdated.addListener(async (tabId, info) => {
  if (info.status === "complete") {
    try {
      await chrome.sidePanel.setOptions({
        tabId,
        path: "panel.html",
        enabled: true
      });
    } catch {
      // Ignore pages that do not allow side panel options.
    }
  }
});
