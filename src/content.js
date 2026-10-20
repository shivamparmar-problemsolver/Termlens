(() => {
  if (globalThis.__TERMSLENS_CONTENT__) return;
  globalThis.__TERMSLENS_CONTENT__ = true;

  const TERMSLENS = globalThis.TERMSLENS;

  function snapshot() {
    const detection = TERMSLENS.detector.detectPage();
    const text = TERMSLENS.extractor.extractFromDocument();
    const links = TERMSLENS.detector.findPolicyLinks();

    return {
      detection,
      text,
      links,
      pageUrl: location.href,
      pageTitle: document.title
    };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "TERMSLENS_PING") {
      sendResponse({ ok: true });
      return true;
    }
    if (message?.type === "TERMSLENS_SNAPSHOT") {
      sendResponse(snapshot());
      return true;
    }
    return false;
  });
})();
