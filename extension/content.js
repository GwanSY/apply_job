(async () => {
  const module = await import(chrome.runtime.getURL("content/app.js"));
  module.initContentApp();
})();
