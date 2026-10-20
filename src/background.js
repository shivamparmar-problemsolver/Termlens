importScripts("constants.js", "heuristic.js");

const DEFAULT_BACKEND_URL = TERMSLENS.DEFAULT_BACKEND_URL;
const MAX_POLICY_CHARS = 60000;
const MIN_POLICY_CHARS = 400;

const UNSUPPORTED_SCHEMES = [
  "chrome:",
  "chrome-extension:",
  "edge:",
  "about:",
  "devtools:",
  "view-source:"
];

async function getSettings() {
  const stored = await chrome.storage.sync.get({
    backendUrl: DEFAULT_BACKEND_URL,
    preferLocal: false
  });
  return stored;
}

function isUnsupportedUrl(url) {
  try {
    const parsed = new URL(url);
    return UNSUPPORTED_SCHEMES.includes(`${parsed.protocol}`);
  } catch {
    return true;
  }
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "TERMSLENS_PING" });
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [
        "src/constants.js",
        "src/detector.js",
        "src/extractor.js",
        "src/heuristic.js",
        "src/content.js"
      ]
    });
  }
}

async function requestSnapshot(tabId) {
  await ensureContentScript(tabId);
  return chrome.tabs.sendMessage(tabId, { type: "TERMSLENS_SNAPSHOT" });
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchPolicyText(url) {
  const response = await fetch(url, { credentials: "omit" });
  if (!response.ok) {
    throw new Error(`Could not fetch policy page (${response.status}).`);
  }
  const html = await response.text();
  const text = stripHtml(html).slice(0, MAX_POLICY_CHARS);
  return { url, text };
}

function pickBestSource(snapshot) {
  const currentIsPolicy = Boolean(snapshot.detection?.isPolicy);
  const currentText = snapshot.text || "";
  if (currentIsPolicy && currentText.length >= MIN_POLICY_CHARS) {
    return {
      url: snapshot.pageUrl,
      title: snapshot.pageTitle,
      policyType: snapshot.detection.policyType,
      text: currentText,
      origin: "current-page"
    };
  }

  return null;
}

async function resolvePolicy(snapshot) {
  const current = pickBestSource(snapshot);
  if (current) return current;

  const candidates = snapshot.links || [];
  for (const link of candidates) {
    try {
      const fetched = await fetchPolicyText(link.url);
      if (fetched.text.length >= MIN_POLICY_CHARS) {
        return {
          url: fetched.url,
          title: link.text || snapshot.pageTitle,
          policyType: /privacy/i.test(`${link.text} ${link.url}`)
            ? "privacy_policy"
            : /cookie/i.test(`${link.text} ${link.url}`)
              ? "cookie_policy"
              : "terms",
          text: fetched.text,
          origin: "linked-page"
        };
      }
    } catch {
      continue;
    }
  }

  if ((snapshot.text || "").length >= MIN_POLICY_CHARS && snapshot.detection?.score >= 2) {
    return {
      url: snapshot.pageUrl,
      title: snapshot.pageTitle,
      policyType: snapshot.detection.policyType || "unknown",
      text: snapshot.text,
      origin: "weak-current-page"
    };
  }

  return null;
}

function fallbackAnalyze(policy) {
  const analysis = TERMSLENS.heuristic.analyzePolicy(policy);
  analysis.engine = "heuristic-extension";
  return analysis;
}

function evidenceIsGrounded(text, evidence) {
  if (!evidence) return false;
  const normalize = (value) => value.toLowerCase().replace(/\s+/g, " ").replace(/[….]/g, "").trim();
  const haystack = normalize(text);
  const needle = normalize(evidence).slice(0, 80);
  return needle.length >= 12 && haystack.includes(needle.slice(0, 48));
}

function sanitizeAnalysis(analysis, sourceText) {
  const findings = Array.isArray(analysis.findings)
    ? analysis.findings.filter((item) => evidenceIsGrounded(sourceText, item.evidence))
    : [];
  const summary = Array.isArray(analysis.summary)
    ? analysis.summary
        .map((item) => String(item || "").trim())
        .filter((item) => item && evidenceIsGrounded(sourceText, item))
        .slice(0, 5)
    : [];

  return {
    ...analysis,
    findings,
    summary
  };
}

async function analyzeWithBackend(policy, settings) {
  const endpoint = `${settings.backendUrl.replace(/\/$/, "")}/analyze`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: policy.url,
      title: policy.title,
      policyType: policy.policyType,
      text: policy.text
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || `Backend error (${response.status})`);
  }

  const payload = await response.json();
  return sanitizeAnalysis(payload, policy.text);
}

async function analyzeTab() {
  const tab = await getActiveTab();
  if (!tab?.id || !tab.url) {
    return { status: "error", code: "NO_TAB", message: "No active tab was found." };
  }

  if (isUnsupportedUrl(tab.url)) {
    return {
      status: "unsupported",
      code: "UNSUPPORTED",
      message: "TermsLens cannot read this type of page. Open a regular website and try again.",
      url: tab.url
    };
  }

  let snapshot;
  try {
    snapshot = await requestSnapshot(tab.id);
  } catch (error) {
    return {
      status: "error",
      code: "CONTENT_SCRIPT",
      message: "Could not read this page. Try refreshing it, then open TermsLens again.",
      details: String(error?.message || error)
    };
  }

  const policy = await resolvePolicy(snapshot);
  if (!policy) {
    return {
      status: "missing",
      code: "NO_POLICY",
      message: "No Terms & Conditions or Privacy Policy was found on this page.",
      url: tab.url,
      title: tab.title,
      links: snapshot.links || []
    };
  }

  const settings = await getSettings();
  let analysis;
  let warning = null;

  if (settings.preferLocal) {
    analysis = fallbackAnalyze(policy);
  } else {
    try {
      analysis = await analyzeWithBackend(policy, settings);
    } catch (error) {
      analysis = fallbackAnalyze(policy);
      warning =
        "The local backend was unavailable, so TermsLens used on-device heuristics. Start the backend for AI summaries.";
      analysis.backendError = String(error?.message || error);
    }
  }

  analysis.origin = policy.origin;
  analysis.pageUrl = tab.url;
  analysis.pageTitle = tab.title;

  return {
    status: "ok",
    warning,
    analysis
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "TERMSLENS_ANALYZE") {
    analyzeTab()
      .then((result) => sendResponse(result))
      .catch((error) =>
        sendResponse({
          status: "error",
          code: "UNKNOWN",
          message: "Analysis failed.",
          details: String(error?.message || error)
        })
      );
    return true;
  }
  return false;
});
