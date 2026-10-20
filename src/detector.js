(() => {
  const TERMSLENS = globalThis.TERMSLENS;

  const URL_HINTS =
    /privacy|privacypolicy|terms|tos|legal|cookie|gdpr|conditions|eula|user-agreement|useragreement/i;

  const TITLE_HINTS =
    /privacy\s*policy|terms\s*(of|and|&)\s*(service|use|conditions)|cookie\s*policy|user\s*agreement|end\s*user\s*license/i;

  const HEADING_HINTS =
    /privacy policy|terms of service|terms of use|terms and conditions|terms & conditions|cookie policy|legal notice/i;

  function classifyPolicyType(haystack) {
    const text = String(haystack || "").toLowerCase();
    const hasPrivacy = /privacy/.test(text);
    const hasTerms = /terms|conditions|tos|eula|agreement/.test(text);
    const hasCookies = /cookie/.test(text);

    if (hasPrivacy && hasTerms) return "privacy_and_terms";
    if (hasPrivacy) return "privacy_policy";
    if (hasTerms) return "terms";
    if (hasCookies) return "cookie_policy";
    return "unknown";
  }

  function scoreDocument({ url, title, headings, bodyText }) {
    let score = 0;
    const reasons = [];

    if (URL_HINTS.test(url || "")) {
      score += 4;
      reasons.push("url");
    }
    if (TITLE_HINTS.test(title || "")) {
      score += 4;
      reasons.push("title");
    }
    if (HEADING_HINTS.test(headings || "")) {
      score += 3;
      reasons.push("headings");
    }

    const sample = String(bodyText || "").slice(0, 4000).toLowerCase();
    const signals = [
      "personal information",
      "personal data",
      "we collect",
      "information we collect",
      "your rights",
      "governing law",
      "limitation of liability",
      "how we use",
      "third parties",
      "cookies"
    ];
    const hits = signals.filter((signal) => sample.includes(signal)).length;
    if (hits >= 3) {
      score += 3;
      reasons.push("content");
    } else if (hits >= 1) {
      score += 1;
      reasons.push("weak-content");
    }

    return { score, reasons, isPolicy: score >= 4 };
  }

  function collectHeadings(doc) {
    return [...doc.querySelectorAll("h1, h2, h3")]
      .map((node) => node.innerText.trim())
      .filter(Boolean)
      .slice(0, 20)
      .join(" | ");
  }

  function detectPage(doc = document, href = location.href) {
    const title = doc.title || "";
    const headings = collectHeadings(doc);
    const bodyText = doc.body ? doc.body.innerText : "";
    const scored = scoreDocument({ url: href, title, headings, bodyText });
    const policyType = classifyPolicyType(`${href} ${title} ${headings}`);

    return {
      url: href,
      title,
      headings,
      ...scored,
      policyType: scored.isPolicy ? policyType : "none"
    };
  }

  function findPolicyLinks(doc = document, baseUrl = location.href) {
    const links = [...doc.querySelectorAll("a[href]")];
    const seen = new Set();
    const results = [];

    for (const anchor of links) {
      const label = `${anchor.innerText || ""} ${anchor.getAttribute("aria-label") || ""}`
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
      const href = anchor.href;
      if (!href || href.startsWith("javascript:") || href.startsWith("mailto:")) continue;

      const labelMatch = TERMSLENS.POLICY_LINK_LABELS.some((item) => label.includes(item));
      const urlMatch = URL_HINTS.test(href);
      if (!labelMatch && !urlMatch) continue;

      let absolute;
      try {
        absolute = new URL(href, baseUrl).toString();
      } catch {
        continue;
      }
      if (seen.has(absolute)) continue;
      seen.add(absolute);

      results.push({
        url: absolute,
        text: (anchor.innerText || label || "Policy link").trim().slice(0, 120),
        score: (labelMatch ? 2 : 0) + (urlMatch ? 1 : 0)
      });
    }

    return results.sort((a, b) => b.score - a.score).slice(0, 8);
  }

  TERMSLENS.detector = {
    classifyPolicyType,
    scoreDocument,
    detectPage,
    findPolicyLinks
  };
})();
