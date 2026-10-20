const TERMSLENS = globalThis.TERMSLENS || {};

TERMSLENS.DEFAULT_BACKEND_URL = "http://127.0.0.1:8787";
TERMSLENS.MAX_POLICY_CHARS = 60000;
TERMSLENS.MIN_POLICY_CHARS = 400;

TERMSLENS.UNSUPPORTED_SCHEMES = [
  "chrome:",
  "chrome-extension:",
  "edge:",
  "about:",
  "devtools:",
  "view-source:",
  "file:"
];

TERMSLENS.POLICY_LINK_LABELS = [
  "privacy policy",
  "privacy",
  "terms of service",
  "terms of use",
  "terms and conditions",
  "terms & conditions",
  "cookie policy",
  "legal",
  "user agreement",
  "eula"
];

TERMSLENS.CATEGORIES = {
  data_collection: {
    title: "Personal data collection",
    description: "The policy describes collecting personal or usage data."
  },
  data_sharing: {
    title: "Data sharing or selling",
    description: "The policy describes sharing, selling, or disclosing data to others."
  },
  auto_renewal: {
    title: "Automatic renewals and subscriptions",
    description: "The policy mentions auto-renewal, recurring billing, or subscriptions."
  },
  hidden_fees: {
    title: "Fees and cancellation charges",
    description: "The policy mentions fees, non-refundable charges, or cancellation costs."
  },
  tracking: {
    title: "Tracking and advertising",
    description: "The policy describes cookies, pixels, fingerprinting, or ad tracking."
  },
  excessive_permissions: {
    title: "Sensitive permissions",
    description: "The policy mentions access to location, camera, microphone, contacts, or similar data."
  },
  unclear_clauses: {
    title: "Unclear or one-sided clauses",
    description: "The policy includes broad discretion, unilateral changes, or limited user rights."
  }
};

globalThis.TERMSLENS = TERMSLENS;
