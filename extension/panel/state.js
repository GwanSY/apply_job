export function createPanelState() {
  return {
    appState: null,
    draftResume: null,
    learnedValues: [],
    unfilled: [],
    activeTab: "structured",
    status: "准备就绪",
    drag: null,
    templateName: ""
  };
}
