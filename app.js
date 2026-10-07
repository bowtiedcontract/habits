import {
  TZ,
  berlinDateISO,
  berlinLocalToISO,
  berlinParts,
  formatBerlinStamp,
  formatQuitClock,
  formatShortDay,
  formatSpokenDay,
  formatWeekSpan,
  toDatetimeLocalValue,
} from "./time.js";
import {
  KIND_LABEL,
  addDaysISO,
  buildWeek,
  feedListing,
  glanceModel,
  kindFromItem,
  summarize,
  summarizeDayCells,
  syncLine,
  syncMessage,
  todayLists,
  weekStatusKind,
  workoutQuota,
  workoutWeekSummary,
} from "./habits.js";

const OVERRIDE_KEY = "habits.quitTimerOverrides";
const SVG = "http://www.w3.org/2000/svg";
const TABS = ["today", "week", "quit"];

const QUIT_COLOR = {
  "no-smoking": "#ff5c7a",
  "no-vaping": "#3ee0f0",
  "no-alcohol": "#ff9f43",
  "no-fap": "#ff4d6a",
  caffeine: "#f5b942",
  sweets: "#d7a6ff",
};

const QUIT_FALLBACK = ["#ff5c7a", "#3ee0f0", "#ff9f43", "#ff4d6a", "#f5b942", "#d7a6ff"];

const ICON_COLOR = {
  book: "#7dd3fc",
  pill: "#fdba74",
  chart: "#5eead4",
  bolt: "#fde68a",
  mountain: "#93c5fd",
  leaf: "#86efac",
  dumbbell: "#67e8f9",
  pulse: "#7dd3fc",
  spark: "#d8b4fe",
};

const ICONS = {
  book: ["M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z", "M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"],
  pill: ["M10.5 20.5l10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7z", "M8.5 8.5l7 7"],
  chart: ["M23 6l-9.5 9.5-5-5L1 18", "M17 6h6v6"],
  bolt: ["M13 2L3 14h9l-1 8 10-12h-9l1-8z"],
  mountain: ["m8 3 4 8 5-5 5 15H2L8 3z"],
  leaf: ["M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z", "M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"],
  dumbbell: ["M6.5 6.5v11", "M17.5 6.5v11", "M3.5 9v6", "M20.5 9v6", "M6.5 12h11"],
  pulse: ["M22 12h-4l-3 9L9 3l-3 9H2"],
  spark: ["M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"],
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
  quitTzNote: "",
  tab: "today",
  selectedDate: "",
  openDay: "",
  editorId: null,
  editorReturn: null,
  aboutReturn: null,
  userPickedDate: false,
};

const $ = (selector) => document.querySelector(selector);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function svgIcon(paths, size) {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("aria-hidden", "true");
  for (const d of paths) {
    const path = document.createElementNS(SVG, "path");
    path.setAttribute("d", d);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "2");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    svg.append(path);
  }
  return svg;
}

function iconKey(id, name) {
  const hay = `${id || ""} ${name || ""}`.toLowerCase();
  if (hay.includes("german") || hay.includes("anki") || hay.includes("read")) return "book";
  if (hay.includes("vitamin") || hay.includes("supplement")) return "pill";
  if (hay.includes("invest")) return "chart";
  if (hay.includes("sprint")) return "bolt";
  if (hay.includes("boulder") || hay.includes("climb")) return "mountain";
  if (hay.includes("yoga") || hay.includes("meditat")) return "leaf";
  if (hay.includes("abs") || hay.includes("forearm") || hay.includes("strength")) return "dumbbell";
  if (hay.includes("couch") || hay.includes("run") || hay.includes("cardio") || hay.includes("5k")) return "pulse";
  return "spark";
}

function habitIcon(id, name) {
  const key = iconKey(id, name);
  const wrap = el("span", "hab-icon");
  wrap.style.setProperty("--ico", ICON_COLOR[key] || ICON_COLOR.spark);
  wrap.append(svgIcon(ICONS[key] || ICONS.spark, 22));
  return wrap;
}

function mark(kind) {
  const span = el("span", `mark mark-${kind}`);
  span.setAttribute("aria-hidden", "true");
  if (kind === "completed") span.append(svgIcon(["M20 6L9 17l-5-5"], 20));
  if (kind === "missed") span.append(svgIcon(["M18 6L6 18", "M6 6l12 12"], 18));
  return span;
}

function statusNode(kind) {
  const visual = kind === "upcoming" ? "open" : kind;
  const wrap = el("div", "status");
  if (kind === "skipped" || kind === "missed" || kind === "unplanned") {
    const word = el("span", kind === "missed" ? "status-word miss" : "status-word", KIND_LABEL[kind] || "Open");
    wrap.append(word);
  }
  if (kind !== "unplanned" && (visual === "completed" || visual === "open" || visual === "skipped" || visual === "missed")) {
    wrap.append(mark(visual));
  }
  if (kind === "completed" || kind === "open" || kind === "upcoming") {
    wrap.append(el("span", "sr-only", KIND_LABEL[kind] || "Open"));
  }
  return wrap;
}

function chevron() {
  const svg = svgIcon(["M6 9l6 6 6-6"], 22);
  svg.setAttribute("class", "chev");
  return svg;
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

function readTab() {
  const hash = location.hash.replace(/^#/, "");
  if (TABS.includes(hash)) return hash;
  const query = new URLSearchParams(location.search).get("tab");
  if (TABS.includes(query)) return query;
  return "today";
}

function writeHash(tab) {
  const next = `${location.pathname}${location.search}#${tab}`;
  if (`${location.pathname}${location.search}${location.hash}` !== next) {
    history.replaceState(null, "", next);
  }
}

function applyTab(tab) {
  state.tab = tab;
  document.documentElement.dataset.tab = tab;
  for (const name of TABS) {
    const on = name === tab;
    const button = document.getElementById(`tab-${name}`);
    const panel = document.getElementById(`panel-${name}`);
    button.setAttribute("aria-selected", on ? "true" : "false");
    button.tabIndex = on ? 0 : -1;
    panel.hidden = !on;
  }
}

function setTab(tab) {
  if (!TABS.includes(tab) || tab === state.tab) return;
  writeHash(tab);
  applyTab(tab);
  window.scrollTo(0, 0);
}

function anchorDate() {
  if (state.day?.date) return state.day.date;
  return berlinDateISO(new Date());
}

function selectDate(iso) {
  if (!iso || iso === state.selectedDate) return;
  state.userPickedDate = true;
  state.selectedDate = iso;
  state.openDay = "";
  renderDays();
  window.scrollTo(0, 0);
}

function shiftDay(delta) {
  selectDate(addDaysISO(state.selectedDate, delta));
}

function paintQuitClocks() {
  const now = Date.now();
  for (const timer of state.timers) {
    const card = document.querySelector(`[data-timer="${timer.id}"]`);
    if (!card) continue;
    const clock = formatQuitClock(now - Date.parse(timer.start));
    const time = card.querySelector("[data-time]");
    const since = card.querySelector("[data-since]");
    if (time) time.textContent = clock.text;
    if (since) since.textContent = clock.future ? "until start" : "since quitting";
  }
  if (state.editorId) {
    const timer = state.timers.find((item) => item.id === state.editorId);
    if (timer) paintEditor(timer);
  }
}

function tick() {
  paintQuitClocks();
}

function updateResetAll() {
  const button = $("#reset-all");
  if (button) button.hidden = !state.timers.some((timer) => timer.override);
}

function applyTimerStart(id, iso, { override }) {
  const timer = state.timers.find((item) => item.id === id);
  if (!timer) return;
  timer.start = iso;
  timer.override = override;
  const card = document.querySelector(`[data-timer="${id}"]`);
  if (card) card.classList.toggle("is-override", override);
  paintQuitClocks();
  updateResetAll();
  if (state.editorId === id) {
    const input = $("#editor-input");
    if (input) input.value = toDatetimeLocalValue(iso);
    paintEditor(timer);
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
    const error = $("#editor-error");
    if (error) error.hidden = true;
  } catch (err) {
    if (state.editorId === id) {
      const error = $("#editor-error");
      error.hidden = false;
      error.textContent = err.message || "Could not restart.";
    }
  }
}

function resetAll() {
  const ok = window.confirm("Clear every quit-timer date saved in this browser?");
  if (!ok) return;
  try {
    localStorage.removeItem(OVERRIDE_KEY);
  } catch {
    return;
  }
  for (const timer of state.timers) applyTimerStart(timer.id, timer.defaultStart, { override: false });
}

function loadTimers(payload) {
  const overrides = readOverrides();
  const timers = Array.isArray(payload?.timers) ? payload.timers : [];
  state.timers = timers
    .filter((timer) => timer && timer.id && timer.label && timer.start)
    .map((timer, index) => ({
      id: String(timer.id),
      label: String(timer.label),
      defaultStart: String(timer.start),
      start: overrides[timer.id] || String(timer.start),
      override: Boolean(overrides[timer.id]),
      color: QUIT_COLOR[timer.id] || QUIT_FALLBACK[index % QUIT_FALLBACK.length],
    }));
}

function renderQuit() {
  const root = $("#panel-quit");
  root.replaceChildren();
  if (state.quitError) {
    root.append(el("p", "plain", "Quit timers could not be loaded."));
    return;
  }
  if (!state.timers.length) {
    root.append(el("p", "plain", "No quit timers in the file."));
    return;
  }
  const list = el("div", "qlist");
  for (const timer of state.timers) {
    const card = el("article", "qcard");
    card.dataset.timer = timer.id;
    card.style.setProperty("--q", timer.color);
    card.classList.toggle("is-override", timer.override);
    const label = el("h2", "qlabel", timer.label);
    const edit = el("button", "hit qedit");
    edit.type = "button";
    edit.dataset.edit = timer.id;
    edit.setAttribute("aria-label", `Edit ${timer.label}`);
    edit.append(svgIcon(["M12 20h9", "M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"], 22));
    const mid = el("div", "qmid");
    const time = el("p", "qtime", "—");
    time.dataset.time = "";
    const since = el("p", "qsince", "since quitting");
    since.dataset.since = "";
    mid.append(time, since);
    card.append(label, edit, mid);
    list.append(card);
  }
  root.append(list);
  paintQuitClocks();
}

function paintEditor(timer) {
  const clock = formatQuitClock(Date.now() - Date.parse(timer.start));
  $("#editor-elapsed").textContent = clock.text;
  $("#editor-elapsed").style.color = timer.color;
  $("#editor-since").textContent = clock.future
    ? `Until ${formatBerlinStamp(timer.start)}`
    : `Since ${formatBerlinStamp(timer.start)}`;
  $("#editor-source").hidden = !timer.override;
  $("#editor-reset").hidden = !timer.override;
}

function openEditor(id) {
  const timer = state.timers.find((item) => item.id === id);
  if (!timer) return;
  state.editorId = id;
  state.editorReturn = document.activeElement;
  $("#editor-title").textContent = timer.label;
  $("#editor-input").value = toDatetimeLocalValue(timer.start);
  $("#editor-error").hidden = true;
  paintEditor(timer);
  $("#editor").hidden = false;
  document.body.classList.add("sheet-open");
  $("#editor-restart").focus();
}

function closeEditor() {
  $("#editor").hidden = true;
  if ($("#about").hidden) document.body.classList.remove("sheet-open");
  const back = state.editorReturn;
  state.editorId = null;
  state.editorReturn = null;
  if (back && typeof back.focus === "function") back.focus();
}

function doneMark() {
  const span = el("span", "mark mark-done");
  span.setAttribute("aria-hidden", "true");
  span.append(svgIcon(["M20 6L9 17l-5-5"], 20));
  return span;
}

function quotaBar(quota) {
  const bar = el("span", quota.met ? "quota-bar is-full" : "quota-bar");
  bar.setAttribute("role", "progressbar");
  bar.setAttribute("aria-valuemin", "0");
  bar.setAttribute("aria-valuemax", String(quota.target));
  bar.setAttribute("aria-valuenow", String(Math.min(quota.done, quota.target)));
  bar.setAttribute("aria-label", `${quota.done} of ${quota.target}`);
  const fill = el("span");
  fill.style.width = `${Math.round((100 * Math.min(quota.done, quota.target)) / quota.target)}%`;
  bar.append(fill);
  return bar;
}

function quotaReadout(name, quota) {
  const wrap = el("div", "status");
  wrap.append(el("span", "quota-count", `${quota.done} / ${quota.target}`));
  if (quota.met) {
    wrap.append(doneMark());
    wrap.append(el("span", "sr-only", `${name}, done`));
  }
  return wrap;
}

function habitCard(item, kind, subtitle, options = {}) {
  const quota = options.track ? workoutQuota(item) : null;
  const card = el("article", "hcard");
  card.dataset.kind = quota ? (quota.met ? "completed" : "open") : kind;
  card.append(habitIcon(item.id, item.name));
  const copy = el("div");
  copy.append(el("h3", "hname", item.name || item.id || "Habit"));
  copy.append(el("p", "hsub", subtitle));
  if (quota) copy.append(quotaBar(quota));
  card.append(copy);
  const label = item.name || item.id || "Habit";
  card.append(quota ? quotaReadout(label, quota) : statusNode(kind));
  return card;
}

function sessionCard(workout) {
  const card = el("article", "hcard session");
  card.append(habitIcon(workout.name, workout.name));
  const copy = el("div");
  copy.append(el("h3", "hname", workout.name || "Session"));
  if (workout.date) copy.append(el("p", "hsub", formatShortDay(workout.date)));
  if (workout.detail) copy.append(el("p", "hdetail", String(workout.detail)));
  card.append(copy);
  return card;
}

function ringBlock(summary) {
  const hero = el("div", "hero");
  const ring = el("div", "ring");
  const ratio = summary.total ? summary.done / summary.total : 0;
  const radius = 46;
  const circ = 2 * Math.PI * radius;
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 120 120");
  svg.setAttribute("aria-hidden", "true");
  const track = document.createElementNS(SVG, "circle");
  track.setAttribute("cx", "60");
  track.setAttribute("cy", "60");
  track.setAttribute("r", String(radius));
  track.setAttribute("fill", "none");
  track.setAttribute("stroke", "rgba(255,255,255,0.14)");
  track.setAttribute("stroke-width", "10");
  svg.append(track);
  if (ratio > 0) {
    const value = document.createElementNS(SVG, "circle");
    value.setAttribute("cx", "60");
    value.setAttribute("cy", "60");
    value.setAttribute("r", String(radius));
    value.setAttribute("fill", "none");
    value.setAttribute("stroke", ratio >= 1 ? "#3ddc84" : "#f6f3ff");
    value.setAttribute("stroke-width", "10");
    value.setAttribute("stroke-linecap", "round");
    value.setAttribute("stroke-dasharray", circ.toFixed(3));
    value.setAttribute("stroke-dashoffset", (circ * (1 - ratio)).toFixed(3));
    value.setAttribute("transform", "rotate(-90 60 60)");
    svg.append(value);
  }
  const copy = el("div", "ring-copy");
  const pct = summary.total ? Math.round((100 * summary.done) / summary.total) : 0;
  copy.append(el("p", "ring-pct", `${pct}%`));
  ring.append(svg, copy);
  ring.setAttribute("aria-hidden", "true");
  const of = el("p", "ring-of", `${summary.done} of ${summary.total} done`);
  hero.append(ring, of);
  hero.setAttribute("role", "img");
  hero.setAttribute("aria-label", `${summary.done} of ${summary.total} done, ${pct} percent`);
  return hero;
}

function renderToday() {
  const root = $("#panel-today");
  root.replaceChildren();
  const todayISO = berlinDateISO(new Date());
  const day = state.dayError ? null : state.day;
  const week = state.weekError ? null : state.week;

  if (state.dayError && state.weekError) {
    root.append(el("p", "plain", "Today could not be loaded."));
    return;
  }

  const lists = todayLists({
    day,
    week,
    history: state.history,
    selectedDate: state.selectedDate,
    filter: "all",
  });
  const waiting = syncMessage({
    dayDate: day?.date || "",
    todayISO,
    selectedDate: state.selectedDate,
    hasDailyItems: lists.daily.length > 0,
  });
  if (waiting && waiting.startsWith("Waiting")) root.append(el("p", "plain", waiting));

  const nav = el("div", "date-nav");
  const prev = el("button", "hit");
  prev.id = "prev-day";
  prev.type = "button";
  prev.setAttribute("aria-label", "Previous day");
  prev.append(svgIcon(["M15 18l-6-6 6-6"], 26));
  const mid = el("div", "date-mid");
  const label = el("p", "date-label", formatSpokenDay(state.selectedDate) || "—");
  label.id = "view-date";
  label.setAttribute("aria-live", "polite");
  mid.append(label);
  const anchor = anchorDate();
  if (state.selectedDate && state.selectedDate !== anchor) {
    const back = el("button", "jump-back", `Back to ${formatShortDay(anchor)}`);
    back.id = "jump-back";
    back.type = "button";
    mid.append(back);
  }
  const next = el("button", "hit");
  next.id = "next-day";
  next.type = "button";
  next.setAttribute("aria-label", "Next day");
  next.append(svgIcon(["M9 18l6-6-6-6"], 26));
  nav.append(prev, mid, next);
  root.append(nav);

  if (lists.daily.length) {
    root.append(ringBlock(summarize(lists.daily)));
    const stack = el("div", "stack");
    for (const item of lists.daily) {
      const kind = kindFromItem(item, state.selectedDate, todayISO);
      const subtitle = item.planned === false ? "Not planned" : item.note ? String(item.note) : "Daily";
      stack.append(habitCard(item, kind, subtitle));
    }
    root.append(stack);
  } else if (waiting && !waiting.startsWith("Waiting")) {
    root.append(el("p", "plain", waiting));
  } else if (!state.dayError) {
    root.append(el("p", "plain", "No habits for this day."));
  } else {
    root.append(el("p", "plain", "Today's habits could not be loaded."));
  }

  if (state.weekError) {
    root.append(el("h2", "section-title", "This week's workouts"));
    root.append(el("p", "plain", "This week could not be loaded."));
    return;
  }

  const workouts = (Array.isArray(week?.workouts) ? week.workouts : []).filter((item) => item && (item.id || item.name));
  if (!workouts.length) return;
  const glance = glanceModel({ day, week, todayISO });
  const summary = workoutWeekSummary({
    workouts,
    workoutTotal: week?.workoutTotal,
    current: glance.weekIsCurrent,
  });
  root.append(el("h2", "section-title", glance.weekIsCurrent ? "This week's workouts" : "Workouts"));
  root.append(el("p", "count-line", summary.text));
  const stack = el("div", "stack");
  for (const item of workouts) {
    stack.append(habitCard(item, weekStatusKind(item.status), "This week", { track: true }));
  }
  root.append(stack);
}

function dayCard(model, todayISO) {
  const article = el("article", "daycard");
  if (model.date === todayISO) article.classList.add("is-today");
  const open = state.openDay === model.date;
  if (open) article.classList.add("is-open");
  const button = el("button", "daycard-toggle");
  button.type = "button";
  button.dataset.day = model.date;
  button.setAttribute("aria-expanded", open ? "true" : "false");
  const row = el("span", "daycard-row");
  row.append(el("span", "daycard-name", formatShortDay(model.date)));
  const end = el("span", "daycard-end");
  if (model.tone === "scored") {
    end.append(el("span", "daycard-score", `${model.done}/${model.total}`));
    end.append(el("span", "sr-only", " done"));
  } else {
    end.append(el("span", "daycard-note", model.tone === "upcoming" ? "Upcoming" : "No record"));
  }
  end.append(chevron());
  row.append(end);
  button.append(row);
  if (model.tone === "scored" && model.total) {
    const bar = el("span", model.done === model.total ? "mini-bar is-full" : "mini-bar");
    bar.setAttribute("aria-hidden", "true");
    const fill = el("span");
    fill.style.width = `${Math.round((100 * model.done) / model.total)}%`;
    bar.append(fill);
    button.append(bar);
  }
  article.append(button);
  if (open) {
    const body = el("div", "daycard-body");
    if (!model.details.length) {
      body.append(el("p", "plain", "No record for this day."));
    }
    for (const detail of model.details) {
      const line = el("div", "dayline");
      const quota = detail.category === "workout" ? workoutQuota(detail) : null;
      const copy = el("div");
      copy.append(el("p", "dayline-name", detail.name));
      if (quota) copy.append(quotaBar(quota));
      line.append(copy);
      line.append(quota ? quotaReadout(detail.name, quota) : statusNode(detail.kind));
      body.append(line);
    }
    article.append(body);
  }
  return article;
}

function fitnessHasContent(fitness) {
  if (!fitness || typeof fitness !== "object") return false;
  const recap = typeof fitness.sundayRecap === "string" && fitness.sundayRecap.trim();
  const stats = Array.isArray(fitness.stats) && fitness.stats.length;
  const workouts = Array.isArray(fitness.workouts) && fitness.workouts.length;
  return Boolean(recap || stats || workouts);
}

function renderFitness(root) {
  if (state.fitnessError) {
    root.append(el("h2", "section-title", "Logged sessions"));
    root.append(el("p", "plain", "Fitness could not be loaded."));
    return;
  }
  if (!fitnessHasContent(state.fitness)) return;
  const fitness = state.fitness;
  root.append(el("h2", "section-title", "Logged sessions"));
  if (typeof fitness.sundayRecap === "string" && fitness.sundayRecap.trim()) {
    root.append(el("p", "plain", fitness.sundayRecap.trim()));
  }
  if (Array.isArray(fitness.stats) && fitness.stats.length) {
    const text = fitness.stats.map((stat) => `${stat.label || "Stat"} ${stat.value ?? "—"}`).join(" · ");
    root.append(el("p", "plain", text));
  }
  if (Array.isArray(fitness.workouts) && fitness.workouts.length) {
    const stack = el("div", "stack");
    for (const workout of fitness.workouts) stack.append(sessionCard(workout));
    root.append(stack);
  }
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
  if (!model.dates.length) {
    root.append(el("p", "plain", "No week to show."));
    return;
  }
  root.append(el("h2", "panel-title", "This week"));
  root.append(el("p", "week-range", formatWeekSpan(model.dates[0], model.dates[6])));
  const stack = el("div", "stack");
  for (const date of model.dates) stack.append(dayCard(summarizeDayCells(model.rows, date), todayISO));
  root.append(stack);
  renderFitness(root);
}

function nameGroup(title, items) {
  const block = el("div");
  block.append(el("h3", null, title));
  const list = el("ul", "about-list");
  if (!items.length) list.append(el("li", null, "None"));
  for (const item of items) list.append(el("li", null, item.name));
  block.append(list);
  return block;
}

function renderAbout() {
  const body = $("#about-body");
  if (!body) return;
  body.replaceChildren();
  const day = state.dayError ? null : state.day;
  const week = state.weekError ? null : state.week;
  if ((day && day.sample) || (week && week.sample)) {
    body.append(el("p", "plain", "Sample habit data. Todo BOT will replace the day and week files."));
  }
  body.append(el("h3", null, "Tracked from Todoist"));
  if (state.dayError && state.weekError) {
    body.append(el("p", "plain", "The habit files could not be loaded."));
  } else {
    const feed = feedListing({ day, week, history: state.history });
    const line = syncLine(feed.dayUpdated, feed.weekUpdated);
    if (line) body.append(el("p", "plain", line));
    body.append(nameGroup("Daily", feed.daily));
    body.append(nameGroup("Workouts", feed.workouts));
    if (feed.also.length) {
      const list = el("ul", "about-list");
      for (const item of feed.also) {
        const text = item.when ? `${item.name} · ${item.when}` : item.name;
        list.append(el("li", null, text));
      }
      const block = el("div");
      block.append(el("h3", null, "Also in the week file"));
      block.append(list);
      body.append(block);
    }
  }
  body.append(el("p", "plain", "Read-only. Tick habits in Todoist."));
  body.append(el("p", "plain", "Quit labels on this page are visible to anyone with the link."));
  body.append(el("p", "plain", "Resets save in this browser only. Phone and laptop do not share these dates."));
  body.append(el("p", "plain", "Earlier days stay blank until a history file is synced."));
  if (state.quitTzNote) body.append(el("p", "plain", state.quitTzNote));
  const reset = el("button", "btn btn-secondary", "Reset all dates to the file");
  reset.type = "button";
  reset.id = "reset-all";
  reset.hidden = !state.timers.some((timer) => timer.override);
  reset.addEventListener("click", resetAll);
  body.append(reset);
}

function renderDays() {
  renderToday();
  renderWeek();
}

function openAbout() {
  state.aboutReturn = document.activeElement;
  $("#about").hidden = false;
  document.body.classList.add("sheet-open");
  $("#about-close").focus();
}

function closeAbout() {
  $("#about").hidden = true;
  if ($("#editor").hidden) document.body.classList.remove("sheet-open");
  const back = state.aboutReturn;
  state.aboutReturn = null;
  if (back && typeof back.focus === "function") back.focus();
}

function trapSheet(panel, event) {
  if (event.key !== "Tab") return;
  const focusable = [...panel.querySelectorAll("button, input")].filter((node) => !node.hidden && !node.closest("[hidden]"));
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
}

function bind() {
  $("#info-open").addEventListener("click", openAbout);
  $("#about-backdrop").addEventListener("click", closeAbout);
  $("#about-close").addEventListener("click", closeAbout);

  document.querySelector(".tabbar").addEventListener("click", (event) => {
    const tab = event.target.closest("[data-tab]");
    if (!tab) return;
    setTab(tab.dataset.tab);
  });
  document.querySelector(".tabbar").addEventListener("keydown", (event) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    const index = TABS.indexOf(state.tab);
    const next = event.key === "ArrowRight" ? (index + 1) % TABS.length : (index + TABS.length - 1) % TABS.length;
    event.preventDefault();
    setTab(TABS[next]);
    document.getElementById(`tab-${TABS[next]}`).focus();
  });

  $("#panel-today").addEventListener("click", (event) => {
    if (event.target.closest("#prev-day")) shiftDay(-1);
    else if (event.target.closest("#next-day")) shiftDay(1);
    else if (event.target.closest("#jump-back")) selectDate(anchorDate());
  });

  $("#panel-week").addEventListener("click", (event) => {
    const button = event.target.closest("[data-day]");
    if (!button) return;
    const date = button.dataset.day;
    state.openDay = state.openDay === date ? "" : date;
    renderWeek();
    document.querySelector(`[data-day="${date}"]`)?.focus();
  });

  $("#panel-quit").addEventListener("click", (event) => {
    const button = event.target.closest("[data-edit]");
    if (!button) return;
    openEditor(button.dataset.edit);
  });

  $("#editor-backdrop").addEventListener("click", closeEditor);
  $("#editor-cancel").addEventListener("click", closeEditor);
  $("#editor-restart").addEventListener("click", () => {
    if (state.editorId) restartTimer(state.editorId);
  });
  $("#editor-reset").addEventListener("click", () => {
    const timer = state.timers.find((item) => item.id === state.editorId);
    if (!timer) return;
    const ok = window.confirm(`Use the start date from quit-timers.json for “${timer.label}”?`);
    if (!ok) return;
    try {
      saveOverride(timer.id, timer.defaultStart);
      closeEditor();
    } catch (err) {
      const error = $("#editor-error");
      error.hidden = false;
      error.textContent = err.message || "Could not reset that date.";
    }
  });
  $("#editor-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const timer = state.timers.find((item) => item.id === state.editorId);
    if (!timer) return;
    const error = $("#editor-error");
    try {
      const iso = berlinLocalToISO($("#editor-input").value);
      if (Number.isNaN(Date.parse(iso))) throw new Error("That date did not parse.");
      saveOverride(timer.id, iso);
      closeEditor();
    } catch (err) {
      error.hidden = false;
      error.textContent = err.message || "Could not save that date.";
    }
  });

  document.addEventListener("keydown", (event) => {
    const editorOpen = !$("#editor").hidden;
    const aboutOpen = !$("#about").hidden;
    if (!editorOpen && !aboutOpen) return;
    if (event.key === "Escape") {
      event.preventDefault();
      if (editorOpen) closeEditor();
      else closeAbout();
      return;
    }
    if (event.key !== "Tab") return;
    trapSheet(editorOpen ? $("#editor-panel") : $("#about-panel"), event);
  });

  window.addEventListener("hashchange", () => {
    const tab = readTab();
    if (tab === state.tab) return;
    applyTab(tab);
    window.scrollTo(0, 0);
  });
}

async function init() {
  state.tab = readTab();
  state.selectedDate = berlinDateISO(new Date());
  writeHash(state.tab);
  applyTab(state.tab);
  bind();

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
  if (quit.data?.timezone && quit.data.timezone !== TZ) {
    state.quitTzNote = `File timezone is ${quit.data.timezone}. This page still shows Europe/Berlin.`;
  }
  if (!state.userPickedDate && state.day?.date) state.selectedDate = state.day.date;
  loadTimers(quit.data);
  renderDays();
  renderQuit();
  renderAbout();
  setInterval(tick, 1000);
}

init();
