# Habits dashboard

Static dashboard for Paul in Wiesbaden (`Europe/Berlin`). It replaces the paid Reload app.

Live site: <https://bowtiedcontract.github.io/habits/>

Todoist checkmarks are the only log. This page reads them. It does not add a second checklist, and it does not talk to the Todoist API. Todo BOT overwrites the JSON files below. Fitness Bot adds `data/fitness.json`. An optional `data/history.json` fills the week grid and the month calendar; the page still works when that file is missing.

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

The page is mobile-first. The top answers three questions without scrolling through cards: what the latest file recorded, how the week’s workouts stand, and the quit streaks.

- **Glance.** Two short bars. The daily bar is `3/5 done` from `data/habits-day.json` (label **Today** when that file’s date is today in Berlin, otherwise the file date, such as **Mon 5 Oct**). The other bar is `3/5 workouts` from `habits-week.json` → `workouts`. Skipped items stay in the denominator and, when any exist, get their own “skipped” count so they are not read as done. These two numbers are different lists. Fitness Bot stats are not mixed into them.
- **Quit streaks.** One compact strip of chips (`No Smoking  18d 9h` plus a restart icon). Tap a chip to edit the start in a sheet. **Hide** collapses the strip to a single line. Restarts and edited dates stay in this browser only.
- **Today, Week, Month.** Tabs. **All**, **Daily core**, and **Workouts** filter every tab. **‹ ›** move one day, and **Today** jumps to the Berlin date. The header clock is **Now**. The navigator is **Viewing**, so a stale file is not mistaken for today.
- **Today.** Status icons and chips only. There is no per-item progress bar and no checkbox. A weekly workout shows one status for the week (“Done this week” on the Week tab, a single chip on Today), not a full-width bar.
- **Week.** The main progress view. Rows are the habits in the JSON. Columns are Mon–Sun. Cells are done, missed, skipped, open, upcoming, not planned, or blank (no record).
- **Month.** A calendar of completion percent for days the feed actually contains. With only `habits-day.json`, that is one day. Other months say that history builds up over time.
- **Tracked from Todoist.** The names read from the JSON, plus **Last synced HH:MM (Berlin)** from the `updated` field.
- **Logged sessions.** Optional Fitness Bot output, labeled as a separate feed.

If the day file is behind Berlin today, the page does not show a warning banner. It opens on that file’s date and says: “Today's sync hasn't arrived yet. Showing Mon 5 Oct.”

Rows are whatever the JSON contains. Drop an item from the file and it leaves the page. Nothing on screen is a fixed habit list.

`?tab=week` or `#week` opens that tab (`today`, `week`, `month`).

## Quit timers

| id | Label | Start (`Europe/Berlin`) |
| --- | --- | --- |
| `no-smoking` | No Smoking | 2026-09-17T21:38:00+02:00 |
| `no-vaping` | No Vaping | 2026-09-24T18:34:00+02:00 |
| `no-alcohol` | No Alcohol | 2026-09-28T15:22:00+02:00 |
| `no-fap` | No Fap | 2026-10-02T23:31:00+02:00 |
| `caffeine` | Caffeine | 2026-10-01T05:43:00+02:00 |
| `sweets` | Sweets | 2026-10-05T03:43:00+02:00 |

Each chip shows compact elapsed time (`18d 9h`, or `5h 12m`, or `4m 9s` once the streak is under an hour). The clock still ticks every second.

- **Restart** (the icon, and the button in the sheet) asks you to confirm, then sets the start to the current Europe/Berlin time.
- **Tap the chip** to open the editor. Save stores that instant. Cancel closes the sheet.
- **Use file default** appears only when this browser already has a different start.
- **Reset all dates to the file**, under the strip, clears every override in the browser you are using.

The strip says: “Resets save in this browser only.” A phone and a laptop do not share these dates.

Overrides are stored in `localStorage` under `habits.quitTimerOverrides`:

```json
{
  "caffeine": "2026-10-06T09:00:00+02:00"
}
```

A saved date wins over the JSON file until you reset it. Changing the file in git does not move a timer that still has a browser override. Whether the strip is collapsed is stored separately, under `habits.quitStripCollapsed`.

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
| `completed` | Green circle, check, chip **Done** | Yes |
| `skipped` | Dashed square, dash, chip **Skipped** | No |
| `missed` | Red circle, cross, chip **Missed** | No |
| `planned` | Amber ring, chip **Open** (or **Upcoming** if the date is still in the future) | No |

Skipped is drawn as a dash, never as a check and never in the done color. A reschedule must be `skipped` (or left `planned`). Do not write it as `completed`.

`planned: false` means the row was not on the plan. The cell is **Not planned**. Omitted `planned` means it was planned. The page never writes a completion back.

There is one summary bar per glance card (done ÷ planned items). Individual rows do not have bars.

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
- `percentDone` may stay in the file. The page’s week bar is `workouts` completed ÷ `workouts` length, not this percent, because the percent mixes daily habits and workouts.
- `completed`, `missed`, and `skipped` can still be written. Names already in the day file or `workouts` are not repeated. A name that appears only here is listed under “Also in the week file”. `when` is a short label, not a date the grid parses.
- `workouts` is the weekly training list. The same `status` values as the day file. Without a per-day history entry, the workout keeps a single status chip on its name (Done, Open, Skipped, or Missed). The Mon–Sun cells stay blank, so a finished workout does not look like seven finished days.
- Inside `weekStart`–`weekEnd`, daily habits from the day file show their real status on `habits-day.json`’s date. Later days in that week are **Upcoming** until a record exists. Days outside that week are blank unless `history.json` has them.
- If today falls outside `weekStart`–`weekEnd`, the workout glance is labeled **Workouts** instead of **This week**.

### `data/history.json` (optional)

Per-day statuses for the week grid and the month percents. If the file is missing (404), it is ignored. Do not remove `habits-day.json` or `habits-week.json` in favor of this file.

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
- On the date named in `habits-day.json`, daily items come from that file. History may still add `category: "workout"` items on that date. Those replace the single week-wide workout chip with real day cells.
- A day’s percent is `round(100 * completed / planned items that day)`. Skipped and missed stay in the denominator. Week-wide workouts are not copied onto every day.
- The month calendar colors a day only when that percent exists. Empty days stay blank.

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
| `data/history.json` | Optional per-day history, for Todo BOT |
| `data/fitness.json` | Optional, for Fitness Bot |
| `.github/workflows/deploy-pages.yml` | GitHub Pages deploy |
| `.nojekyll` | Present so a branch deploy would not run Jekyll |
