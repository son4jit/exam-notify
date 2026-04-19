// script.js — Telegram Exam Reminder
// Reads config.yml + exams.json, checks for tomorrow's exams, sends Telegram message.
// Environment variables required: TELEGRAM_TOKEN, CHAT_ID

const https = require("https");
const fs    = require("fs");
const path  = require("path");

// ── Env vars ──────────────────────────────────────────────────────────────────
const TOKEN   = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

if (!TOKEN || !CHAT_ID) {
  console.error("❌  Missing TELEGRAM_TOKEN or CHAT_ID environment variables.");
  process.exit(1);
}

// ── Minimal YAML parser (no external deps) ────────────────────────────────────
// Supports simple key: "value" pairs and nested blocks (indented keys).
function parseYaml(text) {
  const result = {};
  const lines  = text.split("\n");
  let current  = result;
  const stack  = [{ obj: result, indent: -1 }];

  for (let raw of lines) {
    const line = raw.replace(/\s*#.*$/, "").trimEnd(); // strip comments
    if (!line.trim()) continue;

    const indent  = line.search(/\S/);
    const trimmed = line.trim();

    // Pop stack back to correct parent
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }
    current = stack[stack.length - 1].obj;

    if (trimmed.endsWith(":")) {
      // New nested object
      const key  = trimmed.slice(0, -1);
      current[key] = {};
      stack.push({ obj: current[key], indent });
    } else if (trimmed.includes(": ")) {
      const colonIdx = trimmed.indexOf(": ");
      const key      = trimmed.slice(0, colonIdx).trim();
      let   val      = trimmed.slice(colonIdx + 2).trim();
      // Strip surrounding quotes
      if ((val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      current[key] = val;
    } else if (trimmed.startsWith("|")) {
      // Block scalar — collect following indented lines
      const key       = trimmed.split(":")[0].trim();
      const baseIndent = indent;
      const bodyLines  = [];
      // peek ahead handled outside; we'll collect via a second pass below
      current[key + "__block"] = true; // marker
      current[key]             = "";
    }
  }

  // Second pass for block scalars (multiline values after |)
  const raw2 = text.split("\n");
  for (let i = 0; i < raw2.length; i++) {
    const l = raw2[i];
    const m = l.match(/^(\s*)(\w+):\s*\|/);
    if (!m) continue;
    const blockIndent = m[1].length;
    const blockKey    = m[2];
    const bodyLines   = [];
    for (let j = i + 1; j < raw2.length; j++) {
      const bl = raw2[j];
      if (bl.trim() === "" || bl.search(/\S/) > blockIndent) {
        bodyLines.push(bl.trimEnd());
      } else break;
    }
    // Navigate to the right object and set the key
    setNestedKey(result, blockKey, bodyLines.join("\n").trim());
  }

  return result;
}

function setNestedKey(obj, key, value) {
  for (const section of Object.values(obj)) {
    if (typeof section === "object" && section !== null) {
      if (key in section) { section[key] = value; return true; }
      if (setNestedKey(section, key, value)) return true;
    }
  }
}

// ── Load config ───────────────────────────────────────────────────────────────
const configPath = path.join(__dirname, "config.yml");
const config     = fs.existsSync(configPath)
  ? parseYaml(fs.readFileSync(configPath, "utf-8"))
  : {};

const messageTemplate = config.reminder?.message_template ||
  "📅 Exam Reminder\n\nSubject: {subject}\nDate: Tomorrow — {day} {date}\nTime: {time}";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns tomorrow's date as YYYY-MM-DD string, adjusted for IST (UTC+5:30). */
function getTomorrowIST() {
  const now        = new Date();
  const istOffset  = 330 * 60 * 1000; // IST = UTC+5:30
  const istNow     = new Date(now.getTime() + istOffset);
  const tomorrow   = new Date(istNow);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return tomorrow.toISOString().slice(0, 10);
}

/** Fill template variables for one exam. */
function buildMessage(exam) {
  return messageTemplate
    .replace(/{subject}/g, exam.subject || "")
    .replace(/{code}/g,    exam.code    || "")
    .replace(/{date}/g,    exam.date    || "")
    .replace(/{day}/g,     exam.day     || "")
    .replace(/{time}/g,    exam.time    || "");
}

/** POST a message to the Telegram Bot API. */
function sendTelegram(text) {
  const body = JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: "HTML" });

  const options = {
    hostname: "api.telegram.org",
    path:     `/bot${TOKEN}/sendMessage`,
    method:   "POST",
    headers:  {
      "Content-Type":   "application/json",
      "Content-Length": Buffer.byteLength(body),
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        const parsed = JSON.parse(data);
        parsed.ok ? resolve(parsed) : reject(new Error(parsed.description));
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  const examsPath = path.join(__dirname, "exams.json");
  if (!fs.existsSync(examsPath)) {
    console.error("❌  exams.json not found.");
    process.exit(1);
  }

  const allExams = JSON.parse(fs.readFileSync(examsPath, "utf-8"));
  const tomorrow = getTomorrowIST();

  console.log(`ℹ️   Checking for exams on ${tomorrow} (IST tomorrow)`);

  const matches = allExams.filter((e) => e.date === tomorrow);

  if (matches.length === 0) {
    console.log("✅  No exams tomorrow. Nothing sent.");
    return;
  }

  console.log(`📨  ${matches.length} exam(s) found: ${matches.map((e) => e.subject).join(", ")}`);

  // Send one message per exam (supports multiple exams on same day)
  for (const exam of matches) {
    const text = buildMessage(exam);
    try {
      await sendTelegram(text);
      console.log(`✅  Reminder sent for ${exam.subject}`);
    } catch (err) {
      console.error(`❌  Failed for ${exam.subject}: ${err.message}`);
      process.exit(1);
    }
  }
})();
