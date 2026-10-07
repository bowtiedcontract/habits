# Habits dashboard

Static dashboard for Paul in Wiesbaden (`Europe/Berlin`). It replaces the paid Reload app.

Live site: <https://bowtiedcontract.github.io/habits/>

Todoist checkmarks are the only log. This page reads them. It does not add a second checklist, and it does not talk to the Todoist API. Todo BOT overwrites the JSON files below. Fitness Bot adds `data/fitness.json`. An optional `data/history.json` fills earlier days on the Week tab; the page still works when that file is missing.

This is a public repo. Quit labels are visible to anyone who opens the URL. The page sends `noindex`, which only asks search engines not to list it.

## Open it

Pushes to `main` run [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml), which publishes the repo root with GitHub Pages. In the repo **Settings → Pages**, the source should be **GitHub Actions**.

The site is the repo root (`index.html`), not `/docs`.

Preview on your machine from the repo root:

```bash
python3 -m http.server 8080
```

Open <http://127.0.0.1:8080/>. Opening `index.html` as a file will not load the JSON.

Check the clock and the view model:

```bash
node time.test.js
node habits.test.js
```

## What you see

The page is a phone screen: large type, a few cards, and a bottom tab bar (**Today**, **Week**, **Quit**). **Today** is the default. The chosen tab is stored in the URL hash.

- **Today.** A progress ring shows how many daily habits in `data/habits-day.json` are done (`2 of 4 done`, plus the percent). Each habit is a card: icon, name, “Daily”, and a status on the right (filled check, empty circle, or Skipped). Under that, **This week's workouts** lists `habits-week.json` → `workouts`. A card with `target` shows a large `done / target` count and a slim bar, plus a green check once `done` reaches `target`. Without `target`, the card keeps a single status. The line under the heading is `X of Y this week`, or `Workouts N / M this week` when `workoutTotal` is present. **‹ ›** move one day. Skipped items stay in the denominator and are not read as done. Fitness Bot stats are not mixed into these numbers.
- **Week.** Seven day cards, Monday to Sunday (`Tue 6 Oct` and `2/4`, plus a bar). Tap a day for that day’s habits. Logged sessions from `data/fitness.json` sit under the week as cards.
- **Quit.** One card per timer in `data/quit-timers.json`. Colored outline, the name, a live `d h m s` clock, and “since quitting”. An edit button opens the start-date sheet. Restarts and edited dates stay in this browser only.

**About** (the i button) holds “Tracked from Todoist”, the last sync time, the read-only note, and the public-visibility note. Those stay off the main screens.

If the day file is behind Berlin today, the page does not show a warning banner. It opens on that file’s date and says: “Waiting for today's update from Todoist. Showing Monday 5 Oct.”

Rows are whatever the JSON contains. Drop an item from the file and it leaves the page. Nothing on screen is a fixed habit list.

`?tab=week` or `#week` opens that tab (`today`, `week`, `quit`).

## Quit timers

| id | Label | Start (`Europe/Berlin`) |
| --- | --- | --- |
| `no-smoking` | No Smoking | 2026-09-17T21:38:00+02:00 |
| `no-vaping` | No Vaping | 2026-09-24T18:34:00+02:00 |
| `no-alcohol` | No Alcohol | 2026-09-28T15:22:00+02:00 |
| `no-fap` | No Fap | 2026-10-02T23:31:00+02:00 |
| `caffeine` | Caffeine | 2026-10-01T05:43:00+02:00 |
| `sweets` | Sweets | 2026-10-05T03:43:00+02:00 |

Each card shows elapsed time as `18d 9h 2m 4s` (days, hours, minutes, and seconds). The clock ticks every second.

- **Edit** (the icon on the card) opens the sheet. **Restart from now** asks you to confirm, then sets the start to the current Europe/Berlin time. Save stores a chosen instant. Cancel closes the sheet.
- **Use file default** appears only when this browser already has a different start.
- **Reset all dates to the file**, in About, clears every override in the browser you are using.

The sheet says dates stay in this browser only. A phone and a laptop do not share them.

Overrides are stored in `localStorage` under `habits.quitTimerOverrides`:

```json
{
  "caffeine": "2026-10-06T09:00:00+02:00"
}
```

A saved date wins over the JSON file until you reset it. Changing the file in git does not move a timer that still has a browser override.

### `data/quit-timers.json`

```json
{
  "schemaVersion": 1,
  "timezone": "Europe/Berlin",
  "timers": [
    {
      "id": "no-smoking",
      "label": "No Smoking",
      "start": "2026-09-17T21:38:00+02:00"
    }
  ]
}
```

- `schemaVersion` is `1`.
- `start` is ISO-8601 with a numeric offset. The page treats that instant as the start and displays it in `Europe/Berlin`.
- `id` is stable. The browser override is keyed by `id`.
- Array order is display order.

## Planned vs done

Tick tasks in Todoist. Todo BOT should commit updated JSON to `main`. Do not put API tokens in this repo. Omit `"sample": true` (or set it to `false`) once the file is real. The sample line disappears when both habit files are not marked sample.

`status` is one of:

| status | On the page | Counted as done? |
| --- | --- | --- |
| `completed` | Filled green check | Yes |
| `skipped` | Dash and the word Skipped | No |
| `missed` | Cross and the word Missed | No |
| `planned` | Empty circle (Open, or Upcoming if the date is still in the future) | No |

Skipped is drawn as a dash, never as a check and never in the done color. A reschedule must be `skipped` (or left `planned`). Do not write it as `completed`.

`planned: false` means the row was not on the plan. The cell is **Not planned**. Omitted `planned` means it was planned. The page never writes a completion back.

The Today ring is done ÷ planned items in the day file. Daily habit cards do not have bars. A workout card has a slim bar only when `target` is set.

### `data/habits-day.json`

One Berlin calendar day. Todo BOT overwrites this file. On a date that matches `date`, this file is the daily list. It wins over `history.json` for that same date.

```json
{
  "schemaVersion": 1,
  "timezone": "Europe/Berlin",
  "date": "2026-10-05",
  "sample": false,
  "updated": "2026-10-05T21:15:00+02:00",
  "source": "todoist",
  "items": [
    {
      "id": "german",
      "name": "German (Anki/Pimsleur)",
      "planned": true,
      "status": "completed",
      "note": ""
    }
  ]
}
```

- `date` is `YYYY-MM-DD` in `Europe/Berlin`.
- `items` is display order. The page lists these names and no others.
- `note` is optional. Leave it off when empty.
- `updated` is the sync time. The page prints it as `Last synced 22:14 (Berlin)`.
- If `date` is before today in Berlin, the navigator starts on `date` and the sync note names that day. It is not an error banner.
- A past day left as `planned` still shows **Open**. Set `missed` when the day is over and the task was not done.

### `data/habits-week.json`

One Monday–Sunday week in `Europe/Berlin`. `weekStart` and `weekEnd` are inclusive `YYYY-MM-DD` dates.

```json
{
  "schemaVersion": 1,
  "timezone": "Europe/Berlin",
  "weekStart": "2026-10-05",
  "weekEnd": "2026-10-11",
  "sample": false,
  "updated": "2026-10-05T21:15:00+02:00",
  "source": "todoist",
  "percentDone": 40,
  "counts": {
    "planned": 10,
    "completed": 4,
    "skipped": 1,
    "missed": 2,
    "open": 3
  },
  "completed": [
    { "id": "german", "name": "German (Anki/Pimsleur)", "when": "Mon 5 Oct" }
  ],
  "missed": [
    { "id": "investing", "name": "Investing check", "when": "Mon 5 Oct" }
  ],
  "skipped": [
    { "id": "vitamins-evening", "name": "Evening vitamins", "when": "Mon 5 Oct" }
  ],
  "workouts": [
    { "id": "couch-to-5k", "name": "Couch to 5K", "status": "completed" }
  ]
}
```

- `counts.planned = completed + skipped + missed + open`.
- `percentDone` may stay in the file. The page does not use it for the workout summary, because the percent mixes daily habits and workouts.
- `completed`, `missed`, and `skipped` can still be written. Names already in the day file or `workouts` are not repeated. A name that appears only here is listed under “Also in the week file”. `when` is a short label, not a date the grid parses.
- `workouts` is the weekly training list. The same `status` values as the day file. Without a per-day history entry, and when `target` is omitted, the workout keeps one status on the Today tab (Done, Open, Skipped, or Missed). It is not copied onto every day card, so a finished workout does not look like seven finished days.
- Each `workouts[]` item may have integer `target` (sessions per week) and `done` (sessions completed). Optional top-level `workoutTotal: {target, done}`.
- When `target` is present, that workout’s card (and a Week-tab day row for the same workout) shows `done / target`, a slim bar filled to `done`, and a green check when `done` is at least `target`. The “X of Y this week” line sums `done` and `target`, capping each workout at its `target`. A workout with no `target` still counts as one, and counts as done only when `status` is `completed`. When `workoutTotal` is present, that line is the headline `Workouts N / M this week` from `workoutTotal.done` and `workoutTotal.target`.
- Inside `weekStart`–`weekEnd`, daily habits from the day file show their real status on `habits-day.json`’s date. Later days in that week are **Upcoming** until a record exists. Days outside that week are blank unless `history.json` has them.
- If today falls outside `weekStart`–`weekEnd`, the workout block is labeled **Workouts** instead of **This week's workouts**.

### `data/history.json` (optional)

Per-day statuses for the Week tab. If the file is missing (404), it is ignored. Do not remove `habits-day.json` or `habits-week.json` in favor of this file. There is no month view.

```json
{
  "schemaVersion": 1,
  "timezone": "Europe/Berlin",
  "updated": "2026-10-06T07:30:00+02:00",
  "source": "todoist",
  "days": [
    {
      "date": "2026-10-04",
      "items": [
        {
          "id": "german",
          "name": "German (Anki/Pimsleur)",
          "category": "daily",
          "planned": true,
          "status": "missed"
        },
        {
          "id": "couch-to-5k",
          "name": "Couch to 5K",
          "category": "workout",
          "planned": true,
          "status": "completed"
        }
      ]
    }
  ]
}
```

- `days` may be sparse. Any Berlin `YYYY-MM-DD` is allowed. Order does not matter.
- `category` is `daily` or `workout`. Omitted means `daily`.
- `status` uses the same four values. `planned: false` is **Not planned** and is left out of that day’s percent.
- On the date named in `habits-day.json`, daily items come from that file. History may still add `category: "workout"` items on that date. Those show on that day’s Week card instead of only as the week-wide workout status.
- A day’s percent is `round(100 * completed / planned items that day)`. Skipped and missed stay in the denominator. Week-wide workouts are not copied onto every day.
- A day card shows that percent as `done/total` when the day has records. Empty days say **No record**.

Todo BOT can append one object per day and leave the other files as they are.

## Fitness

`data/fitness.json` is optional. If it is missing, or has no recap, stats, or workouts, the logged-sessions section says the file will land here.

Sessions are a reading log, not another checklist. Stats, when present, are a single Fitness Bot line so they are not confused with the Todoist workout bar. The JSON shape does not change.

```json
{
  "schemaVersion": 1,
  "updated": "2026-10-11T18:00:00+01:00",
  "weekOf": "2026-10-05",
  "sundayRecap": "Short paragraph for the Sunday recap.",
  "stats": [
    { "label": "Workouts", "value": "3" }
  ],
  "workouts": [
    {
      "date": "2026-10-05",
      "name": "Couch to 5K",
      "detail": "Week 3 run"
    }
  ]
}
```

## Files

| Path | Role |
| --- | --- |
| `index.html`, `styles.css`, `app.js`, `time.js`, `habits.js` | The page |
| `time.test.js`, `habits.test.js` | Clock math and the view model |
| `data/quit-timers.json` | Quit-timer defaults |
| `data/habits-day.json` | Latest day, for Todo BOT |
| `data/habits-week.json` | This week, for Todo BOT |
| `data/history.json` | Optional per-day history for the Week tab, for Todo BOT |
| `data/fitness.json` | Optional, for Fitness Bot |
| `.github/workflows/deploy-pages.yml` | GitHub Pages deploy |
| `.nojekyll` | Present so a branch deploy would not run Jekyll |
