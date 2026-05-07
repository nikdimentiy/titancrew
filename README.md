# Titan Crew

A **dark-themed, offline-capable Progressive Web App** built for serious athletes. Seven purpose-built modules cover strength logging, cardio tracking, body composition, active workout management, and cloud sync across devices — all with zero build step required.

---

## Tabs at a Glance


| Tab          | Purpose                                                |
| ------------ | ------------------------------------------------------ |
| **Strength** | Log sets, view live metrics, 1RM calculator            |
| **Cardio**   | Session logging, heatmap, monthly calendar             |
| **Weight**   | Daily mass log, BMI, progress ring, trajectory chart   |
| **Metrics**  | Body composition measurements (BF%, circumferences)    |
| **Vault**    | Data archive — history, PRs, import/export per module |
| **Workout**  | Active workout checklist from loaded JSON plan         |
| **Settings** | Units, auth, data wipe                                 |

---

## Features

### Strength

- Log sets with **exercise, weight, sets, reps, RPE, and notes**
- Program-day selector (Day 1–6: Chest/Triceps, Back/Biceps, Legs/Core, Shoulders/Triceps, Back/Chest, Cardio/Metabolic)
- **Custom exercise input** with autocomplete from your own history
- **Last-session recall** — selecting an exercise instantly shows your previous weight × sets × reps
- Live bento dashboard: Weekly Volume · Workout Streak · Arsenal (unique exercises) · Volume Trend vs prior week · Avg RPE · Total Sessions
- **Weekly Summary card** — sessions, volume, cardio minutes, and body weight delta for the current Mon–Sun period
- **1RM Calculator** (Epley formula) — type weight + reps, see estimated max in real time; respects lbs/kg preference
- Load structured **workout plans** from JSON and track set completion

### Cardio

- Log sessions: Treadmill, Elliptical, Swimming, Walking
- Captures date, duration (min), distance (mi), and calories
- Stats bar: total sessions, total distance, total time, total and avg calories
- **16-week activity heatmap** with activity-type colour coding
- Monthly mini-calendar + activity distribution chart
- Personal Records: Longest Session, Max Calories, Max Distance, Best Weekly Streak

### Weight

- Daily mass logging with **Titan Fast toggle** (19-hour fasting tracking toward a 100-fast goal)
- Mission Progress ring + linear bar with configurable Start Mass → Goal Mass
- **BMI calculation** with status badge (Under / Normal / Over / Obese)
- Iron Calendar — colour-coded cells: Loss · Small Gain · Large Gain · Titan Fast · Today
- Vitals panel: Fasting counter, Avg Fast Gap, Total Lost, Log count
- Mass Trajectory chart with 7D / 30D / ALL range tabs
- Streak tracking (consecutive logging days)

### Metrics

- Track five body composition fields per date: **Body Fat %**, Chest, Waist, Biceps, Thighs (cm)
- Stat cards for each field with **trend arrows** (▲▼) vs prior entry
- Scrollable history table with per-entry delete
- **Body Fat % trend chart** (last 20 entries, violet gradient)
- Export to JSON / clear all data

### Vault

- Unified data archive — three sub-tabs per module: **History · Personal Records · Storage Access**
- Strength PRs auto-calculated per exercise (best estimated 1RM via Epley)
- Cardio PRs: Longest Session, Max Calories, Max Distance, Best Weekly Streak
- Independent **Export / Import / Wipe** for each module (Strength, Cardio, Body)

### Workout

- Activate any loaded plan to open a **live checklist** with exercise name, sets × reps scheme, rest time, and progression note
- Check off individual sets as you complete them; progress bar updates in real time
- Log weight + reps directly from the checklist — writes to Strength history
- Add or edit exercises inside the active plan on the fly
- Workout state syncs across devices in real time via Appwrite

### Settings

- Toggle **lbs / kg** globally — affects all volume totals, PR cards, and 1RM estimates
- **Sign Out** (clean session end) or **Hard Sign Out** (clears all tokens and cached state)
- **Clear All Data** — wipes strength history from localStorage and cloud

---

## Cloud Sync

Titan Crew supports optional **multi-device cloud sync via [Appwrite](https://appwrite.io)**.

All five data types sync independently:


| Data                 | Collection      |
| -------------------- | --------------- |
| Strength workouts    | `workouts`      |
| Cardio sessions      | `cardio`        |
| Workout plans        | `plans`         |
| Active workout state | `workout_state` |
| Body measurements    | `measurements`  |

**How it works:**

1. Sign in with email + password on the auth overlay.
2. On login, local data merges with cloud (cloud is source of truth; local-only entries are uploaded).
3. Fire-and-forget writes keep the UI instant — cloud failures fall back silently to localStorage.
4. A **realtime subscription** pushes changes from other sessions so multiple devices stay in sync without polling.
5. The **sync status dot** in the session bar shows: `Syncing…` (amber pulse) → `Synced` (green) → `Sync error` (red).

### Appwrite Collections

Create these in your `titan-db` database. All documents use `userId`-scoped permissions.

**`workouts`** — `userId`, `localId`, `date`, `muscleGroup`, `exercise`, `weight`, `sets`, `reps`, `volume`, `isBodyweight`, `rpe`, `notes`

**`cardio`** — `userId`, `localId`, `date`, `activity`, `duration`, `distance`, `calories`

**`plans`** — `userId`, `localId`, `planData` (JSON string)

**`workout_state`** — `userId`, `state` (JSON string)

**`measurements`** — `userId`, `localId`, `date`, `bodyfat`, `chest`, `waist`, `biceps`, `thighs`, `notes`

Add a **key index on `userId`** to each collection.

---

## Keyboard Shortcuts

### Tab Navigation


| Shortcut   | Tab      |
| ---------- | -------- |
| `Ctrl + 1` | Strength |
| `Ctrl + 2` | Cardio   |
| `Ctrl + 3` | Weight   |
| `Ctrl + 4` | Metrics  |
| `Ctrl + 5` | Vault    |
| `Ctrl + 6` | Workout  |
| `Ctrl + 7` | Settings |

### Quick Actions


| Shortcut   | Action                              |
| ---------- | ----------------------------------- |
| `S`        | Open / close Log a Set sidebar      |
| `C`        | Open Cardio log panel               |
| `W`        | Open Weight log modal               |
| `P`        | Jump to Workout tab                 |
| `Ctrl + /` | Toggle Keyboard Shortcuts reference |
| `Esc`      | Close any open panel or modal       |

---

## Getting Started

### Prerequisites

- Any modern browser (Chrome, Edge, Firefox, Safari)
- A static file server for local dev — Service Workers require `localhost` or HTTPS
- An [Appwrite Cloud](https://cloud.appwrite.io) project (optional, for cloud sync)

### Local Development

```bash
git clone https://github.com/your-username/titan-crew.git
cd titan-crew

# Any static server works:
npx serve .
# or
python3 -m http.server 8080
```

Open `http://localhost:8080`. The app runs fully offline without an Appwrite account.

### Appwrite Setup

1. Create a project in [Appwrite Cloud](https://cloud.appwrite.io).
2. Create a database named `titan-db`.
3. Create the five collections listed above with the attributes and `userId` index.
4. Update [js/data/appwrite.js](js/data/appwrite.js) with your endpoint and project ID:

```js
export const client = new Client()
    .setEndpoint('https://sfo.cloud.appwrite.io/v1')  // your endpoint
    .setProject('your-project-id');                   // your project ID
```

5. Enable **Email/Password** authentication in Appwrite → Auth → Settings.

### Deployment

No build step required — Titan Crew is 100% static.


| Host                 | Method                                                   |
| -------------------- | -------------------------------------------------------- |
| **Cloudflare Pages** | Connect GitHub repo; root directory, no build command    |
| **GitHub Pages**     | Push to`gh-pages` or set Pages source to `main` / `root` |
| **Netlify / Vercel** | Drag-and-drop the folder or link the repo                |

---

## Data Management

All data is stored in **localStorage** by default. An Appwrite account is not required.


| Action                 | Location                                      |
| ---------------------- | --------------------------------------------- |
| Export Strength        | Vault → Strength → Storage Access → Export |
| Import Strength        | Vault → Strength → Storage Access → Import |
| Export Cardio          | Vault → Cardio → Storage Access → Export   |
| Import Cardio          | Vault → Cardio → Storage Access → Import   |
| Export Weight log      | Vault → Body → Storage Access → Export     |
| Export Measurements    | Metrics → Export JSON                        |
| Wipe all strength data | Settings → Clear All Data                    |

Exported files are `.json` and can be re-imported to restore history or migrate between devices.

---

## Project Structure

```
titan-crew/
├── index.html              # Single-page app shell + inline CSS
├── sw.js                   # Service worker (offline cache)
├── manifest.json           # PWA manifest
├── css/
│   ├── variables.css       # Design tokens (colours, radii, easing)
│   ├── base.css
│   ├── layout.css
│   ├── components.css
│   ├── auth.css
│   ├── tabs.css            # Tab backgrounds + active states
│   ├── workout.css
│   └── mobile.css          # Bottom nav + mobile overrides
└── js/
    ├── app.js              # Root: auth callback, render loop, tab nav
    ├── data/
    │   ├── appwrite.js     # Client + collection IDs
    │   ├── cloud.js        # fetch / add / remove / wipe per collection
    │   ├── exercises.js    # Preset exercise list per program day
    │   └── storage.js      # localStorage wrapper for strength data
    └── modules/
        ├── auth.js         # Appwrite email/password auth flow
        ├── body.js         # Weight tab + Metrics/Measurements logic
        ├── cardio.js       # Cardio tab — log, stats, heatmap, chart
        ├── form.js         # Log-a-Set sidebar form + autocomplete
        ├── history.js      # Workout log table + filter
        ├── metrics.js      # Bento card calculations + PR grid
        ├── plan.js         # Plan save / render / cloud sync
        ├── ui.js           # Toast notifications
        ├── widgets.js      # Time strip, session bar, weekly summary, sync dot
        └── workout.js      # Active workout checklist + state sync
```

---

## Tech Stack


| Layer          | Technology                                                  |
| -------------- | ----------------------------------------------------------- |
| UI             | Vanilla JS (ES Modules, no framework)                       |
| Charting       | [Chart.js 4.4.2](https://www.chartjs.org/)                  |
| Fonts          | Oswald (headings) + Roboto (body) via Google Fonts          |
| Backend / Auth | [Appwrite](https://appwrite.io) — database, auth, realtime |
| Offline        | Service Worker + Cache API                                  |
| Hosting        | Cloudflare Pages (recommended)                              |

---

## Design System

**Palette**


| Token            | Hex                   | Usage                               |
| ---------------- | --------------------- | ----------------------------------- |
| `--bg`           | `#0d0b1a`             | App background                      |
| `--bg-card`      | `#16132a`             | Card surfaces                       |
| `--violet`       | `#a78bfa`             | Primary accent (Strength / Metrics) |
| `--sky`          | `#38bdf8`             | Cardio accent                       |
| `--amber` / gold | `#fbbf24` / `#d4af37` | Strength PRs, 1RM                   |
| `--mint`         | `#34d399`             | Positive delta, progress            |
| `--danger`       | `#f87171`             | Negative delta, destructive actions |

**Typography** — `Oswald` for all labels, headings, and values (uppercase, tracked); `Roboto` for notes and body copy.

**Motion** — CSS keyframe animations for background orbs, gradient title shifts, panel slide-ins, and the sync status pulse. All animations respect `prefers-reduced-motion`.
