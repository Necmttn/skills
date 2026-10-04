/** Secret and privacy scan over bundle text. Pure. Findings never carry the matched value. */

export interface Finding {
  readonly severity: "error" | "warning";
  readonly pattern: string;
  readonly file: string;
  readonly line: number;
}

interface Rule {
  readonly name: string;
  readonly severity: Finding["severity"];
  readonly regex: RegExp;
  /** Drop a match that is clearly not a secret (placeholder, allowlisted address). */
  readonly keep?: (match: RegExpExecArray) => boolean;
}

/** Generic mailbox names: not a person. */
export const EMAIL_LOCAL_ALLOW: ReadonlyArray<string> = [
  "noreply", "no-reply", "donotreply", "support", "help", "hello", "info", "contact", "privacy", "legal", "security",
  "abuse", "admin", "team", "sales", "press", "feedback", "git", "user", "you", "name", "email", "example", "test",
];
const EMAIL_DOMAIN_ALLOW = /(^|\.)(example\.(com|org|net)|users\.noreply\.github\.com|test|invalid|localhost)$/i;
const NOT_A_TLD = /\.(png|jpe?g|gif|webp|svg|pdf|md|ts|js|json|jsonl)$/i;

const placeholder = (value: string): boolean =>
  /^[$<{[(%*.x_-]/i.test(value) || /^(your|my|the|some|token|secret|password|changeme|redacted|null|none|true|false|string|required|optional)/i.test(value) ||
  /^(.)\1*$/.test(value);

export const RULES: ReadonlyArray<Rule> = [
  { name: "private-key-block", severity: "error", regex: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY( BLOCK)?-----/g },
  { name: "sk-api-key", severity: "error", regex: /\bsk-[A-Za-z0-9_-]{20,}/g },
  { name: "stripe-live-key", severity: "error", regex: /\b[sr]k_live_[A-Za-z0-9]{8,}/g },
  { name: "github-token", severity: "error", regex: /\b(gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/g },
  { name: "slack-token", severity: "error", regex: /\bxox[bap]-[A-Za-z0-9-]{10,}/g },
  { name: "aws-access-key-id", severity: "error", regex: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: "jwt", severity: "error", regex: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g },
  {
    name: "authorization-bearer",
    severity: "error",
    regex: /Authorization["']?\s*[:=]\s*["'`]?Bearer\s+([^\s"'`]+)/gi,
    keep: (m) => !placeholder(m[1] ?? "") && (m[1] ?? "").length >= 12,
  },
  {
    name: "password-assignment",
    severity: "error",
    regex: /\bpassword["']?\s*[:=]\s*["'`]?([^\s"'`,;)]*)/gi,
    // an empty value, a placeholder, or a type name is not a stored credential
    keep: (m) => (m[1] ?? "").length >= 4 && !placeholder(m[1] ?? ""),
  },
  {
    name: "email-address",
    severity: "warning",
    regex: /\b([A-Za-z0-9._%+-]+)@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)\b/g,
    keep: (m) => {
      const [local, domain] = [(m[1] ?? "").toLowerCase(), m[2] ?? ""];
      return !EMAIL_LOCAL_ALLOW.includes(local) && !EMAIL_DOMAIN_ALLOW.test(domain) && !NOT_A_TLD.test(domain) && /\.[A-Za-z]{2,}$/.test(domain);
    },
  },
  { name: "absolute-home-path", severity: "warning", regex: /(\/Users\/|\/home\/)(?!<|\$|\{|you\b|name\b|me\b|user\b|username\b|shared\b)[A-Za-z0-9._-]+\//gi },
];

const NUL = String.fromCharCode(0);
export const UNSCANNABLE_BINARY = "unscannable-binary";

/**
 * One finding per (rule, line). Sorted by line, then rule order. A NUL byte never hides a secret:
 * NULs are dropped for matching (UTF-16 text then reads as plain text), the text is scanned anyway,
 * and the file gets an `unscannable-binary` warning because a binary file is not expected in a bundle.
 */
export const scanText = (file: string, raw: string): ReadonlyArray<Finding> => {
  const binary = raw.includes(NUL);
  const text = binary ? raw.replaceAll(NUL, "") : raw;
  const findings: Array<Finding> = binary ? [{ severity: "warning", pattern: UNSCANNABLE_BINARY, file, line: 1 }] : [];
  text.split("\n").forEach((line, index) => {
    for (const rule of RULES) {
      rule.regex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = rule.regex.exec(line)) !== null) {
        if (match[0] === "") rule.regex.lastIndex++;
        if (rule.keep && !rule.keep(match)) continue;
        findings.push({ severity: rule.severity, pattern: rule.name, file, line: index + 1 });
        break;
      }
    }
  });
  return findings;
};
