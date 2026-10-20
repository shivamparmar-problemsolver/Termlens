const { analyzePolicy } = require("./heuristic");
const { analyzeWithGemini, hasGeminiKey } = require("./ai");
const { asSafeError, isRetryableGeminiError, validatePayload } = require("./validate");

function withFallback(payload, safe, extra = {}) {
  const analysis = analyzePolicy(payload);
  analysis.warning = `${safe.message} Heuristic analysis was used instead.`;
  analysis.fallbackReason = safe.code;
  return { ...analysis, ...extra };
}

async function runAnalysis(input, options = {}) {
  const payload = validatePayload(input);

  if (!hasGeminiKey()) {
    const analysis = analyzePolicy(payload);
    analysis.uncertainty =
      analysis.findings.length === 0
        ? "Not enough quoted policy language was found to confirm specific risks."
        : analysis.uncertainty || null;
    return analysis;
  }

  try {
    const gemini = await analyzeWithGemini(payload, options);
    if (!gemini) return analyzePolicy(payload);

    if (gemini.findings.length === 0 && gemini.summary.length === 0) {
      const fallback = analyzePolicy(payload);
      fallback.uncertainty =
        "Gemini did not return enough quoted evidence from the supplied policy. Heuristic findings with matching quotes are shown instead.";
      fallback.warning = fallback.uncertainty;
      return fallback;
    }

    return gemini;
  } catch (error) {
    const safe = asSafeError(error);
    if (isRetryableGeminiError(error) || options.alwaysFallbackOnError !== false) {
      return withFallback(payload, safe);
    }
    throw error;
  }
}

module.exports = {
  runAnalysis
};
