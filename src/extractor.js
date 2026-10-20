(() => {
  const TERMSLENS = globalThis.TERMSLENS;

  const NOISE_SELECTORS = [
    "script",
    "style",
    "noscript",
    "nav",
    "footer",
    "header",
    "iframe",
    "svg",
    "form",
    "[role='navigation']",
    "[role='banner']"
  ].join(",");

  function normalizeText(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
  }

  function extractFromDocument(doc = document) {
    const clone = doc.body ? doc.body.cloneNode(true) : null;
    if (!clone) return "";

    clone.querySelectorAll(NOISE_SELECTORS).forEach((node) => node.remove());

    const preferred = clone.querySelector(
      "article, main, [role='main'], .policy, .legal, #policy, #legal, #privacy, #terms"
    );
    const source = preferred || clone;
    const text = normalizeText(source.innerText || "");
    return text.slice(0, TERMSLENS.MAX_POLICY_CHARS);
  }

  function extractFromHtml(html, pageUrl) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const text = extractFromDocument(doc);
    const detection = TERMSLENS.detector.detectPage(doc, pageUrl);
    return { text, detection };
  }

  TERMSLENS.extractor = {
    normalizeText,
    extractFromDocument,
    extractFromHtml
  };
})();
