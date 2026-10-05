import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  berlinDateISO,
  berlinLocalToISO,
  formatElapsed,
  toDatetimeLocalValue,
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
