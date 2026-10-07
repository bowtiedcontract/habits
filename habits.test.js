import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { formatBerlinHM } from "./time.js";
import {
  addDaysISO,
  buildMonth,
  buildWeek,
  feedListing,
  filterRows,
  glanceModel,
  inRange,
  itemsOnDate,
  kindFromItem,
  mondayOf,
  shiftMonth,
  summarize,
  summarizeDayCells,
  syncLine,
  syncMessage,
  todayLists,
  weekDates,
  weekStatusKind,
  workoutQuota,
  workoutWeekSummary,
} from "./habits.js";

const day = JSON.parse(readFileSync(new URL("./data/habits-day.json", import.meta.url)));
const week = JSON.parse(readFileSync(new URL("./data/habits-week.json", import.meta.url)));

assert.equal(mondayOf("2026-10-05"), "2026-10-05");
assert.equal(mondayOf("2026-10-06"), "2026-10-05");
assert.equal(mondayOf("2026-10-11"), "2026-10-05");
assert.deepEqual(weekDates("2026-10-06"), [
  "2026-10-05",
  "2026-10-06",
  "2026-10-07",
  "2026-10-08",
  "2026-10-09",
  "2026-10-10",
  "2026-10-11",
]);
assert.equal(addDaysISO("2026-10-31", 1), "2026-11-01");
assert.equal(shiftMonth("2026-10", -1), "2026-09");
assert.equal(shiftMonth("2026-12", 1), "2027-01");
assert.equal(inRange("2026-10-06", "2026-10-05", "2026-10-11"), true);
assert.equal(inRange("2026-10-04", "2026-10-05", "2026-10-11"), false);

assert.deepEqual(
  summarize([
    { status: "completed", planned: true },
    { status: "skipped", planned: true },
    { status: "missed", planned: true },
    { status: "planned", planned: true },
    { status: "completed", planned: false },
  ]),
  { done: 1, skipped: 1, missed: 1, open: 1, total: 4 }
);

assert.equal(kindFromItem({ status: "skipped", planned: true }, "2026-10-05", "2026-10-06"), "skipped");
assert.equal(kindFromItem({ status: "completed" }, "2026-10-05", "2026-10-06"), "completed");
assert.notEqual(
  kindFromItem({ status: "skipped" }, "2026-10-05", "2026-10-06"),
  kindFromItem({ status: "completed" }, "2026-10-05", "2026-10-06")
);
assert.equal(kindFromItem({ status: "planned" }, "2026-10-05", "2026-10-06"), "open");
assert.equal(kindFromItem({ status: "planned" }, "2026-10-07", "2026-10-06"), "upcoming");
assert.equal(kindFromItem({ planned: false, status: "planned" }, "2026-10-05", "2026-10-06"), "unplanned");
assert.equal(weekStatusKind("planned"), "open");
assert.equal(weekStatusKind("skipped"), "skipped");

const live = buildWeek({
  day,
  week,
  history: null,
  todayISO: "2026-10-06",
  focusDate: day.date,
});
assert.deepEqual(live.dates, weekDates(day.date));
const dailyRows = live.rows.filter((row) => row.category === "daily");
const workoutRows = live.rows.filter((row) => row.category === "workout");
assert.deepEqual(
  dailyRows.map((row) => row.id),
  day.items.map((item) => item.id)
);
assert.deepEqual(
  dailyRows.map((row) => row.name),
  day.items.map((item) => item.name)
);
assert.deepEqual(
  workoutRows.map((row) => row.name),
  week.workouts.map((item) => item.name)
);
for (const item of day.items) {
  const row = dailyRows.find((candidate) => candidate.id === item.id);
  const cell = row.cells.find((entry) => entry.date === day.date);
  assert.equal(cell.kind, kindFromItem(item, day.date, "2026-10-06"));
  assert.equal(row.mode, "days");
}
for (const workout of week.workouts) {
  const row = workoutRows.find((candidate) => candidate.id === workout.id);
  assert.equal(row.mode, "week");
  assert.equal(row.weekStatus, workout.status);
  assert.equal(weekStatusKind(row.weekStatus) === "completed", workout.status === "completed");
}
if (day.date < "2026-10-06" && live.dates.includes(addDaysISO(day.date, 1))) {
  const next = dailyRows[0].cells.find((cell) => cell.date === addDaysISO(day.date, 1));
  assert.equal(next.kind, "upcoming");
}

const withoutBed = {
  ...day,
  items: day.items.filter((item) => item.id !== "bed"),
};
const trimmed = buildWeek({
  day: withoutBed,
  week,
  history: null,
  todayISO: "2026-10-06",
  focusDate: withoutBed.date,
});
assert.equal(
  trimmed.rows.some((row) => row.id === "bed"),
  false
);
assert.equal(filterRows(trimmed.rows, "daily").some((row) => row.category === "workout"), false);
assert.equal(filterRows(trimmed.rows, "workout").every((row) => row.category === "workout"), true);

const history = {
  updated: "2026-10-04T21:00:00+02:00",
  days: [
    {
      date: "2026-10-04",
      items: [
        { id: "german", name: "German (Anki/Pimsleur)", category: "daily", planned: true, status: "missed" },
        { id: "bed", name: "Bed by 23:00", status: "completed" },
      ],
    },
    {
      date: day.date,
      items: [
        { id: "german", name: "German (Anki/Pimsleur)", category: "daily", status: "completed" },
        { id: "couch-to-5k", name: "Couch to 5K", category: "workout", status: "completed" },
      ],
    },
  ],
};
const withHistory = buildWeek({
  day,
  week,
  history,
  todayISO: "2026-10-06",
  focusDate: "2026-10-05",
});
const german = withHistory.rows.find((row) => row.id === "german" && row.category === "daily");
assert.equal(german.cells.find((cell) => cell.date === day.date).kind, kindFromItem(
  day.items.find((item) => item.id === "german"),
  day.date,
  "2026-10-06"
));
const couch = withHistory.rows.find((row) => row.id === "couch-to-5k");
assert.equal(couch.mode, "days");
assert.equal(couch.cells.find((cell) => cell.date === day.date).kind, "completed");
assert.equal(couch.cells.filter((cell) => cell.kind === "completed").length, 1);

const previous = buildWeek({
  day,
  week,
  history,
  todayISO: "2026-10-06",
  focusDate: "2026-10-04",
});
const oldGerman = previous.rows.find((row) => row.id === "german");
assert.equal(oldGerman.cells.find((cell) => cell.date === "2026-10-04").kind, "missed");
assert.equal(previous.rows.some((row) => row.mode === "week"), false);

const lists = todayLists({
  day,
  week,
  history: null,
  selectedDate: day.date,
  filter: "all",
});
assert.deepEqual(
  lists.daily.map((item) => item.name),
  day.items.map((item) => item.name)
);
assert.equal(lists.scope, "week");
assert.deepEqual(
  lists.workouts.map((item) => item.id),
  week.workouts.map((item) => item.id)
);
const dailyOnly = todayLists({ day, week, history: null, selectedDate: day.date, filter: "daily" });
assert.equal(dailyOnly.workouts.length, 0);
const outside = todayLists({
  day,
  week,
  history: null,
  selectedDate: "2026-09-01",
  filter: "all",
});
assert.equal(outside.daily.length, 0);
assert.equal(outside.workouts.length, 0);

const glance = glanceModel({ day, week, todayISO: "2026-10-06" });
assert.equal(glance.fileIsToday, day.date === "2026-10-06");
assert.equal(glance.daily.done, day.items.filter((item) => item.status === "completed").length);
assert.equal(glance.daily.total, day.items.filter((item) => item.planned !== false).length);
assert.equal(glance.workouts.done, week.workouts.filter((item) => item.status === "completed").length);
assert.equal(glance.workouts.total, week.workouts.length);
assert.equal(glance.daily.done === glance.daily.total, false);
const caughtUp = glanceModel({ day: { ...day, date: "2026-10-06" }, week, todayISO: "2026-10-06" });
assert.equal(caughtUp.dailyLabel, "Today");
assert.equal(caughtUp.weekLabel, "This week");

assert.equal(
  syncMessage({
    dayDate: "2026-10-05",
    todayISO: "2026-10-06",
    selectedDate: "2026-10-05",
    hasDailyItems: true,
  }),
  "Waiting for today's update from Todoist. Showing Monday 5 Oct."
);
assert.equal(
  syncMessage({
    dayDate: "2026-10-06",
    todayISO: "2026-10-06",
    selectedDate: "2026-10-06",
    hasDailyItems: true,
  }),
  ""
);
assert.match(
  syncMessage({
    dayDate: "2026-10-05",
    todayISO: "2026-10-06",
    selectedDate: "2026-10-06",
    hasDailyItems: false,
  }),
  /Nothing synced for Tuesday 6 Oct/
);

const month = buildMonth({
  monthKey: "2026-10",
  day,
  history: null,
  todayISO: "2026-10-06",
  filter: "all",
});
assert.equal(month.any, true);
assert.equal(month.cells[0], null);
const oct5 = month.cells.find((cell) => cell && cell.date === day.date);
assert.equal(oct5.percent, Math.round((100 * glance.daily.done) / glance.daily.total));
const blankDate = day.date === "2026-10-08" ? "2026-10-09" : "2026-10-08";
const outsideDay = month.cells.find((cell) => cell && cell.date === blankDate);
assert.equal(outsideDay.percent, null);
const september = buildMonth({
  monthKey: "2026-09",
  day,
  history: null,
  todayISO: "2026-10-06",
});
assert.equal(september.any, false);

const dated = itemsOnDate({ date: day.date, day, history, filter: "all" });
assert.equal(dated.some((item) => item.id === "couch-to-5k"), true);
assert.equal(
  dated.find((item) => item.id === "german").status,
  day.items.find((item) => item.id === "german").status
);

const feed = feedListing({ day, week, history: null });
assert.deepEqual(
  feed.daily.map((item) => item.name),
  day.items.map((item) => item.name)
);
assert.deepEqual(
  feed.workouts.map((item) => item.name),
  week.workouts.map((item) => item.name)
);
assert.equal(feed.also.length, 0);
const dayHM = formatBerlinHM(day.updated);
const weekHM = formatBerlinHM(week.updated);
assert.equal(
  syncLine(day.updated, week.updated),
  dayHM === weekHM ? `Last synced ${dayHM} (Berlin)` : `Last synced day ${dayHM} · week ${weekHM} (Berlin)`
);
assert.equal(syncLine("2026-10-05T21:00:00+02:00", "2026-10-05T22:14:00+02:00"), "Last synced day 21:00 · week 22:14 (Berlin)");

const fileDay = summarizeDayCells(live.rows, day.date);
const fileKinds = day.items
  .filter((item) => item.planned !== false)
  .map((item) => kindFromItem(item, day.date, "2026-10-06"));
assert.equal(fileDay.tone, fileKinds.length && fileKinds.every((kind) => kind === "upcoming") ? "upcoming" : "scored");
assert.equal(
  fileDay.done,
  day.items.filter((item) => item.status === "completed" && item.planned !== false).length
);
assert.equal(fileDay.total, day.items.filter((item) => item.planned !== false).length);
const dayAfter = addDaysISO(day.date, 1);
if (dayAfter && dayAfter > "2026-10-06" && dayAfter <= week.weekEnd) {
  assert.equal(summarizeDayCells(live.rows, dayAfter).tone, "upcoming");
}
if (week.weekStart < day.date) {
  assert.equal(summarizeDayCells(live.rows, week.weekStart).tone, "empty");
}

assert.equal(workoutQuota({ status: "completed" }), null);
assert.equal(workoutQuota({ target: 0, done: 0 }), null);
assert.equal(workoutQuota({ target: 1.5, done: 1 }), null);
assert.deepEqual(workoutQuota({ target: 2, done: 1, status: "planned" }), { done: 1, target: 2, met: false });
assert.equal(workoutQuota({ target: 2 }).done, 0);
assert.equal(workoutQuota({ target: 2, done: -3 }).done, 0);
assert.equal(workoutQuota({ target: 2, done: 2 }).met, true);
assert.equal(workoutQuota({ target: 2, done: 5 }).met, true);

const quotaWeek = {
  workouts: [
    { id: "couch-to-5k", name: "Couch to 5K", target: 2, done: 3, status: "planned" },
    { id: "sprints", name: "Sprints", target: 1, done: 0, status: "planned" },
    { id: "yoga", name: "Yoga", status: "completed" },
    { id: "rest", name: "Rest", status: "planned", planned: false, target: 4, done: 4 },
  ],
};
assert.equal(
  workoutWeekSummary({ workouts: quotaWeek.workouts, current: true }).text,
  "3 of 4 this week"
);
assert.equal(
  workoutWeekSummary({
    workouts: quotaWeek.workouts,
    workoutTotal: { target: 5, done: 2 },
    current: true,
  }).text,
  "Workouts 2 / 5 this week"
);
assert.equal(
  workoutWeekSummary({
    workouts: [{ status: "completed" }, { status: "planned" }],
    current: false,
  }).text,
  "1 of 2"
);
assert.equal(
  workoutWeekSummary({ workouts: [], workoutTotal: { target: 5, done: 2 }, current: false }).text,
  "Workouts 2 / 5"
);
assert.equal(
  workoutWeekSummary({
    workoutTotal: { target: 5, done: 0, label: "Gym sessions" },
    current: true,
  }).text,
  "Gym sessions 0 / 5 this week"
);
assert.equal(
  workoutWeekSummary({
    workoutTotal: { target: 5, done: 1, label: "  " },
    current: false,
  }).text,
  "Workouts 1 / 5"
);
assert.equal(
  workoutWeekSummary({
    workoutTotal: { target: 5, done: 1, label: 4 },
    current: true,
  }).text,
  "Workouts 1 / 5 this week"
);
assert.equal(workoutWeekSummary({ workoutTotal: { done: 1 }, current: true }).mode, "status");

const quotaBuilt = buildWeek({
  day,
  week: {
    ...week,
    workouts: [
      { id: "bouldering", name: "Bouldering", target: 2, done: 1, status: "planned" },
      { id: "yoga", name: "Yoga", status: "planned" },
    ],
  },
  history: {
    days: [
      {
        date: "2026-10-05",
        items: [{ id: "bouldering", name: "Bouldering", category: "workout", status: "completed" }],
      },
    ],
  },
  todayISO: "2026-10-07",
  focusDate: "2026-10-05",
});
const boulder = quotaBuilt.rows.find((row) => row.id === "bouldering");
assert.equal(boulder.target, 2);
assert.equal(boulder.done, 1);
assert.equal(boulder.mode, "days");
const boulderDay = summarizeDayCells(quotaBuilt.rows, "2026-10-05").details.find((detail) => detail.id === "bouldering");
assert.equal(boulderDay.target, 2);
assert.equal(boulderDay.done, 1);
const yoga = quotaBuilt.rows.find((row) => row.id === "yoga");
assert.equal(yoga.target, undefined);
assert.equal(yoga.mode, "week");

console.log("habits tests passed");
