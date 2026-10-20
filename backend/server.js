const http = require("http");
const fs = require("fs");
const path = require("path");
const { runAnalysis } = require("./analyze");
const { hasGeminiKey, configuredModel } = require("./ai");
const { MAX_BODY_BYTES, redactSecrets } = require("./validate");

function loadEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv();

const PORT = Number(process.env.PORT || 8787);

function send(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => {
      chunks.push(chunk);
      if (Buffer.concat(chunks).length > MAX_BODY_BYTES) {
        const error = new Error("Payload too large.");
        error.status = 413;
        reject(error);
        req.destroy();
      }
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    send(res, 204, {});
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    send(res, 200, {
      ok: true,
      engine: hasGeminiKey() ? "gemini" : "heuristic",
      model: hasGeminiKey() ? configuredModel() : null,
      geminiConfigured: hasGeminiKey(),
      collectsPersonalData: false
    });
    return;
  }

  if (req.method === "GET" && (req.url === "/demo" || req.url === "/demo/")) {
    const demoPath = path.join(__dirname, "..", "demo", "sample-policy.html");
    const html = fs.readFileSync(demoPath, "utf8");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
    return;
  }

  if (req.method === "POST" && req.url === "/analyze") {
    try {
      let parsed;
      try {
        parsed = JSON.parse(await readBody(req));
      } catch (error) {
        const status = error.status || 400;
        send(res, status, { error: redactSecrets(error.message || "Invalid JSON body.") });
        return;
      }

      const analysis = await runAnalysis(parsed);
      send(res, 200, analysis);
    } catch (error) {
      const status = error.status || 500;
      send(res, status, { error: redactSecrets(error.message || "Analysis failed.") });
    }
    return;
  }

  send(res, 404, { error: "Not found." });
});

if (require.main === module) {
  server.listen(PORT, "127.0.0.1", () => {
    console.log(`TermsLens backend listening on http://127.0.0.1:${PORT}`);
    console.log(
      hasGeminiKey()
        ? `Gemini is configured (${configuredModel()}). /analyze will drop ungrounded claims.`
        : "GEMINI_API_KEY is not set. /analyze will use evidence-based heuristics."
    );
  });
}

module.exports = { server };
