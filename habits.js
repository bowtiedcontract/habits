import { formatBerlinHM, formatShortDay, formatSpokenDay } from "./time.js";

export const KIND_LABEL = {
  completed: "Done",
  skipped: "Skipped",
  missed: "Missed",
  open: "Open",
  upcoming: "Upcoming",
  unplanned: "Not planned",
  norecord: "No record",
};

export const WEEK_KIND_LABEL = {
  completed: "Done this week",
  skipped: "Skipped this week",
  missed: "Missed this week",
  open: "Open this week",
};

export function itemId(item) {
  if (!item) return "";
  const id = item.id || item.name;
  return id == null ? "" : String(id).trim();
}

export function itemCategory(item, fallback = "daily") {
  if (item?.category === "workout" || item?.category === "daily") return item.category;
  return fallback;
}

export function addDaysISO(iso, days) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!match) return "";
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function weekdayIndexMonday(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return (date.getUTCDay() + 6) % 7;
}

export function mondayOf(iso) {
  const index = weekdayIndexMonday(iso);
  if (index == null) return "";
  return addDaysISO(iso, -index);
}

export function weekDates(iso) {
  const start = mondayOf(iso);
  if (!start) return [];
  return Array.from({ length: 7 }, (_, index) => addDaysISO(start, index));
}

export function inRange(iso, start, end) {
  return Boolean(iso && start && end && iso >= start && iso <= end);
}

export function shiftMonth(monthKey, delta) {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey || "");
  if (!match) return "";
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function summarize(items) {
  const list = (Array.isArray(items) ? items : []).filter((item) => item && item.planned !== false);
  let done = 0;
  let skipped = 0;
  let missed = 0;
  let open = 0;
  for (const item of list) {
    if (item.status === "completed") done += 1;
    else if (item.status === "skipped") skipped += 1;
    else if (item.status === "missed") missed += 1;
    else open += 1;
  }
  return { done, skipped, missed, open, total: list.length };
}

export function kindFromItem(item, date, todayISO) {
  if (!item) return "norecord";
  if (item.planned === false) return "unplanned";
  if (item.status === "completed" || item.status === "missed" || item.status === "skipped") return item.status;
  if (item.status === "planned") return date > todayISO ? "upcoming" : "open";
  return "norecord";
}

export function weekStatusKind(status) {
  if (status === "completed" || status === "skipped" || status === "missed") return status;
  return "open";
}

function wholeNumber(value) {
  return Number.isInteger(value) ? value : null;
}

export function workoutQuota(item) {
  const target = wholeNumber(item?.target);
  if (target == null || target < 1) return null;
  const raw = wholeNumber(item.done);
  const done = raw == null ? 0 : Math.max(0, raw);
  return { done, target, met: done >= target };
}

export function workoutWeekSummary({ workouts, workoutTotal, current = true } = {}) {
  const tail = current ? " this week" : "";
  const totalTarget = wholeNumber(workoutTotal?.target);
  if (workoutTotal && typeof workoutTotal === "object" && totalTarget != null && totalTarget >= 0) {
    const raw = wholeNumber(workoutTotal.done);
    const done = raw == null ? 0 : Math.max(0, raw);
    return { mode: "total", done, target: totalTarget, text: `Workouts ${done} / ${totalTarget}${tail}` };
  }
  const list = (Array.isArray(workouts) ? workouts : []).filter((item) => item && item.planned !== false);
  const usesQuota = list.some((item) => workoutQuota(item));
  if (!usesQuota) {
    const summary = summarize(list);
    return { mode: "status", done: summary.done, target: summary.total, text: `${summary.done} of ${summary.total}${tail}` };
  }
  let done = 0;
  let target = 0;
  for (const item of list) {
    const quota = workoutQuota(item);
    if (quota) {
      done += Math.min(quota.done, quota.target);
      target += quota.target;
    } else {
      target += 1;
      if (item.status === "completed") done += 1;
    }
  }
  return { mode: "sum", done, target, text: `${done} of ${target}${tail}` };
}

function assignWorkoutQuota(row, item) {
  const quota = workoutQuota(item);
  if (!quota) return;
  row.target = quota.target;
  row.done = quota.done;
}

function indexHistory(history) {
  const byDate = new Map();
  const days = Array.isArray(history?.days) ? history.days : [];
  for (const day of days) {
    if (!day || typeof day.date !== "string" || !Array.isArray(day.items)) continue;
    byDate.set(day.date, day.items.filter(Boolean));
  }
  return byDate;
}

export function itemsOnDate({ date, day, history, filter = "all" }) {
  if (!date) return [];
  const historyByDate = indexHistory(history);
  const hist = historyByDate.get(date) || [];
  let items = [];
  if (day?.date === date && Array.isArray(day.items)) {
    for (const item of day.items) {
      if (!itemId(item)) continue;
      items.push({ ...item, category: "daily" });
    }
    for (const item of hist) {
      if (itemCategory(item, "daily") !== "workout" || !itemId(item)) continue;
      items.push({ ...item, category: "workout" });
    }
  } else {
    for (const item of hist) {
      if (!itemId(item)) continue;
      const category = itemCategory(item, "daily");
      items.push({ ...item, category });
    }
  }
  if (filter === "daily") items = items.filter((item) => item.category !== "workout");
  if (filter === "workout") items = items.filter((item) => item.category === "workout");
  return items;
}

export function buildWeek({ day, week, history, todayISO, focusDate }) {
  const dates = weekDates(focusDate || todayISO || day?.date || "");
  const historyByDate = indexHistory(history);
  const dayDate = day?.date || "";
  const feedStart = week?.weekStart || "";
  const feedEnd = week?.weekEnd || "";
  const overlapsFeed = dates.some((date) => inRange(date, feedStart, feedEnd));
  const rows = [];

  function touch(item, category, repeats) {
    const id = itemId(item);
    if (!id) return;
    const cat = category === "workout" ? "workout" : itemCategory(item, category);
    const key = `${cat}:${id}`;
    const existing = rows.find((row) => row.key === key);
    if (existing) {
      if (item.name) existing.name = String(item.name);
      if (repeats) existing.repeats = true;
      if (cat === "workout" && item.status) existing.weekStatus = item.status;
      if (cat === "workout") assignWorkoutQuota(existing, item);
      return;
    }
    const row = {
      key,
      id,
      name: String(item.name || id),
      category: cat,
      repeats: Boolean(repeats),
      weekStatus: cat === "workout" && item.status ? item.status : null,
    };
    if (cat === "workout") assignWorkoutQuota(row, item);
    rows.push(row);
  }

  for (const item of Array.isArray(day?.items) ? day.items : []) touch(item, "daily", true);
  for (const item of Array.isArray(week?.workouts) ? week.workouts : []) touch(item, "workout", false);
  for (const date of [...historyByDate.keys()].sort()) {
    for (const item of historyByDate.get(date)) touch(item, itemCategory(item, "daily"), false);
  }

  function explicit(row, date) {
    if (row.category === "daily" && date === dayDate && Array.isArray(day?.items)) {
      const found = day.items.find((item) => itemId(item) === row.id);
      if (found) return found;
    }
    const list = historyByDate.get(date) || [];
    return (
      list.find((item) => itemCategory(item, "daily") === row.category && itemId(item) === row.id) || null
    );
  }

  const built = [];
  for (const row of rows) {
    const hits = dates.map((date) => explicit(row, date));
    const anyExplicit = hits.some(Boolean);
    if (row.category === "workout" && row.weekStatus && !anyExplicit && overlapsFeed) {
      built.push({ ...row, mode: "week", cells: dates.map((date) => ({ date, kind: "week" })) });
      continue;
    }
    const cells = dates.map((date, index) => {
      const item = hits[index];
      if (item) return { date, kind: kindFromItem(item, date, todayISO) };
      if (row.repeats && inRange(date, feedStart, feedEnd) && date >= todayISO) {
        return { date, kind: "upcoming" };
      }
      return { date, kind: "norecord" };
    });
    if (cells.every((cell) => cell.kind === "norecord")) continue;
    built.push({ ...row, mode: "days", cells });
  }
  return { dates, rows: built };
}

export function filterRows(rows, filter) {
  if (filter === "daily") return rows.filter((row) => row.category === "daily");
  if (filter === "workout") return rows.filter((row) => row.category === "workout");
  return rows || [];
}

export function todayLists({ day, week, history, selectedDate, filter = "all" }) {
  const dated = itemsOnDate({ date: selectedDate, day, history, filter: "all" });
  let daily = dated.filter((item) => item.category !== "workout");
  const datedWorkouts = dated.filter((item) => item.category === "workout");
  let workouts = [];
  let scope = "day";
  if (datedWorkouts.length) {
    workouts = datedWorkouts;
    scope = "day";
  } else if (week && inRange(selectedDate, week.weekStart, week.weekEnd)) {
    workouts = (Array.isArray(week.workouts) ? week.workouts : [])
      .filter((item) => itemId(item))
      .map((item) => ({ ...item, category: "workout" }));
    scope = "week";
  }
  if (filter === "workout") daily = [];
  if (filter === "daily") workouts = [];
  return { daily, workouts, scope };
}

export function glanceModel({ day, week, todayISO }) {
  const daily = summarize(day?.items || []);
  const workouts = summarize(week?.workouts || []);
  const fileIsToday = Boolean(day?.date && day.date === todayISO);
  const weekIsCurrent = Boolean(week && inRange(todayISO, week.weekStart, week.weekEnd));
  return {
    dailyLabel: fileIsToday ? "Today" : day?.date ? formatShortDay(day.date) : "Today",
    fileIsToday,
    daily,
    weekLabel: weekIsCurrent ? "This week" : "Workouts",
    weekIsCurrent,
    workouts,
  };
}

export function syncMessage({ dayDate, todayISO, selectedDate, hasDailyItems }) {
  if (!todayISO || !selectedDate) return "";
  if (dayDate && dayDate < todayISO && selectedDate === dayDate) {
    return `Waiting for today's update from Todoist. Showing ${formatSpokenDay(dayDate)}.`;
  }
  if (selectedDate === todayISO && dayDate !== todayISO && !hasDailyItems) {
    return `Nothing synced for ${formatSpokenDay(selectedDate)} yet.`;
  }
  return "";
}

export function summarizeDayCells(rows, date) {
  const details = [];
  let done = 0;
  let total = 0;
  let upcoming = 0;
  for (const row of rows || []) {
    if (!row || row.mode === "week") continue;
    const cell = (row.cells || []).find((entry) => entry.date === date);
    if (!cell) continue;
    if (cell.kind === "norecord" || cell.kind === "unplanned" || cell.kind === "week") continue;
    total += 1;
    if (cell.kind === "completed") done += 1;
    if (cell.kind === "upcoming") upcoming += 1;
    const detail = {
      id: row.id,
      name: row.name,
      kind: cell.kind,
      category: row.category,
    };
    const quota = row.category === "workout" ? workoutQuota(row) : null;
    if (quota) {
      detail.target = quota.target;
      detail.done = quota.done;
    }
    details.push(detail);
  }
  let tone = "empty";
  if (total > 0) tone = upcoming === total ? "upcoming" : "scored";
  return { date, done, total, upcoming, details, tone };
}

export function feedListing({ day, week, history }) {
  const daily = [];
  const workouts = [];
  for (const item of Array.isArray(day?.items) ? day.items : []) {
    const id = itemId(item);
    if (!id) continue;
    daily.push({ id, name: String(item.name || id) });
  }
  for (const item of Array.isArray(week?.workouts) ? week.workouts : []) {
    const id = itemId(item);
    if (!id) continue;
    workouts.push({ id, name: String(item.name || id) });
  }
  const known = new Set([...daily, ...workouts].map((item) => item.id));
  const also = [];
  for (const [key, status] of [
    ["completed", "completed"],
    ["missed", "missed"],
    ["skipped", "skipped"],
  ]) {
    for (const item of Array.isArray(week?.[key]) ? week[key] : []) {
      const id = itemId(item);
      if (!id || known.has(id)) continue;
      known.add(id);
      also.push({
        id,
        name: String(item.name || id),
        status,
        when: item.when ? String(item.when) : "",
      });
    }
  }
  const stamps = [day?.updated, week?.updated, history?.updated].filter(
    (value) => typeof value === "string" && !Number.isNaN(Date.parse(value))
  );
  stamps.sort((a, b) => Date.parse(a) - Date.parse(b));
  return {
    daily,
    workouts,
    also,
    dayUpdated: typeof day?.updated === "string" ? day.updated : "",
    weekUpdated: typeof week?.updated === "string" ? week.updated : "",
    updated: stamps.at(-1) || "",
  };
}

export function syncLine(dayUpdated, weekUpdated) {
  const dayHM = formatBerlinHM(dayUpdated);
  const weekHM = formatBerlinHM(weekUpdated);
  if (dayHM && weekHM && dayHM !== weekHM) return `Last synced day ${dayHM} · week ${weekHM} (Berlin)`;
  const hm = dayHM || weekHM;
  return hm ? `Last synced ${hm} (Berlin)` : "";
}

export function buildMonth({ monthKey, day, history, todayISO, filter = "all" }) {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey || "");
  if (!match) return { cells: [], any: false };
  const year = Number(match[1]);
  const month = Number(match[2]);
  const lead = weekdayIndexMonday(`${monthKey}-01`) || 0;
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells = [];
  for (let index = 0; index < lead; index += 1) cells.push(null);
  let any = false;
  for (let dayNumber = 1; dayNumber <= count; dayNumber += 1) {
    const date = `${monthKey}-${String(dayNumber).padStart(2, "0")}`;
    const items = itemsOnDate({ date, day, history, filter });
    const summary = summarize(items);
    const percent = summary.total ? Math.round((100 * summary.done) / summary.total) : null;
    if (percent != null) any = true;
    cells.push({
      date,
      day: dayNumber,
      summary,
      percent,
      isToday: date === todayISO,
    });
  }
  return { cells, any };
}
