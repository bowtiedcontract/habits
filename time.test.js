import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  berlinDateISO,
  berlinLocalToISO,
  formatBerlinHM,
  formatElapsed,
  formatElapsedCompact,
  formatMonthLabel,
  formatShortDay,
  formatWeekSpan,
  toDatetimeLocalValue,
  weekdayNarrow,
} from "./time.js";

assert.equal(berlinLocalToISO("2026-09-17T21:38"), "2026-09-17T21:38:00+02:00");
assert.equal(berlinLocalToISO("2026-09-24T18:34"), "2026-09-24T18:34:00+02:00");
assert.equal(berlinLocalToISO("2026-09-28T15:22"), "2026-09-28T15:22:00+02:00");
assert.equal(berlinLocalToISO("2026-10-02T23:31"), "2026-10-02T23:31:00+02:00");
assert.equal(berlinLocalToISO("2026-10-01T05:43:30"), "2026-10-01T05:43:30+02:00");
assert.equal(berlinLocalToISO("2026-10-05T03:43"), "2026-10-05T03:43:00+02:00");
assert.equal(berlinLocalToISO("2026-01-15T08:05"), "2026-01-15T08:05:00+01:00");
assert.equal(berlinLocalToISO("2026-11-02T09:00"), "2026-11-02T09:00:00+01:00");

assert.equal(toDatetimeLocalValue("2026-09-17T21:38:00+02:00"), "2026-09-17T21:38");
assert.equal(toDatetimeLocalValue("2026-01-15T08:05:00+01:00"), "2026-01-15T08:05");

const sameEvening = Date.parse("2026-10-05T21:15:00+02:00") - Date.parse("2026-10-05T03:43:00+02:00");
const sweets = formatElapsed(sameEvening);
assert.equal(sweets.days, 0);
assert.equal(sweets.hours, 17);
assert.equal(sweets.minutes, 32);
assert.equal(sweets.seconds, 0);
assert.equal(sweets.primary, "17:32:00");
assert.equal(sweets.unit, "hours");

const smoking = formatElapsed(
  Date.parse("2026-10-05T21:15:00+02:00") - Date.parse("2026-09-17T21:38:00+02:00")
);
assert.equal(smoking.days, 17);
assert.equal(smoking.hours, 23);
assert.equal(smoking.minutes, 37);
assert.equal(smoking.primary, "17");
assert.equal(smoking.unit, "days");
assert.equal(smoking.subclock, "23:37:00");

const future = formatElapsed(-((2 * 86400 + 3 * 3600) * 1000));
assert.equal(future.future, true);
assert.equal(future.days, 2);
assert.equal(future.unit, "days until start");

assert.equal(berlinDateISO(new Date("2026-10-05T21:15:00+02:00")), "2026-10-05");
assert.equal(berlinDateISO(new Date("2026-10-05T23:30:00Z")), "2026-10-06");

assert.throws(() => berlinLocalToISO("yesterday"), /date/i);

assert.equal(formatShortDay("2026-10-05"), "Mon 5 Oct");
assert.equal(formatShortDay("2026-10-06"), "Tue 6 Oct");
assert.equal(formatWeekSpan("2026-10-05", "2026-10-11"), "5–11 Oct");
assert.equal(formatWeekSpan("2026-09-28", "2026-10-04"), "28 Sep – 4 Oct");
assert.equal(weekdayNarrow("2026-10-05"), "M");
assert.equal(weekdayNarrow("2026-10-08"), "T");
assert.equal(formatBerlinHM("2026-10-05T22:14:00+02:00"), "22:14");
assert.equal(formatBerlinHM("2026-01-15T08:05:00+01:00"), "08:05");
assert.equal(formatMonthLabel("2026-10"), "October 2026");

const compactDays = formatElapsedCompact(
  Date.parse("2026-10-05T21:15:00+02:00") - Date.parse("2026-09-17T21:38:00+02:00")
);
assert.equal(compactDays.text, "17d 23h");
const compactHours = formatElapsedCompact(sameEvening);
assert.equal(compactHours.text, "17h 32m");
const compactMinutes = formatElapsedCompact(125000);
assert.equal(compactMinutes.text, "2m 5s");
assert.equal(formatElapsedCompact(Number.NaN).text, "—");

const STATUSES = new Set(["completed", "skipped", "missed", "planned"]);
const quit = JSON.parse(readFileSync(new URL("./data/quit-timers.json", import.meta.url)));
const day = JSON.parse(readFileSync(new URL("./data/habits-day.json", import.meta.url)));
const week = JSON.parse(readFileSync(new URL("./data/habits-week.json", import.meta.url)));

assert.equal(quit.timezone, "Europe/Berlin");
assert.equal(quit.timers.length, 6);
const starts = Object.fromEntries(quit.timers.map((timer) => [timer.id, timer.start]));
assert.deepEqual(starts, {
  "no-smoking": "2026-09-17T21:38:00+02:00",
  "no-vaping": "2026-09-24T18:34:00+02:00",
  "no-alcohol": "2026-09-28T15:22:00+02:00",
  "no-fap": "2026-10-02T23:31:00+02:00",
  caffeine: "2026-10-01T05:43:00+02:00",
  sweets: "2026-10-05T03:43:00+02:00",
});
for (const timer of quit.timers) assert.equal(Number.isNaN(Date.parse(timer.start)), false);

assert.equal(day.date, "2026-10-05");
assert.equal(day.items.length, 5);
for (const item of day.items) assert.equal(STATUSES.has(item.status), true);

const counts = week.counts;
assert.equal(
  counts.planned,
  counts.completed + counts.skipped + counts.missed + counts.open
);
assert.equal(week.percentDone, Math.round((counts.completed / counts.planned) * 100));
assert.equal(week.completed.length, counts.completed);
assert.equal(week.missed.length, counts.missed);
assert.equal(week.skipped.length, counts.skipped);
for (const workout of week.workouts) assert.equal(STATUSES.has(workout.status), true);
assert.deepEqual(
  week.workouts.map((workout) => workout.name),
  ["Couch to 5K", "Sprints", "Bouldering", "Abs / forearms", "Yoga"]
);

console.log("time tests passed");
