(() => {
  const TERMSLENS = globalThis.TERMSLENS;

  const RULES = [
    {
      category: "data_collection",
      severity: "medium",
      title: "Personal data is collected",
      patterns: [
        /we collect .{0,80}(personal (data|information)|email|name|address|phone)/i,
        /personal (data|information) .{0,60}(collect|process|obtain)/i,
        /(collect|gather|obtain) .{0,60}(ip address|device identifier|location|usage data)/i
      ]
    },
    {
      category: "data_sharing",
      severity: "high",
      title: "Data may be shared or sold",
      patterns: [
        /(share|disclose|sell|transfer).{0,80}(personal (data|information)|your data|information)/i,
        /third[- ]part(y|ies).{0,80}(share|provide|disclose|advertis)/i,
        /we (may|might|can) sell .{0,40}(data|information)/i
      ]
    },
    {
      category: "auto_renewal",
      severity: "high",
      title: "Automatic renewal or subscription billing",
      patterns: [
        /auto(matic(ally)?)?[- ]renew/i,
        /recurring (billing|payment|charge)/i,
        /subscription .{0,80}(renew|automatically|billed)/i
      ]
    },
    {
      category: "hidden_fees",
      severity: "high",
      title: "Fees or cancellation charges",
      patterns: [
        /(cancellation|termination|early[- ]termination) fee/i,
        /non[- ]refundable/i,
        /(restocking|service|hidden) fee/i,
        /you (will|may) be charged/i
      ]
    },
    {
      category: "tracking",
      severity: "medium",
      title: "Tracking technologies are used",
      patterns: [
        /cookies? .{0,80}(track|advertis|analytics|third)/i,
        /(tracking pixel|web beacon|fingerprinting)/i,
        /advertising (partners|networks|identifiers)/i
      ]
    },
    {
      category: "excessive_permissions",
      severity: "medium",
      title: "Sensitive device or account access",
      patterns: [
        /(precise )?location|geolocation|gps/i,
        /camera|microphone|contacts|address book/i,
        /device (id|identifier)|advertising id/i
      ]
    },
    {
      category: "unclear_clauses",
      severity: "low",
      title: "Broad or one-sided legal language",
      patterns: [
        /at our (sole|absolute) discretion/i,
        /we may (update|change|modify) .{0,60}without (prior )?notice/i,
        /class action waiver|waive .{0,40}class action/i,
        /binding arbitration/i
      ]
    }
  ];

  function excerptAround(text, index, length) {
    const start = Math.max(0, index - 80);
    const end = Math.min(text.length, index + length + 120);
    let snippet = text.slice(start, end).replace(/\s+/g, " ").trim();
    if (start > 0) snippet = `…${snippet}`;
    if (end < text.length) snippet = `${snippet}…`;
    return snippet;
  }

  function uniqueEvidence(items) {
    const seen = new Set();
    return items.filter((item) => {
      const key = `${item.category}:${item.evidence.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function analyzeText(text) {
    const source = String(text || "");
    const findings = [];

    for (const rule of RULES) {
      for (const pattern of rule.patterns) {
        const match = source.match(pattern);
        if (!match || match.index == null) continue;
        findings.push({
          id: `${rule.category}-${findings.length + 1}`,
          category: rule.category,
          title: rule.title,
          severity: rule.severity,
          explanation: TERMSLENS.CATEGORIES[rule.category].description,
          evidence: excerptAround(source, match.index, match[0].length)
        });
        break;
      }
    }

    return uniqueEvidence(findings);
  }

  function groundedSummary(text, findings) {
    const sentences = String(text || "")
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.replace(/\s+/g, " ").trim())
      .filter((sentence) => sentence.length > 40 && sentence.length < 280);

    const bullets = [];
    const used = new Set();

    for (const finding of findings) {
      const sentence = sentences.find((item) =>
        item.toLowerCase().includes(finding.evidence.replace(/^[…]|[…]$/g, "").slice(0, 40).toLowerCase())
      );
      const candidate = sentence || finding.evidence;
      if (used.has(candidate)) continue;
      used.add(candidate);
      bullets.push(candidate);
      if (bullets.length === 5) return bullets;
    }

    for (const sentence of sentences) {
      if (used.has(sentence)) continue;
      const useful =
        /we (collect|use|share|store|may)|your (information|data|rights)|cookies|subscription|payment|third part/i.test(
          sentence
        );
      if (!useful) continue;
      used.add(sentence);
      bullets.push(sentence);
      if (bullets.length === 5) break;
    }

    return bullets;
  }

  function analyzePolicy({ text, url, title, policyType }) {
    const findings = analyzeText(text);
    const summary = groundedSummary(text, findings);

    return {
      engine: "heuristic",
      url,
      title,
      policyType: policyType || "unknown",
      summary,
      findings,
      analyzedAt: new Date().toISOString(),
      textLength: String(text || "").length
    };
  }

  TERMSLENS.heuristic = {
    analyzePolicy,
    analyzeText,
    groundedSummary
  };
})();
