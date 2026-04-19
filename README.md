# 📅 Exam Schedule + Telegram Reminder

A minimal, open-source exam schedule website with automated Telegram reminders via GitHub Actions.  
**Fork it. Fill in your exams. Done.**

---

## ✨ Features

- Clean static website hosted on GitHub Pages
- Daily Telegram reminder sent automatically at 9 AM IST (configurable)
- Sends a reminder **the day before** each exam
- Supports multiple exams on the same day
- Zero external dependencies — pure Node.js built-ins only
- Fully customizable via two files: `config.yml` and `exams.json`

---

## 📁 Project Structure

```
exam-notify/
├── index.html                        # The website (do not edit for content)
├── exams.json                        # ✏️  Your exam data
├── config.yml                        # ✏️  Site text, theme, reminder settings
├── script.js                         # Telegram reminder script (Node.js)
└── .github/
    └── workflows/
        └── reminder.yml              # GitHub Actions cron workflow
```

---

## 🚀 Quick Start (Fork & Use)

### Step 1 — Fork this repo

Click **Fork** at the top right of this page.  
Then clone your fork:

```bash
git clone https://github.com/son4jit/exam-notify.git
cd YOUR_REPO_NAME
```

---

### Step 2 — Edit your exams (`exams.json`)

Open `exams.json` and replace the entries with your own:

```json
[
  { "subject": "Mathematics", "code": "MAT-401", "date": "2026-05-10", "time": "10 – 11 AM", "day": "Sunday"   },
  { "subject": "Physics",     "code": "PHY-402", "date": "2026-05-12", "time": "1 – 2 PM",   "day": "Tuesday"  },
  { "subject": "Chemistry",   "code": "CHE-403", "date": "2026-05-14", "time": "1 – 2 PM",   "day": "Thursday" }
]
```

| Field     | Required | Description                            | Example           |
|-----------|----------|----------------------------------------|-------------------|
| `subject` | ✅       | Subject name shown on site             | `"Mathematics"`   |
| `code`    | ✅       | Short label (paper code, type, etc.)   | `"MAT-401"`       |
| `date`    | ✅       | Exam date in `YYYY-MM-DD` format       | `"2026-05-10"`    |
| `time`    | ✅       | Exam time (display string)             | `"10 – 11 AM"`    |
| `day`     | ✅       | Day of the week                        | `"Sunday"`        |

> ⚠️ Date **must** be in `YYYY-MM-DD` format — the reminder script uses this for comparison.

---

### Step 3 — Customize the site (`config.yml`)

Open `config.yml` to change the website text, theme color, and reminder message:

```yaml
site:
  title:          "Exam Schedule"                        # Browser tab title
  heading:        "Exam"                                 # Left word of big heading
  heading_accent: "Schedule"                             # Right word (shown in accent color)
  label:          "4th Semester · Sessional Exams"       # Small text above heading
  footer:         "All the best · Study hard 🎯"

theme:
  accent: "#c0392b"                                      # Hex color for accents

reminder:
  cron: "30 3 * * *"                                     # 03:30 UTC = 09:00 AM IST
  message_template: |
    📅 Exam Reminder — Tomorrow!

    📚 Subject: {subject} ({code})
    📆 Date: Tomorrow — {day} {date}
    ⏰ Time: {time}

    🍀 Good luck — you've got this!
```

**Message template variables:**

| Variable    | Replaced with         |
|-------------|----------------------|
| `{subject}` | Subject name         |
| `{code}`    | Paper code / label   |
| `{date}`    | Exam date            |
| `{day}`     | Day of the week      |
| `{time}`    | Exam time            |

**Changing the reminder timezone:**

Find your UTC equivalent at [crontab.guru](https://crontab.guru), then update **both**:
1. `reminder.cron` in `config.yml` (documentation)
2. The `cron:` line inside `.github/workflows/reminder.yml` (this is what GitHub actually uses)

Common examples:

| Timezone | Local Time | UTC Cron        |
|----------|------------|-----------------|
| IST      | 9:00 AM    | `30 3 * * *`    |
| GMT      | 9:00 AM    | `0 9 * * *`     |
| EST      | 9:00 AM    | `0 14 * * *`    |
| PST      | 9:00 AM    | `0 17 * * *`    |

---

### Step 4 — Also update `index.html` (sync with config)

Because the site is fully static, `index.html` contains a copy of the config values and exam data inline. After editing `config.yml` and `exams.json`, open `index.html` and update the two matching JavaScript blocks near the bottom:

```js
// ── Site config ──
const SITE = {
  label:          "Your label here",
  heading:        "Your heading",
  heading_accent: "Accent word",
  footer:         "Your footer text",
};

// ── Exam data ──
const EXAMS = [
  { subject: "Mathematics", code: "MAT-401", date: "10 May 2026", day: "Sunday",   time: "10 – 11 AM" },
  // ...
];
```

> 💡 **Note:** The `date` field in `index.html` is a display string (e.g. `"10 May 2026"`), while in `exams.json` it must be `YYYY-MM-DD` for the reminder script.

---

### Step 5 — Create a Telegram Bot

1. Open Telegram and search for **@BotFather**
2. Send `/newbot` and follow the prompts
3. Copy the **bot token** it gives you (looks like `123456:ABCdef...`)
4. Start a chat with your new bot (just send it `/start`)
5. Visit this URL in your browser to find your Chat ID:
   ```
   https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates
   ```
6. Look for `"chat": { "id": 123456789 }` — that number is your **Chat ID**

> 💡 **Tip:** If `getUpdates` returns an empty result, send any message to your bot first, then refresh.

---

### Step 6 — Add GitHub Secrets

Go to your forked repo on GitHub:

**Settings → Secrets and variables → Actions → New repository secret**

Add these two secrets:

| Secret Name      | Value                          |
|------------------|--------------------------------|
| `TELEGRAM_TOKEN` | Your bot token from BotFather  |
| `CHAT_ID`        | Your Telegram chat ID number   |

> 🔒 These are encrypted and never exposed in logs or code.

---

### Step 7 — Enable GitHub Pages

1. Go to **Settings → Pages**
2. Under **Source**, select `Deploy from a branch`
3. Choose `main` branch and `/ (root)` folder
4. Click **Save**

Your site will be live at:
```
https://YOUR_USERNAME.github.io/exam-notify/
```

---

### Step 8 — Test the reminder

Don't wait until 5 AM — trigger it manually:

1. Go to the **Actions** tab in your repo
2. Click **Exam Reminder** in the left sidebar
3. Click **Run workflow → Run workflow**
4. Watch the logs — you should receive a Telegram message within seconds ✅

---

## 🔧 Customization Reference

| What to change          | File to edit             |
|-------------------------|--------------------------|
| Exam subjects & dates   | `exams.json`             |
| Site title & heading    | `config.yml` + `index.html` (SITE block) |
| Accent / theme color    | `config.yml` + `index.html` (CSS `--accent`) |
| Reminder message text   | `config.yml` → `reminder.message_template` |
| Reminder time / timezone| `config.yml` + `reminder.yml` (cron) |
| Add more exams          | `exams.json` + `index.html` (EXAMS array) |

---

## ❓ FAQ

**Why do I need to update both `config.yml` and `index.html`?**  
The site is fully static (no build step). `config.yml` documents your settings and drives `script.js`. `index.html` is served directly by GitHub Pages and reads its values from inline JS. Keeping them in sync is a one-time copy-paste.

**Can I add multiple exams on the same day?**  
Yes. The script sends one Telegram message per exam. Just add multiple entries in `exams.json` with the same date.

**The workflow ran but I got no message.**  
Check: (1) No exams are scheduled for tomorrow in `exams.json`. (2) Your secrets `TELEGRAM_TOKEN` and `CHAT_ID` are set correctly. (3) You sent at least one message to your bot before checking `getUpdates`.

**How do I stop reminders after exams are over?**  
Simply delete the old entries from `exams.json` and push. The script will find no matches and exit silently.

**Can I use this for any kind of reminder (not just exams)?**  
Absolutely. Rename `exams.json` entries to anything — interviews, deadlines, events. Just keep the `date` in `YYYY-MM-DD` format.

---

## 📄 License

MIT — free to use, modify, and share.
