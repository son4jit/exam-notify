// bot.js — Telegram Bot with exam commands
// Commands: /schedule, /next, /help
// Runs via long-polling — no webhook server needed.
// Environment variables required: TELEGRAM_TOKEN, CHAT_ID

const https = require("https");
const fs    = require("fs");
const path  = require("path");

// ── Env ───────────────────────────────────────────────────────────────────────
const TOKEN = process.env.TELEGRAM_TOKEN;

if (!TOKEN) {
  console.error("❌  Missing TELEGRAM_TOKEN environment variable.");
  process.exit(1);
}

// ── Load exams ────────────────────────────────────────────────────────────────
const examsPath = path.join(__dirname, "exams.json");
if (!fs.existsSync(examsPath)) {
  console.error("❌  exams.json not found.");
  process.exit(1);
}
const EXAMS = JSON.parse(fs.readFileSync(examsPath, "utf-8"));

// ── Telegram API helpers ──────────────────────────────────────────────────────
function apiRequest(method, body = {}) {
  const data = JSON.stringify(body);
  const options = {
    hostname: "api.telegram.org",
    path:     `/bot${TOKEN}/${method}`,
    method:   "POST",
    headers:  {
      "Content-Type":   "application/json",
      "Content-Length": Buffer.byteLength(data),
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => resolve(JSON.parse(raw)));
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function sendMessage(chat_id, text) {
  return apiRequest("sendMessage", { chat_id, text, parse_mode: "HTML" });
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function todayIST() {
  const istOffset = 330 * 60 * 1000;
  return new Date(Date.now() + istOffset).toISOString().slice(0, 10);
}

function tomorrowIST() {
  const istOffset = 330 * 60 * 1000;
  const d = new Date(Date.now() + istOffset);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function daysUntil(isoDate) {
  const istOffset = 330 * 60 * 1000;
  const now       = new Date(Date.now() + istOffset);
  const today     = new Date(now.toISOString().slice(0, 10));
  const target    = new Date(isoDate);
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

function friendlyDate(iso) {
  const [y, m, d] = iso.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun",
                  "Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${parseInt(d)} ${months[parseInt(m)-1]} ${y}`;
}

// ── Command handlers ──────────────────────────────────────────────────────────

// /help — list all commands
function handleHelp(chat_id) {
  const text = [
    "🤖 <b>Exam Notify Bot</b>",
    "",
    "Here's what I can do:",
    "",
    "/schedule — Full exam timetable",
    "/next     — Your next upcoming exam",
    "/today    — Any exam today",
    "/help     — Show this message",
  ].join("\n");
  return sendMessage(chat_id, text);
}

// /schedule — full timetable
function handleSchedule(chat_id) {
  if (!EXAMS.length) return sendMessage(chat_id, "📭 No exams found in schedule.");

  const today = todayIST();
  const lines = ["📅 <b>Full Exam Schedule</b>", ""];

  EXAMS.forEach((e) => {
    const diff  = daysUntil(e.date);
    let   badge = "";
    if (diff < 0)       badge = " ✅";
    else if (diff === 0) badge = " 🔴 TODAY";
    else if (diff === 1) badge = " 🔔 TOMORROW";
    else                badge = ` (in ${diff} days)`;

    lines.push(`<b>${e.subject}</b> <i>${e.code}</i>${badge}`);
    lines.push(`📆 ${e.day}, ${friendlyDate(e.date)}  ⏰ ${e.time}`);
    lines.push("");
  });

  return sendMessage(chat_id, lines.join("\n").trimEnd());
}

// /next — next upcoming exam
function handleNext(chat_id) {
  const today   = todayIST();
  const upcoming = EXAMS
    .filter((e) => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (!upcoming.length) {
    return sendMessage(chat_id, "🎉 All exams are done! No upcoming exams.");
  }

  const e    = upcoming[0];
  const diff = daysUntil(e.date);
  const when = diff === 0 ? "Today 🔴"
             : diff === 1 ? "Tomorrow 🔔"
             : `In ${diff} days`;

  const text = [
    "📌 <b>Next Exam</b>",
    "",
    `📚 <b>Subject:</b> ${e.subject} (${e.code})`,
    `📆 <b>Date:</b> ${e.day}, ${friendlyDate(e.date)}`,
    `⏰ <b>Time:</b> ${e.time}`,
    `⏳ <b>When:</b> ${when}`,
  ].join("\n");

  return sendMessage(chat_id, text);
}

// /today — exams today
function handleToday(chat_id) {
  const today  = todayIST();
  const todays = EXAMS.filter((e) => e.date === today);

  if (!todays.length) {
    return sendMessage(chat_id, "😌 No exams today. Rest up!");
  }

  const lines = ["🔴 <b>Today's Exam(s)</b>", ""];
  todays.forEach((e) => {
    lines.push(`📚 <b>${e.subject}</b> (${e.code})`);
    lines.push(`⏰ ${e.time}`);
    lines.push("Good luck! 🍀");
  });

  return sendMessage(chat_id, lines.join("\n"));
}

// Unknown command
function handleUnknown(chat_id, cmd) {
  return sendMessage(
    chat_id,
    `❓ Unknown command: <code>${cmd}</code>\n\nTry /help to see available commands.`
  );
}

// ── Route incoming message to the right handler ───────────────────────────────
async function handleMessage(msg) {
  const chat_id = msg.chat.id;
  const text    = (msg.text || "").trim();

  // Extract command (strip @botname suffix if present)
  const cmd = text.split("@")[0].toLowerCase();

  console.log(`📩 [${chat_id}] ${text}`);

  try {
    if (cmd === "/start" || cmd === "/help") return await handleHelp(chat_id);
    if (cmd === "/schedule")                 return await handleSchedule(chat_id);
    if (cmd === "/next")                     return await handleNext(chat_id);
    if (cmd === "/today")                    return await handleToday(chat_id);
    if (cmd.startsWith("/"))                 return await handleUnknown(chat_id, cmd);
    // Ignore non-command messages silently
  } catch (err) {
    console.error("Error handling message:", err.message);
  }
}

// ── Long polling loop ─────────────────────────────────────────────────────────
async function poll() {
  let offset = 0;
  console.log("🤖 Bot is running... Listening for commands.");
  console.log("   Commands: /schedule  /next  /today  /help");

  // Register commands with Telegram (shows them in the UI)
  await apiRequest("setMyCommands", {
    commands: [
      { command: "schedule", description: "Full exam timetable"   },
      { command: "next",     description: "Your next upcoming exam" },
      { command: "today",    description: "Any exam today"          },
      { command: "help",     description: "Show all commands"       },
    ],
  });

  while (true) {
    try {
      const res = await apiRequest("getUpdates", {
        offset,
        timeout: 30,       // long-poll for 30 seconds
        allowed_updates: ["message"],
      });

      if (res.ok && res.result.length) {
        for (const update of res.result) {
          offset = update.update_id + 1;
          if (update.message) await handleMessage(update.message);
        }
      }
    } catch (err) {
      console.error("Polling error:", err.message);
      await new Promise((r) => setTimeout(r, 5000)); // wait 5s before retry
    }
  }
}

poll();
