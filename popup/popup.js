const app = document.getElementById("app");
const siteTitle = document.getElementById("site-title");
const siteUrl = document.getElementById("site-url");
const statusChip = document.getElementById("status-chip");
const analyzeBtn = document.getElementById("analyze-btn");

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function setChip(text, tone = "") {
  statusChip.textContent = text;
  statusChip.className = `chip ${tone}`.trim();
}

function renderState({ title, body, actionLabel }) {
  app.innerHTML = `
    <section class="card state">
      <div class="pulse-ring"></div>
      <h3>${escapeHtml(title)}</h3>
      <p class="muted">${escapeHtml(body)}</p>
      ${actionLabel ? `<button class="primary-btn" id="retry-btn" type="button">${escapeHtml(actionLabel)}</button>` : ""}
    </section>
  `;
  const retry = document.getElementById("retry-btn");
  if (retry) retry.addEventListener("click", analyze);
}

function policyLabel(type) {
  const labels = {
    privacy_policy: "Privacy Policy",
    terms: "Terms",
    cookie_policy: "Cookie Policy",
    privacy_and_terms: "Privacy & Terms",
    unknown: "Policy text"
  };
  return labels[type] || "Policy text";
}

function renderAnalysis(result) {
  const analysis = result.analysis;
  const findings = analysis.findings || [];
  const highCount = findings.filter((item) => item.severity === "high").length;
  const summary = (analysis.summary || []).slice(0, 5);

  const notices = [result.warning, analysis.warning, analysis.uncertainty].filter(Boolean);
  const warning = notices.length
    ? notices.map((item) => `<div class="banner">${escapeHtml(item)}</div>`).join("")
    : "";

  const summaryItems = summary.length
    ? summary.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
    : "<li>Not enough grounded sentences were available for a five-point summary.</li>";

  const findingItems = findings.length
    ? findings
        .map(
          (item) => `
        <article class="finding">
          <div class="finding-head">
            <strong>${escapeHtml(item.title)}</strong>
            <span class="severity ${escapeHtml(item.severity)}">${escapeHtml(item.severity)}</span>
          </div>
          <p>${escapeHtml(item.explanation || "")}</p>
          <blockquote>${escapeHtml(item.evidence)}</blockquote>
        </article>`
        )
        .join("")
    : `<p class="muted">No evidence-backed red flags were found in the extracted text.</p>`;

  app.innerHTML = `
    ${warning}
    <section class="card summary-card">
      <p class="label">${escapeHtml(policyLabel(analysis.policyType))} · ${escapeHtml(analysis.engine)}</p>
      <h3>Five things this policy actually says</h3>
      <ol>${summaryItems}</ol>
    </section>
    <section class="card flags-card">
      <div class="finding-head">
        <h3>Red flags</h3>
        <span class="chip ${highCount ? "bad" : "ok"}">${findings.length} finding${findings.length === 1 ? "" : "s"}</span>
      </div>
      ${findingItems}
    </section>
  `;

  setChip(highCount ? `${highCount} high` : "Reviewed", highCount ? "bad" : "ok");
}

async function hydrateSite() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  siteTitle.textContent = tab?.title || "Unknown page";
  siteUrl.textContent = tab?.url || "";
}

async function analyze() {
  analyzeBtn.disabled = true;
  setChip("Scanning", "warn");
  renderState({
    title: "Reading the policy",
    body: "Extracting page text and looking for quoted evidence. This stays limited to the policy content."
  });

  try {
    const result = await chrome.runtime.sendMessage({ type: "TERMSLENS_ANALYZE" });
    if (!result) {
      throw new Error("No response from the extension worker.");
    }

    if (result.status === "ok") {
      renderAnalysis(result);
      return;
    }

    if (result.status === "missing") {
      setChip("Not found", "warn");
      renderState({
        title: "No policy found",
        body: result.message,
        actionLabel: "Scan again"
      });
      return;
    }

    if (result.status === "unsupported") {
      setChip("Unsupported", "bad");
      renderState({
        title: "Unsupported page",
        body: result.message,
        actionLabel: "Try again"
      });
      return;
    }

    setChip("Error", "bad");
    renderState({
      title: "Could not analyze this page",
      body: result.message || "Something went wrong.",
      actionLabel: "Retry"
    });
  } catch (error) {
    setChip("Error", "bad");
    renderState({
      title: "Could not analyze this page",
      body: error.message || "Something went wrong.",
      actionLabel: "Retry"
    });
  } finally {
    analyzeBtn.disabled = false;
  }
}

analyzeBtn.addEventListener("click", analyze);
hydrateSite().then(analyze);
