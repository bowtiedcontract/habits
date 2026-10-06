import {
  TZ,
  berlinDateISO,
  berlinLocalToISO,
  berlinParts,
  formatBerlinNow,
  formatBerlinStamp,
  formatElapsedCompact,
  formatMonthLabel,
  formatShortDay,
  formatWeekSpan,
  toDatetimeLocalValue,
  weekdayNarrow,
} from "./time.js";
import {
  KIND_LABEL,
  WEEK_KIND_LABEL,
  addDaysISO,
  buildMonth,
  buildWeek,
  feedListing,
  filterRows,
  glanceModel,
  kindFromItem,
  shiftMonth,
  syncLine,
  syncMessage,
  todayLists,
  weekDates,
  weekStatusKind,
} from "./habits.js";

const OVERRIDE_KEY = "habits.quitTimerOverrides";
const COLLAPSE_KEY = "habits.quitStripCollapsed";

const HABIT_TONE = {
  "no-smoking": "tone-amber",
  "no-vaping": "tone-sky",
  "no-alcohol": "tone-teal",
  "no-fap": "tone-rose",
  caffeine: "tone-coffee",
  sweets: "tone-plum",
};

const TONE_FALLBACK = ["tone-amber", "tone-sky", "tone-teal", "tone-rose", "tone-coffee", "tone-plum"];

const MARK_PATH = {
  completed: "M5 12.5l4.2 4.2L19 7",
  missed: "M7 7l10 10M17 7L7 17",
  skipped: "M6 12h12",
};

const state = {
  timers: [],
  day: null,
  week: null,
  fitness: null,
  history: null,
  dayError: false,
  weekError: false,
  fitnessError: false,
  quitError: false,
  tab: "today",
  filter: "all",
  selectedDate: "",
  viewMonth: "",
  quitCollapsed: false,
  sheetId: null,
  sheetReturn: null,
};

const $ = (selector) => document.querySelector(selector);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-cache" });
  if (!response.ok) {
    const error = new Error(`${response.status} ${url}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

async function loadJson(url, { optional = false } = {}) {
  try {
    return { data: await fetchJson(url) };
  } catch (error) {
    if (optional && error.status === 404) return { data: null };
    return { error: true };
  }
}

function readOverrides() {
  try {
    const raw = localStorage.getItem(OVERRIDE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const clean = {};
    for (const [id, value] of Object.entries(parsed)) {
      if (typeof value === "string" && !Number.isNaN(Date.parse(value))) clean[id] = value;
    }
    return clean;
  } catch {
    return {};
  }
}

function writeOverrides(overrides) {
  try {
    localStorage.setItem(OVERRIDE_KEY, JSON.stringify(overrides));
  } catch {
    throw new Error("This browser blocked saving the date.");
  }
}

function initialTab() {
  const query = new URLSearchParams(location.search).get("tab");
  const hash = location.hash.replace("#", "");
  const value = query || hash;
  if (value === "week" || value === "month" || value === "today") return value;
  return "today";
}

function paintClock() {
  const now = new Date();
  $("#now-date").textContent = formatShortDay(berlinDateISO(now));
  $("#now-time").textContent = formatBerlinNow(now).timeLine;
}

function miniIcon(d) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", d);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "2.4");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  svg.append(path);
  return svg;
}

function mark(kind) {
  const span = el("span", `mark mark-${kind}`);
  span.setAttribute("aria-hidden", "true");
  if (MARK_PATH[kind]) span.append(miniIcon(MARK_PATH[kind]));
  return span;
}

function restartIcon() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "2.2");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  path.setAttribute("d", "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5");
  svg.append(path);
  return svg;
}

function paintElapsed(timer) {
  const card = document.querySelector(`[data-timer="${timer.id}"]`);
  if (!card) return;
  const compact = formatElapsedCompact(Date.now() - Date.parse(timer.start));
  card.querySelector("[data-primary]").textContent = compact.text;
  const main = card.querySelector(".qchip-main");
  const local = timer.override ? ", saved in this browser" : "";
  main.setAttribute("aria-label", `Edit ${timer.label}, ${compact.spoken}${local}`);
  if (state.sheetId === timer.id) paintSheet(timer);
}

function paintQuitSummary() {
  const node = $("#quit-summary");
  node.textContent = state.timers
    .map((timer) => {
      const compact = formatElapsedCompact(Date.now() - Date.parse(timer.start));
      return `${timer.label} ${compact.text}`;
    })
    .join(" · ");
}

function tick() {
  paintClock();
  for (const timer of state.timers) paintElapsed(timer);
  if (state.quitCollapsed) paintQuitSummary();
}

function updateResetAll() {
  $("#reset-all").hidden = !state.timers.some((timer) => timer.override);
}

function applyTimerStart(id, iso, { override }) {
  const timer = state.timers.find((item) => item.id === id);
  if (!timer) return;
  timer.start = iso;
  timer.override = override;
  const card = document.querySelector(`[data-timer="${id}"]`);
  if (card) card.classList.toggle("is-override", override);
  paintElapsed(timer);
  updateResetAll();
  if (state.sheetId === id) {
    const input = $("#sheet-input");
    if (input) input.value = toDatetimeLocalValue(iso);
    paintSheet(timer);
  }
}

function saveOverride(id, iso) {
  const overrides = readOverrides();
  const timer = state.timers.find((item) => item.id === id);
  if (iso === timer.defaultStart) delete overrides[id];
  else overrides[id] = iso;
  writeOverrides(overrides);
  applyTimerStart(id, iso, { override: iso !== timer.defaultStart });
}

function restartTimer(id) {
  const timer = state.timers.find((item) => item.id === id);
  if (!timer) return;
  const ok = window.confirm(`Restart “${timer.label}” from now? This is saved only in this browser.`);
  if (!ok) return;
  const parts = berlinParts(new Date());
  try {
    const iso = berlinLocalToISO(
      `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`
    );
    saveOverride(id, iso);
    $("#sheet-error").hidden = true;
  } catch (err) {
    if (state.sheetId === id) {
      const error = $("#sheet-error");
      error.hidden = false;
      error.textContent = err.message || "Could not restart.";
    }
  }
}

function renderQuit(payload) {
  const grid = $("#quit-grid");
  grid.replaceChildren();
  if (state.quitError || !payload) {
    grid.append(el("p", "error", "Quit timers could not be loaded."));
    return;
  }
  const overrides = readOverrides();
  const timers = Array.isArray(payload.timers) ? payload.timers : [];
  state.timers = timers
    .filter((timer) => timer && timer.id && timer.label && timer.start)
    .map((timer, index) => ({
      id: String(timer.id),
      label: String(timer.label),
      defaultStart: String(timer.start),
      start: overrides[timer.id] || String(timer.start),
      override: Boolean(overrides[timer.id]),
      tone: HABIT_TONE[timer.id] || TONE_FALLBACK[index % TONE_FALLBACK.length],
    }));

  if (!state.timers.length) {
    grid.append(el("p", "empty", "No quit timers in data/quit-timers.json."));
    return;
  }

  for (const timer of state.timers) {
    grid.append(renderQuitChip(timer));
    paintElapsed(timer);
  }
  paintQuitSummary();
  updateResetAll();
}

function renderQuitChip(timer) {
  const chip = el("div", `qchip ${timer.tone}`);
  chip.dataset.timer = timer.id;
  chip.classList.toggle("is-override", timer.override);

  const main = el("button", "qchip-main");
  main.type = "button";
  const name = el("span", "qchip-name", timer.label);
  const time = el("span", "qchip-time", "—");
  time.dataset.primary = "";
  main.append(name, time);
  main.addEventListener("click", () => openSheet(timer.id));

  const restart = el("button", "qchip-restart");
  restart.type = "button";
  restart.setAttribute("aria-label", `Restart ${timer.label} from now`);
  restart.append(restartIcon());
  restart.addEventListener("click", () => restartTimer(timer.id));

  chip.append(main, restart);
  return chip;
}

function paintSheet(timer) {
  const compact = formatElapsedCompact(Date.now() - Date.parse(timer.start));
  $("#sheet-elapsed").textContent = compact.text;
  $("#sheet-since").textContent = `Since ${formatBerlinStamp(timer.start)}`;
  $("#sheet-source").hidden = !timer.override;
  $("#sheet-reset").hidden = !timer.override;
}

function sheetFocusable() {
  return [...$("#sheet-panel").querySelectorAll("button, input")].filter((node) => !node.hidden);
}

function openSheet(id) {
  const timer = state.timers.find((item) => item.id === id);
  if (!timer) return;
  state.sheetId = id;
  state.sheetReturn = document.activeElement;
  $("#sheet-title").textContent = timer.label;
  $("#sheet-input").value = toDatetimeLocalValue(timer.start);
  $("#sheet-error").hidden = true;
  paintSheet(timer);
  $("#sheet").hidden = false;
  document.body.classList.add("sheet-open");
  $("#sheet-restart").focus();
}

function closeSheet() {
  $("#sheet").hidden = true;
  document.body.classList.remove("sheet-open");
  const back = state.sheetReturn;
  state.sheetId = null;
  state.sheetReturn = null;
  if (back && typeof back.focus === "function") back.focus();
}

function setQuitCollapsed(collapsed) {
  state.quitCollapsed = collapsed;
  $("#quit-panel").hidden = collapsed;
  $("#quit-summary").hidden = !collapsed;
  const toggle = $("#quit-toggle");
  toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
  toggle.textContent = collapsed ? "Show" : "Hide";
  if (collapsed) paintQuitSummary();
  try {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
  } catch {
    /* the strip still toggles for this visit */
  }
}

function fillGlance(node, { kicker, summary, noun }) {
  node.replaceChildren();
  node.append(el("p", "glance-kicker", kicker));
  if (!summary.total) {
    node.append(el("p", "glance-count empty", "No tasks"));
    return;
  }
  const line = el("p", "glance-count");
  line.append(el("span", "glance-frac", `${summary.done}/${summary.total}`));
  line.append(document.createTextNode(" "));
  line.append(el("span", "glance-noun", noun));
  if (summary.skipped) {
    line.append(el("span", "glance-skip", `· ${summary.skipped} skipped`));
  }
  node.append(line);
  const bar = el("div", "bar");
  bar.setAttribute("role", "progressbar");
  bar.setAttribute("aria-valuemin", "0");
  bar.setAttribute("aria-valuemax", String(summary.total));
  bar.setAttribute("aria-valuenow", String(summary.done));
  bar.setAttribute("aria-label", `${kicker} ${summary.done} of ${summary.total} ${noun}`);
  const fill = el("span");
  fill.style.width = `${Math.round((100 * summary.done) / summary.total)}%`;
  bar.append(fill);
  node.append(bar);
}

function renderGlance() {
  const todayISO = berlinDateISO(new Date());
  const todayCard = $("#glance-today");
  const weekCard = $("#glance-week");
  if (state.dayError) {
    todayCard.replaceChildren(el("p", "error", "Today could not be loaded."));
  }
  if (state.weekError) {
    weekCard.replaceChildren(el("p", "error", "This week could not be loaded."));
  }
  const glance = glanceModel({
    day: state.dayError ? null : state.day,
    week: state.weekError ? null : state.week,
    todayISO,
  });
  if (!state.dayError) {
    const kicker = glance.fileIsToday || state.selectedDate === state.day?.date ? glance.dailyLabel : `Latest · ${glance.dailyLabel}`;
    fillGlance(todayCard, { kicker, summary: glance.daily, noun: "done" });
  }
  if (!state.weekError) {
    fillGlance(weekCard, { kicker: glance.weekLabel, summary: glance.workouts, noun: "workouts" });
  }
}

function renderSyncNote() {
  const note = $("#sync-note");
  const todayISO = berlinDateISO(new Date());
  const daily = state.dayError
    ? []
    : todayLists({
        day: state.day,
        week: state.weekError ? null : state.week,
        history: state.history,
        selectedDate: state.selectedDate,
        filter: "daily",
      }).daily;
  const message = syncMessage({
    dayDate: state.dayError ? "" : state.day?.date || "",
    todayISO,
    selectedDate: state.selectedDate,
    hasDailyItems: daily.length > 0,
  });
  note.hidden = !message;
  note.textContent = message;
}

function renderChrome() {
  const todayISO = berlinDateISO(new Date());
  $("#view-date").textContent = formatShortDay(state.selectedDate) || "—";
  const todayBtn = $("#jump-today");
  const onToday = state.selectedDate === todayISO;
  todayBtn.classList.toggle("is-current", onToday);
  if (onToday) todayBtn.setAttribute("aria-current", "date");
  else todayBtn.removeAttribute("aria-current");

  for (const name of ["today", "week", "month"]) {
    const tab = document.querySelector(`[data-tab="${name}"]`);
    const panel = document.querySelector(`#panel-${name}`);
    const on = state.tab === name;
    tab.setAttribute("aria-selected", on ? "true" : "false");
    tab.tabIndex = on ? 0 : -1;
    panel.hidden = !on;
  }
  for (const name of ["all", "daily", "workout"]) {
    const button = document.querySelector(`[data-filter="${name}"]`);
    const on = state.filter === name;
    button.setAttribute("aria-checked", on ? "true" : "false");
    button.classList.toggle("is-on", on);
  }
}

function habitRow(item, date, todayISO) {
  const kind = kindFromItem(item, date, todayISO);
  const row = el("article", `hrow kind-${kind}`);
  row.dataset.kind = kind;
  row.append(mark(kind));
  const copy = el("div", "hcopy");
  copy.append(el("h3", "hname", item.name || item.id || "Habit"));
  if (item.note) copy.append(el("p", "hnote", String(item.note)));
  if (item.when) copy.append(el("p", "hwhen", String(item.when)));
  if (item.planned === false) copy.append(el("p", "hwhen", "Not on the plan"));
  row.append(copy);
  row.append(el("span", `hchip kind-${kind}`, KIND_LABEL[kind] || "Open"));
  return row;
}

function weekWorkoutRow(item) {
  const kind = weekStatusKind(item.status);
  const row = el("article", `hrow kind-${kind}`);
  row.dataset.kind = kind;
  row.append(mark(kind));
  const copy = el("div", "hcopy");
  copy.append(el("h3", "hname", item.name || item.id || "Workout"));
  copy.append(el("p", "hwhen", "Weekly target"));
  row.append(copy);
  row.append(el("span", `hchip kind-${kind}`, KIND_LABEL[kind]));
  return row;
}

function renderToday() {
  const root = $("#panel-today");
  root.replaceChildren();
  if (state.dayError && state.weekError) {
    root.append(el("p", "error", "Today could not be loaded."));
    return;
  }
  const todayISO = berlinDateISO(new Date());
  const lists = todayLists({
    day: state.dayError ? null : state.day,
    week: state.weekError ? null : state.week,
    history: state.history,
    selectedDate: state.selectedDate,
    filter: state.filter,
  });
  if (!lists.daily.length && !lists.workouts.length) {
    root.append(el("p", "empty", "No tasks in the feed for this date."));
    return;
  }
  if (lists.daily.length) {
    root.append(el("h3", "block-label", "Daily"));
    const list = el("div", "hlist");
    for (const item of lists.daily) list.append(habitRow(item, state.selectedDate, todayISO));
    root.append(list);
  }
  if (lists.workouts.length) {
    root.append(el("h3", "block-label", lists.scope === "week" ? "Workouts this week" : "Workouts"));
    if (lists.scope === "week") {
      root.append(el("p", "hint", "One status for the whole week, not a bar for each day."));
    }
    const list = el("div", "hlist");
    for (const item of lists.workouts) {
      list.append(lists.scope === "week" ? weekWorkoutRow(item) : habitRow(item, state.selectedDate, todayISO));
    }
    root.append(list);
  }
}

function groupRow(label) {
  const tr = el("tr", "group-row");
  const th = el("th", null, label);
  th.colSpan = 8;
  th.scope = "colgroup";
  tr.append(th);
  return tr;
}

function dayCellsRow(row, todayISO) {
  const tr = el("tr");
  const name = el("th", "habit-name-cell", row.name);
  name.scope = "row";
  name.title = row.name;
  tr.append(name);
  for (const cell of row.cells) {
    const td = el("td", `cell kind-${cell.kind}`);
    if (cell.date === state.selectedDate) td.classList.add("is-selected");
    if (cell.date === todayISO) td.classList.add("is-today");
    if (cell.kind !== "norecord") td.append(mark(cell.kind));
    td.append(el("span", "sr-only", `${row.name}, ${formatShortDay(cell.date)}, ${KIND_LABEL[cell.kind]}`));
    tr.append(td);
  }
  return tr;
}

function weekSpanRow(row, dates, todayISO) {
  const kind = weekStatusKind(row.weekStatus);
  const tr = el("tr", "week-status-row");
  const name = el("th", "habit-name-cell has-chip");
  name.scope = "row";
  name.title = `${row.name}: ${WEEK_KIND_LABEL[kind]}`;
  name.setAttribute("aria-label", `${row.name}, ${WEEK_KIND_LABEL[kind]}`);
  const line = el("span", "name-line");
  line.append(el("span", "name-text", row.name));
  const status = el("span", "status-bit");
  status.append(mark(kind));
  status.append(el("span", `hchip kind-${kind}`, KIND_LABEL[kind]));
  line.append(status);
  name.append(line);
  tr.append(name);
  for (const date of dates) {
    const td = el("td", "cell kind-week");
    td.setAttribute("aria-hidden", "true");
    if (date === state.selectedDate) td.classList.add("is-selected");
    if (date === todayISO) td.classList.add("is-today");
    tr.append(td);
  }
  return tr;
}

function renderWeek() {
  const root = $("#panel-week");
  root.replaceChildren();
  const todayISO = berlinDateISO(new Date());
  const model = buildWeek({
    day: state.dayError ? null : state.day,
    week: state.weekError ? null : state.week,
    history: state.history,
    todayISO,
    focusDate: state.selectedDate || todayISO,
  });
  const rows = filterRows(model.rows, state.filter);
  const daily = rows.filter((row) => row.category !== "workout");
  const workouts = rows.filter((row) => row.category === "workout");
  if (!model.dates.length || (!daily.length && !workouts.length)) {
    root.append(el("p", "empty", "No habit records for this week yet."));
    return;
  }
  const span = formatWeekSpan(model.dates[0], model.dates[6]);
  root.append(el("p", "week-caption", `Week of ${span}`));
  const scroll = el("div", "week-scroll");
  const table = el("table", "week-table");
  const caption = el("caption", "sr-only", `Habits for the week of ${span}`);
  table.append(caption);
  const head = el("thead");
  const headRow = el("tr");
  const corner = el("th", "habit-name-cell", "Habit");
  corner.scope = "col";
  headRow.append(corner);
  for (const date of model.dates) {
    const th = el("th");
    th.scope = "col";
    if (date === state.selectedDate) th.classList.add("is-selected");
    if (date === todayISO) th.classList.add("is-today");
    const button = el("button", "day-btn");
    button.type = "button";
    button.append(el("span", "day-letter", weekdayNarrow(date)));
    button.append(el("span", "day-num", String(Number(date.slice(-2)))));
    const label = formatShortDay(date);
    button.setAttribute("aria-label", date === todayISO ? `${label}, today` : label);
    if (date === todayISO) button.setAttribute("aria-current", "date");
    button.addEventListener("click", () => selectDate(date));
    th.append(button);
    headRow.append(th);
  }
  head.append(headRow);
  table.append(head);
  const body = el("tbody");
  if (daily.length) {
    body.append(groupRow("Daily"));
    for (const row of daily) body.append(row.mode === "week" ? weekSpanRow(row, model.dates, todayISO) : dayCellsRow(row, todayISO));
  }
  if (workouts.length) {
    body.append(groupRow("Workouts"));
    for (const row of workouts) body.append(row.mode === "week" ? weekSpanRow(row, model.dates, todayISO) : dayCellsRow(row, todayISO));
  }
  table.append(body);
  scroll.append(table);
  root.append(scroll);
  root.append(
    el(
      "p",
      "hint",
      "A chip on the name is that workout’s status for the whole week. Blank days are not misses. An outline is upcoming."
    )
  );
}

function renderMonth() {
  const root = $("#panel-month");
  root.replaceChildren();
  const todayISO = berlinDateISO(new Date());
  const nav = el("div", "month-nav");
  const prev = el("button", "icon-btn", "‹");
  prev.type = "button";
  prev.setAttribute("aria-label", "Previous month");
  prev.addEventListener("click", () => {
    state.viewMonth = shiftMonth(state.viewMonth, -1);
    render();
  });
  const next = el("button", "icon-btn", "›");
  next.type = "button";
  next.setAttribute("aria-label", "Next month");
  next.addEventListener("click", () => {
    state.viewMonth = shiftMonth(state.viewMonth, 1);
    render();
  });
  nav.append(prev, el("p", "month-label", formatMonthLabel(state.viewMonth)), next);
  root.append(nav);

  const month = buildMonth({
    monthKey: state.viewMonth,
    day: state.dayError ? null : state.day,
    history: state.history,
    todayISO,
    filter: state.filter,
  });
  if (!month.any) {
    const empty = el("div", "empty-card");
    empty.append(el("p", "empty-title", "History builds up over time."));
    empty.append(
      el(
        "p",
        "hint",
        "When Todo BOT writes data/history.json, each day shows a completion percent here."
      )
    );
    root.append(empty);
    return;
  }

  const grid = el("div", "month-grid");
  const anchor = weekDates(`${state.viewMonth}-01`);
  for (const date of anchor) grid.append(el("div", "month-dow", weekdayNarrow(date)));
  for (const cell of month.cells) {
    if (!cell) {
      grid.append(el("div", "mcell mcell-pad"));
      continue;
    }
    const button = el("button", "mcell");
    button.type = "button";
    if (cell.percent != null) {
      button.classList.add("has-data");
      if (cell.percent >= 100) button.dataset.band = "3";
      else if (cell.percent >= 50) button.dataset.band = "2";
      else if (cell.percent > 0) button.dataset.band = "1";
      else button.dataset.band = "0";
    }
    if (cell.date === state.selectedDate) button.classList.add("is-selected");
    if (cell.isToday) button.classList.add("is-today");
    button.append(el("span", "mday", String(cell.day)));
    if (cell.percent != null) button.append(el("span", "mpct", `${cell.percent}%`));
    const detail = cell.percent == null ? "no record" : `${cell.summary.done} of ${cell.summary.total} done`;
    button.setAttribute("aria-label", `${formatShortDay(cell.date)}, ${detail}`);
    button.addEventListener("click", () => openDay(cell.date));
    grid.append(button);
  }
  root.append(grid);
  if (!state.history) {
    root.append(
      el(
        "p",
        "hint",
        "Only days already in the feed are filled in. Earlier days appear when data/history.json is added."
      )
    );
  }
}

function nameBlock(title, items) {
  const block = el("div");
  block.append(el("h3", "subhead", title));
  const list = el("ul", "tracked-list");
  if (!items.length) list.append(el("li", "empty", "None"));
  for (const item of items) {
    const li = el("li", null, item.name);
    li.title = item.id;
    list.append(li);
  }
  block.append(list);
  return block;
}

function renderTracked() {
  const root = $("#tracked");
  root.replaceChildren();
  if (state.dayError && state.weekError) return;
  const feed = feedListing({
    day: state.dayError ? null : state.day,
    week: state.weekError ? null : state.week,
    history: state.history,
  });
  const head = el("div", "tracked-head");
  head.append(el("h2", null, "Tracked from Todoist"));
  const line = syncLine(feed.dayUpdated, feed.weekUpdated);
  if (line) head.append(el("p", "sync-line", line));
  root.append(head);
  const cols = el("div", "tracked-cols");
  cols.append(nameBlock("Daily", feed.daily));
  cols.append(nameBlock("Workouts", feed.workouts));
  root.append(cols);
  if (feed.also.length) {
    root.append(el("h3", "subhead", "Also in the week file"));
    const list = el("ul", "tracked-list");
    for (const item of feed.also) {
      const li = el("li");
      li.append(document.createTextNode(item.name));
      if (item.when) li.append(el("span", "hwhen", ` · ${item.when}`));
      list.append(li);
    }
    root.append(list);
  }
}

function fitnessHasContent(fitness) {
  if (!fitness || typeof fitness !== "object") return false;
  const recap = typeof fitness.sundayRecap === "string" && fitness.sundayRecap.trim();
  const stats = Array.isArray(fitness.stats) && fitness.stats.length;
  const workouts = Array.isArray(fitness.workouts) && fitness.workouts.length;
  return Boolean(recap || stats || workouts);
}

function renderFitness() {
  const root = $("#fitness");
  root.replaceChildren();
  const heading = el("h2", null, "Logged sessions");
  heading.id = "fitness-heading";
  if (state.fitnessError) {
    root.append(heading);
    root.append(el("p", "error", "Fitness could not be loaded."));
    return;
  }
  if (!fitnessHasContent(state.fitness)) {
    root.append(heading);
    root.append(el("p", "hint", "Appears here when Fitness Bot writes data/fitness.json."));
    return;
  }
  const fitness = state.fitness;
  root.append(heading);
  root.append(el("p", "hint", "From Fitness Bot. Separate from the Todoist workout list."));
  if (typeof fitness.sundayRecap === "string" && fitness.sundayRecap.trim()) {
    root.append(el("p", "recap", fitness.sundayRecap.trim()));
  }
  if (Array.isArray(fitness.stats) && fitness.stats.length) {
    const bits = fitness.stats.map((stat) => `${stat.label || "Stat"} ${stat.value ?? "—"}`);
    root.append(el("p", "stat-line", `Fitness Bot · ${bits.join(" · ")}`));
  }
  if (Array.isArray(fitness.workouts) && fitness.workouts.length) {
    const list = el("div", "hlist");
    for (const workout of fitness.workouts) {
      const card = el("article", "hrow session");
      const copy = el("div", "hcopy");
      copy.append(el("h3", "hname", workout.name || "Session"));
      if (workout.date) copy.append(el("p", "hwhen", formatShortDay(workout.date)));
      if (workout.detail) copy.append(el("p", "hnote", String(workout.detail)));
      card.append(copy);
      list.append(card);
    }
    root.append(list);
  }
}

function renderLegend() {
  const row = $("#legend");
  if (row.childElementCount) return;
  for (const kind of ["completed", "skipped", "missed", "open", "upcoming"]) {
    const item = el("span", "legend-item");
    item.setAttribute("role", "listitem");
    item.append(mark(kind));
    item.append(el("span", null, KIND_LABEL[kind]));
    row.append(item);
  }
}

function render() {
  renderChrome();
  renderGlance();
  renderSyncNote();
  renderToday();
  renderWeek();
  renderMonth();
  renderTracked();
  renderFitness();
}

function selectDate(iso) {
  if (!iso) return;
  state.selectedDate = iso;
  state.viewMonth = iso.slice(0, 7);
  render();
}

function openDay(iso) {
  state.selectedDate = iso;
  state.viewMonth = iso.slice(0, 7);
  setTab("today");
}

function setTab(tab) {
  state.tab = tab;
  const next = `${location.pathname}${location.search}#${tab}`;
  history.replaceState(null, "", next);
  render();
}

function bindControls() {
  $("#range-tabs").addEventListener("click", (event) => {
    const tab = event.target.closest("[data-tab]");
    if (!tab) return;
    setTab(tab.dataset.tab);
  });
  $("#range-tabs").addEventListener("keydown", (event) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    const order = ["today", "week", "month"];
    const index = order.indexOf(state.tab);
    const next = event.key === "ArrowRight" ? (index + 1) % order.length : (index + order.length - 1) % order.length;
    event.preventDefault();
    setTab(order[next]);
    document.querySelector(`[data-tab="${order[next]}"]`).focus();
  });
  document.querySelector(".filters").addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    state.filter = button.dataset.filter;
    render();
  });
  $("#prev-day").addEventListener("click", () => selectDate(addDaysISO(state.selectedDate, -1)));
  $("#next-day").addEventListener("click", () => selectDate(addDaysISO(state.selectedDate, 1)));
  $("#jump-today").addEventListener("click", () => selectDate(berlinDateISO(new Date())));
  $("#quit-toggle").addEventListener("click", () => setQuitCollapsed(!state.quitCollapsed));
  $("#reset-all").addEventListener("click", () => {
    const ok = window.confirm("Clear every quit-timer date saved in this browser?");
    if (!ok) return;
    try {
      localStorage.removeItem(OVERRIDE_KEY);
    } catch {
      return;
    }
    for (const timer of state.timers) applyTimerStart(timer.id, timer.defaultStart, { override: false });
  });
  $("#sheet-backdrop").addEventListener("click", closeSheet);
  $("#sheet-cancel").addEventListener("click", closeSheet);
  $("#sheet-restart").addEventListener("click", () => {
    if (state.sheetId) restartTimer(state.sheetId);
  });
  $("#sheet-reset").addEventListener("click", () => {
    const timer = state.timers.find((item) => item.id === state.sheetId);
    if (!timer) return;
    const ok = window.confirm(`Use the start date from quit-timers.json for “${timer.label}”?`);
    if (!ok) return;
    try {
      saveOverride(timer.id, timer.defaultStart);
      closeSheet();
    } catch (err) {
      const error = $("#sheet-error");
      error.hidden = false;
      error.textContent = err.message || "Could not reset that date.";
    }
  });
  $("#sheet-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const timer = state.timers.find((item) => item.id === state.sheetId);
    if (!timer) return;
    const error = $("#sheet-error");
    try {
      const iso = berlinLocalToISO($("#sheet-input").value);
      if (Number.isNaN(Date.parse(iso))) throw new Error("That date did not parse.");
      saveOverride(timer.id, iso);
      closeSheet();
    } catch (err) {
      error.hidden = false;
      error.textContent = err.message || "Could not save that date.";
    }
  });
  document.addEventListener("keydown", (event) => {
    if ($("#sheet").hidden) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeSheet();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = sheetFocusable();
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
}

async function init() {
  state.tab = initialTab();
  state.selectedDate = berlinDateISO(new Date());
  state.viewMonth = state.selectedDate.slice(0, 7);
  try {
    state.quitCollapsed = localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    state.quitCollapsed = false;
  }
  bindControls();
  renderLegend();
  setQuitCollapsed(state.quitCollapsed);
  paintClock();
  setInterval(tick, 1000);

  const [quit, day, week, fitness, history] = await Promise.all([
    loadJson("data/quit-timers.json"),
    loadJson("data/habits-day.json"),
    loadJson("data/habits-week.json"),
    loadJson("data/fitness.json", { optional: true }),
    loadJson("data/history.json", { optional: true }),
  ]);

  state.quitError = Boolean(quit.error);
  state.dayError = Boolean(day.error);
  state.weekError = Boolean(week.error);
  state.fitnessError = Boolean(fitness.error);
  state.day = day.data;
  state.week = week.data;
  state.fitness = fitness.data;
  state.history = history.data;

  if (state.day?.date) {
    state.selectedDate = state.day.date;
    state.viewMonth = state.day.date.slice(0, 7);
  }

  renderQuit(quit.data);
  const sample = Boolean((state.day && state.day.sample) || (state.week && state.week.sample));
  $("#sample-banner").hidden = !sample;
  if (quit.data?.timezone && quit.data.timezone !== TZ) {
    const tz = $("#quit-tz");
    tz.hidden = false;
    tz.textContent = `File timezone is ${quit.data.timezone}. This page still shows Europe/Berlin.`;
  }
  render();
}

init();
