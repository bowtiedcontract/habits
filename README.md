# Habits dashboard

Static dashboard for Paul in Wiesbaden (`Europe/Berlin`). It replaces the paid Reload app.

Live site (after GitHub Pages is enabled on `main`): <https://bowtiedcontract.github.io/habits/>

Todoist checkmarks are the only log. This page reads them. It does not add a second daily checklist, and it does not talk to the Todoist API. Todo BOT later overwrites the JSON files below. Fitness Bot later adds `data/fitness.json`.

This is a public repo. Quit labels are visible to anyone who opens the URL. The page sends `noindex`, which only asks search engines not to list it.

## Open it on GitHub Pages

The site is the repo root (`index.html`), not `/docs` and not a custom domain.

1. On GitHub, open **Settings → Pages** for this repo.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Branch: **main**. Folder: **/ (root)**. Save.
4. Wait for the Pages build. The site is <https://bowtiedcontract.github.io/habits/>.

Pushes to `main` publish the root files, including anything Todo BOT or Fitness Bot commit.

Preview on your machine from the repo root:

```bash
python3 -m http.server 8080
```

Open <http://127.0.0.1:8080/>. Opening `index.html` as a file will not load the JSON.

Check the clock math with `node time.test.js`.

## What you see

- **Quit timers.** Live elapsed time since each start, ticking every second. Starts live in [`data/quit-timers.json`](data/quit-timers.json).
- **Planned vs done.** Today’s habits from [`data/habits-day.json`](data/habits-day.json), then the week from [`data/habits-week.json`](data/habits-week.json): percent done, completed, missed, and weekly workouts.
- **Fitness (from Fitness Bot).** Reads optional [`data/fitness.json`](data/fitness.json). Until that file exists, the section says the Sunday recap will land here.

The habit blocks ship with sample data (`"sample": true`) so the layout is visible before the live feed. Quit timers use the real start times.

## Quit timers

| id | Label | Start (`Europe/Berlin`) |
| --- | --- | --- |
| `no-smoking` | No Smoking | 2026-09-17T21:38:00+02:00 |
| `no-vaping` | No Vaping | 2026-09-24T18:34:00+02:00 |
| `no-alcohol` | No Alcohol | 2026-09-28T15:22:00+02:00 |
| `no-fap` | No Fap | 2026-10-02T23:31:00+02:00 |
| `caffeine` | Caffeine | 2026-10-01T05:43:00+02:00 |
| `sweets` | Sweets | 2026-10-05T03:43:00+02:00 |

**Edit or reset a start without a deploy.** On the card, **Edit start** saves a new `Europe/Berlin` date in this browser only. **Restart from now** does the same, using the current Berlin time. **Use file default** drops that override. **Reset all dates to the file** clears every override.

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

Tick tasks in Todoist. Todo BOT should commit updated JSON to `main`. Do not put API tokens in this repo. Omit `"sample": true` (or set it to `false`) once the file is real. The yellow sample line disappears when both habit files are not marked sample.

`status` is one of:

| status | Meaning on the page |
| --- | --- |
| `completed` | Done |
| `skipped` | Skipped |
| `missed` | Missed |
| `planned` | Still open (it was planned, and it is not done, skipped, or missed yet) |

`planned: false` means the row was not on the plan. Omitted `planned` means it was planned. Rows are read-only.

### `data/habits-day.json`

One Berlin calendar day. Todo BOT overwrites this file for “today”.

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
- `items` is display order. Daily core in the sample: German (Anki/Pimsleur), Morning vitamins, Evening vitamins, Investing check, Bed by 23:00.
- `note` is optional. Leave it off when empty.
- If `date` is not today in Berlin, the page says so.

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
- `open` is how many items are still `planned` (not finished yet). They are not repeated in the completed or missed lists.
- `percentDone` is an integer: `round(100 * counts.completed / counts.planned)`. Skipped and missed stay in the denominator. They are not “done”. If you omit `percentDone`, the page computes it from `counts`.
- `completed`, `missed`, and `skipped` are the week’s rollup (daily habits and weekly workouts together). `when` is a short label you choose.
- `workouts` is only the weekly training list. Sample names: Couch to 5K, Sprints, Bouldering, Abs / forearms, Yoga. Same `status` values as the day file.
- If today falls outside `weekStart`–`weekEnd`, the page says the file is not the current week.

## Fitness

`data/fitness.json` is optional. If it is missing, or has no recap, stats, or workouts, the section keeps the placeholder sentence.

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

Fitness Bot can add this file in a later commit. Empty arrays and a blank `sundayRecap` leave the placeholder up.

## Files

| Path | Role |
| --- | --- |
| `index.html`, `styles.css`, `app.js`, `time.js` | The page |
| `data/quit-timers.json` | Quit-timer defaults |
| `data/habits-day.json` | Today, for Todo BOT |
| `data/habits-week.json` | This week, for Todo BOT |
| `data/fitness.json` | Optional, for Fitness Bot |
| `.nojekyll` | Serve the files as-is, without Jekyll |
