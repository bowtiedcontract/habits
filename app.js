import {
  TZ,
  berlinDateISO,
  berlinLocalToISO,
  berlinParts,
  formatBerlinNow,
  formatBerlinStamp,
  formatCalendarDay,
  formatElapsed,
  toDatetimeLocalValue,
} from "./time.js";

const OVERRIDE_KEY = "habits.quitTimerOverrides";

const STATUS = {
  completed: { label: "Done", className: "status-done" },
  skipped: { label: "Skipped", className: "status-skipped" },
  missed: { label: "Missed", className: "status-missed" },
  planned: { label: "Still open", className: "status-open" },
};

const HABIT_TONE = {
  "no-smoking": "tone-amber",
  "no-vaping": "tone-sky",
  "no-alcohol": "tone-teal",
  "no-fap": "tone-rose",
  caffeine: "tone-coffee",
  sweets: "tone-plum",
};

const QUIT_ICON = {
  "no-smoking": "flame",
  "no-vaping": "cloud",
  "no-alcohol": "glass",
  "no-fap": "shield",
  caffeine: "mug",
  sweets: "candy",
};

const ICON_PATHS = {
  book: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  moon: "M21 14.5A8.5 8.5 0 1 1 9.5 3 7 7 0 0 0 21 14.5z",
  trend: "M3 17l6-6 4 4 7-8M15 7h6v6",
  bed: "M3 19V9M3 15h18v4M21 19V15M7 15v-2a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v2",
  pill: "M9 15l6-6M8.5 8.5a4 4 0 0 1 5.7-5.7l5 5a4 4 0 0 1-5.7 5.7z",
  run: "M15 6.2a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2zM4 20l3.2-5.2 2.4 1.6 2-3.4L16 16M8.5 22l1.8-4M14.5 22l-1.4-3.2M8 9.5l2.4 2.2 1.8-1.6 3.4.8",
  bolt: "M13 2L4 14h7l-1 8 9-12h-7l1-8z",
  mountain: "M3 20l6.5-11 3.2 5.2L16 10l5 10z",
  core: "M12 3c1.8 2.4 2.2 4.2.6 6.2 2 .8 3.6 2.4 3.6 5.2a4.2 4.2 0 0 1-8.4 0c0-2.8 1.6-4.4 3.6-5.2C9.8 7.2 10.2 5.4 12 3z",
  lotus: "M12 20c3.2-3.2 4-6.4.2-10.2C8 13.6 8.8 16.8 12 20zM12 20C7 18 4.5 14 6.2 10.2 9 12.4 10.6 15.6 12 20zM12 20c5-2 7.5-6 5.8-9.8-2.8 2.2-4.4 5.4-5.8 9.8z",
  flame: "M12 22a6.5 6.5 0 0 0 4.8-10.8C15.2 8.6 14 7 14 4c-2.2 2.2-3 4.2-3 6.2 0 1-.4 1.6-1.2 2.2C8.2 10.6 8 8.4 8.6 6 6.4 8 5 11 5 14.2A7 7 0 0 0 12 22z",
  cloud: "M7 18h10a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6 1.6A3.5 3.5 0 0 0 7 18z",
  glass: "M8 3h8l-1.2 7.2a4 4 0 0 1-7.6 0L8 3zM12 14.2V19M9 21h6",
  shield: "M12 3l7 3v6c0 4.2-2.8 7.2-7 9-4.2-1.8-7-4.8-7-9V6z",
  mug: "M5 8h10v5a4 4 0 0 1-4 4H8a3 3 0 0 1-3-3V8zM15 9h2a2.5 2.5 0 0 1 0 5h-2M8 3.5c.4 1 .4 1.2.4 2M11 3.5c.4 1 .4 1.2.4 2",
  candy: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM9 9L5 5M15 15l4 4M9 15l-4 4M15 9l4-4",
  check: "M5 12.5l4.2 4.2L19 7",
};

const TONE_FALLBACK = ["tone-amber", "tone-sky", "tone-teal", "tone-rose", "tone-coffee", "tone-plum"];

const state = {
  timers: [],
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

function statusInfo(status) {
  return STATUS[status] || { label: status || "Unknown", className: "status-open" };
}

function paintClock() {
  const now = formatBerlinNow(new Date());
  $("#now-date").textContent = now.dateLine;
  $("#now-time").textContent = now.timeLine;
}

function paintElapsed(timer) {
  const card = document.querySelector(`[data-timer="${timer.id}"]`);
  if (!card) return;
  const startMs = Date.parse(timer.start);
  const elapsed = formatElapsed(Date.now() - startMs);
  const primary = card.querySelector("[data-primary]");
  primary.textContent = elapsed.primary;
  primary.classList.toggle("elapsed-clock-main", elapsed.days === 0);
  card.querySelector("[data-unit]").textContent = elapsed.unit;
  card.querySelector("[data-subclock]").textContent = elapsed.subclock;
  card.querySelector("[data-spoken]").textContent = elapsed.spoken;
}

function tick() {
  paintClock();
  for (const timer of state.timers) paintElapsed(timer);
}

function setTimerStart(id, iso, { override }) {
  const timer = state.timers.find((item) => item.id === id);
  if (!timer) return;
  timer.start = iso;
  timer.override = override;
  const card = document.querySelector(`[data-timer="${id}"]`);
  card.querySelector("[data-since]").textContent = `since ${formatBerlinStamp(iso)}`;
  const tag = card.querySelector("[data-source]");
  tag.hidden = !override;
  tag.textContent = "This browser";
  const resetButton = card.querySelector("[data-reset]");
  resetButton.hidden = !override;
  paintElapsed(timer);
  updateResetAll();
}

function updateResetAll() {
  const any = state.timers.some((timer) => timer.override);
  $("#reset-all").hidden = !any;
}

function saveOverride(id, iso) {
  const overrides = readOverrides();
  const timer = state.timers.find((item) => item.id === id);
  if (iso === timer.defaultStart) delete overrides[id];
  else overrides[id] = iso;
  writeOverrides(overrides);
  setTimerStart(id, iso, { override: iso !== timer.defaultStart });
}

function renderQuit(payload) {
  const grid = $("#quit-grid");
  grid.replaceChildren();
  const overrides = readOverrides();
  const timers = Array.isArray(payload.timers) ? payload.timers : [];
  state.timers = timers
    .filter((timer) => timer && timer.id && timer.label && timer.start)
    .map((timer) => ({
      id: String(timer.id),
      label: String(timer.label),
      defaultStart: String(timer.start),
      start: overrides[timer.id] || String(timer.start),
      override: Boolean(overrides[timer.id]),
    }));

  if (!state.timers.length) {
    grid.append(el("p", "empty", "No quit timers in data/quit-timers.json."));
    return;
  }

  state.timers.forEach((timer, index) => {
    timer.tone = HABIT_TONE[timer.id] || TONE_FALLBACK[index % TONE_FALLBACK.length];
    grid.append(renderQuitCard(timer));
    paintElapsed(timer);
  });
  updateResetAll();
}

function restartIcon() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "18");
  svg.setAttribute("height", "18");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "btn-icon");
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

function renderQuitCard(timer) {
  const card = el("article", `quit-card ${timer.tone || "tone-teal"}`);
  card.dataset.timer = timer.id;

  const top = el("div", "quit-card-top");
  const title = el("h3");
  const glyph = el("span", "quit-glyph");
  glyph.setAttribute("aria-hidden", "true");
  glyph.append(svgIcon(QUIT_ICON[timer.id] || "shield"));
  title.append(glyph, document.createTextNode(timer.label));
  top.append(title);
  const tag = el("span", "source-tag", "This browser");
  tag.dataset.source = "";
  tag.hidden = !timer.override;
  top.append(tag);
  card.append(top);

  const elapsed = el("p", "elapsed");
  const primary = el("span", "elapsed-main", "—");
  primary.dataset.primary = "";
  const unit = el("span", "elapsed-unit", "");
  unit.dataset.unit = "";
  elapsed.append(primary, unit);
  card.append(elapsed);

  const sub = el("p", "elapsed-clock", "");
  sub.dataset.subclock = "";
  card.append(sub);

  const spoken = el("p", "sr-only");
  spoken.dataset.spoken = "";
  card.append(spoken);

  const since = el("p", "since", `since ${formatBerlinStamp(timer.start)}`);
  since.dataset.since = "";
  card.append(since);

  const form = el("form", "edit-form");
  form.id = `edit-${timer.id}`;
  form.hidden = true;
  const label = el("label", "field-label", "Start in Europe/Berlin");
  const input = document.createElement("input");
  input.type = "datetime-local";
  input.required = true;
  input.step = "60";
  input.value = toDatetimeLocalValue(timer.start);
  label.append(input);
  form.append(label);

  const formActions = el("div", "edit-actions");
  const save = el("button", "btn btn-secondary", "Save");
  save.type = "submit";
  const cancel = el("button", "btn btn-secondary", "Cancel");
  cancel.type = "button";
  formActions.append(save, cancel);
  form.append(formActions);
  card.append(form);

  const error = el("p", "form-error");
  error.hidden = true;
  card.append(error);

  const actions = el("div", "quit-actions");
  actions.setAttribute("role", "group");
  actions.setAttribute("aria-label", `${timer.label} actions`);

  const restart = el("button", "btn btn-restart");
  restart.type = "button";
  restart.setAttribute("aria-label", `Restart ${timer.label} from now`);
  restart.append(restartIcon(), el("span", null, "Restart from now"));

  const secondary = el("div", "quit-secondary");
  const editButton = el("button", "btn btn-secondary", "Edit start");
  editButton.type = "button";
  editButton.setAttribute("aria-expanded", "false");
  editButton.setAttribute("aria-controls", form.id);
  const reset = el("button", "btn btn-secondary", "Use file default");
  reset.type = "button";
  reset.dataset.reset = "";
  reset.hidden = !timer.override;
  secondary.append(editButton, reset);
  actions.append(restart, secondary);
  card.append(actions);

  editButton.addEventListener("click", () => {
    if (form.hidden) {
      input.value = toDatetimeLocalValue(timer.start);
      error.hidden = true;
      form.hidden = false;
      editButton.setAttribute("aria-expanded", "true");
      input.focus();
      return;
    }
    closeEditor();
  });

  cancel.addEventListener("click", () => closeEditor());

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      const iso = berlinLocalToISO(input.value);
      if (Number.isNaN(Date.parse(iso))) throw new Error("That date did not parse.");
      saveOverride(timer.id, iso);
      closeEditor();
    } catch (err) {
      error.hidden = false;
      error.textContent = err.message || "Could not save that date.";
    }
  });

  restart.addEventListener("click", () => {
    const ok = window.confirm(
      `Restart “${timer.label}” from now? This is saved only in this browser.`
    );
    if (!ok) return;
    const parts = berlinParts(new Date());
    try {
      const iso = berlinLocalToISO(
        `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`
      );
      saveOverride(timer.id, iso);
      input.value = toDatetimeLocalValue(iso);
      closeEditor();
    } catch (err) {
      error.hidden = false;
      error.textContent = err.message || "Could not restart.";
    }
  });

  reset.addEventListener("click", () => {
    const ok = window.confirm(`Use the start date from quit-timers.json for “${timer.label}”?`);
    if (!ok) return;
    saveOverride(timer.id, timer.defaultStart);
    input.value = toDatetimeLocalValue(timer.defaultStart);
    closeEditor();
  });

  function closeEditor() {
    form.hidden = true;
    editButton.setAttribute("aria-expanded", "false");
    error.hidden = true;
  }

  return card;
}

function svgIcon(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "22");
  svg.setAttribute("height", "22");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "icon");
  const raw = ICON_PATHS[name] || ICON_PATHS.check;
  for (const d of Array.isArray(raw) ? raw : [raw]) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "1.8");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    svg.append(path);
  }
  return svg;
}

function iconNameFor(item) {
  const key = `${item?.id || ""} ${item?.name || ""}`.toLowerCase();
  if (key.includes("german") || key.includes("anki") || key.includes("pimsleur")) return "book";
  if (key.includes("bed")) return "bed";
  if (key.includes("morning")) return "sun";
  if (key.includes("evening")) return "moon";
  if (key.includes("vitamin")) return "pill";
  if (key.includes("invest")) return "trend";
  if (key.includes("couch") || key.includes("5k") || key.includes("run")) return "run";
  if (key.includes("sprint")) return "bolt";
  if (key.includes("boulder") || key.includes("climb")) return "mountain";
  if (key.includes("abs") || key.includes("forearm") || key.includes("core")) return "core";
  if (key.includes("yoga") || key.includes("stretch")) return "lotus";
  if (key.includes("smok")) return "flame";
  if (key.includes("vap")) return "cloud";
  if (key.includes("alcohol")) return "glass";
  if (key.includes("caffeine") || key.includes("coffee")) return "mug";
  if (key.includes("sweet")) return "candy";
  return "check";
}

function meterWidth(status) {
  if (status === "completed" || status === "missed" || status === "skipped") return 100;
  return 16;
}

const CARD_STATE = {
  completed: "is-done",
  missed: "is-missed",
  skipped: "is-skipped",
  planned: "is-open",
};

function habitCard(item) {
  const info = statusInfo(item.status);
  const card = el("article", `habit-card ${CARD_STATE[item.status] || "is-open"}`);
  const iconWrap = el("div", "habit-icon");
  iconWrap.append(svgIcon(iconNameFor(item)));
  const copy = el("div", "habit-copy");
  const top = el("div", "habit-card-top");
  top.append(el("h3", "habit-name", item.name || item.id || "Habit"));
  top.append(statusChip(item.status));
  copy.append(top);
  if (item.note) copy.append(el("p", "habit-note", item.note));
  if (item.planned === false) copy.append(el("p", "plan-flag", "Not on plan"));
  if (item.when) copy.append(el("p", "habit-when", item.when));
  const meter = el("div", "meter");
  meter.setAttribute("role", "img");
  meter.setAttribute("aria-label", `${item.name || "Habit"}: ${info.label}`);
  const track = el("div", "meter-track");
  const fill = el("div", `meter-fill ${info.className}`);
  fill.style.width = `${meterWidth(item.status)}%`;
  track.append(fill);
  meter.append(track);
  card.append(iconWrap, copy, meter);
  return card;
}

function statusChip(status) {
  const info = statusInfo(status);
  return el("p", `status chip ${info.className}`, info.label);
}

function renderCountChips(counts) {
  if (!counts) return null;
  const row = el("div", "count-chips");
  const specs = [
    ["completed", "completed", "status-done"],
    ["missed", "missed", "status-missed"],
    ["skipped", "skipped", "status-skipped"],
    ["open", "still open", "status-open"],
  ];
  let any = false;
  for (const [key, word, className] of specs) {
    if (!counts[key]) continue;
    any = true;
    row.append(el("span", `chip ${className}`, `${counts[key]} ${word}`));
  }
  return any ? row : null;
}

function renderScore(percent, counts) {
  const card = el("div", "score-card");
  const score = el("p", "percent");
  score.append(el("span", "percent-num", percent == null ? "—" : `${percent}%`));
  score.append(el("span", "percent-label", "done"));
  card.append(score);
  if (percent != null) {
    const bounded = Math.max(0, Math.min(100, percent));
    const bar = el("div", "progress");
    bar.setAttribute("role", "progressbar");
    bar.setAttribute("aria-valuemin", "0");
    bar.setAttribute("aria-valuemax", "100");
    bar.setAttribute("aria-valuenow", String(bounded));
    bar.setAttribute("aria-label", "Percent done this week");
    const track = el("div", "progress-track");
    const fill = el("div", "progress-fill");
    fill.style.width = `${bounded}%`;
    track.append(fill);
    bar.append(track);
    card.append(bar);
  }
  const chips = renderCountChips(counts);
  if (chips) card.append(chips);
  return card;
}

function renderToday(day) {
  const root = $("#today-body");
  root.replaceChildren();
  const dateLabel = formatCalendarDay(day.date);
  $("#today-when").textContent = dateLabel || "Today";

  const todayISO = berlinDateISO(new Date());
  if (day.date && day.date !== todayISO) {
    const note = el(
      "p",
      "notice",
      `This file is for ${dateLabel}. Today in Berlin is ${formatCalendarDay(todayISO)}.`
    );
    root.append(note);
  }

  const items = Array.isArray(day.items) ? day.items : [];
  if (!items.length) {
    root.append(el("p", "empty", "Nothing in data/habits-day.json for this date."));
    return;
  }

  const list = el("div", "habit-grid");
  for (const item of items) list.append(habitCard(item));
  root.append(list);
}

function renderNameList(items, emptyText) {
  const list = el("ul", "plain-list");
  if (!items || !items.length) {
    list.append(el("li", "empty", emptyText));
    return list;
  }
  for (const item of items) {
    const li = el("li");
    li.append(el("span", "item-name", item.name || item.id || "Item"));
    if (item.when) li.append(el("span", "item-when", item.when));
    list.append(li);
  }
  return list;
}

function renderWeek(week) {
  const root = $("#week-body");
  root.replaceChildren();
  const start = formatCalendarDay(week.weekStart);
  const end = formatCalendarDay(week.weekEnd);
  $("#week-when").textContent = start && end ? `${start} – ${end}` : "This week";

  const todayISO = berlinDateISO(new Date());
  if (week.weekStart && week.weekEnd && (todayISO < week.weekStart || todayISO > week.weekEnd)) {
    root.append(
      el(
        "p",
        "notice",
        `This file covers ${start} – ${end}, which is not the current week in Berlin.`
      )
    );
  }

  const percent =
    typeof week.percentDone === "number"
      ? Math.round(week.percentDone)
      : week.counts && week.counts.planned
        ? Math.round((week.counts.completed / week.counts.planned) * 100)
        : null;

  root.append(renderScore(percent, week.counts));

  const split = el("div", "split");
  const doneCol = el("div", "panel panel-block");
  doneCol.append(el("h3", "subhead", "Completed"));
  doneCol.append(renderNameList(week.completed, "None yet"));
  const missedCol = el("div", "panel panel-block");
  missedCol.append(el("h3", "subhead", "Missed"));
  missedCol.append(renderNameList(week.missed, "None"));
  split.append(doneCol, missedCol);
  root.append(split);

  if (Array.isArray(week.skipped) && week.skipped.length) {
    const skipped = el("p", "skipped-line");
    skipped.append(el("span", "subhead-inline", "Skipped: "));
    skipped.append(document.createTextNode(week.skipped.map((item) => item.name).join(", ")));
    root.append(skipped);
  }

  const workouts = Array.isArray(week.workouts) ? week.workouts : [];
  if (workouts.length) {
    root.append(el("h3", "subhead workouts-head", "Weekly workouts"));
    const list = el("div", "habit-grid");
    for (const workout of workouts) list.append(habitCard(workout));
    root.append(list);
  }
}

function parseCount(value) {
  const match = String(value ?? "").match(/-?\d+/);
  return match ? Number(match[0]) : null;
}

function workoutTotals(stats) {
  if (!Array.isArray(stats)) return null;
  let done = null;
  let planned = null;
  for (const stat of stats) {
    const label = String(stat.label || "");
    const value = parseCount(stat.value);
    if (value == null || value < 0) continue;
    if (/done|complete/i.test(label)) done = value;
    else if (/plan|remain|left|open/i.test(label)) planned = value;
  }
  if (done == null || planned == null) return null;
  const total = done + planned;
  if (total <= 0) return null;
  return { done, total };
}

function renderRing(done, total) {
  const ratio = Math.max(0, Math.min(1, done / total));
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const hero = el("div", "fitness-hero");
  const wrap = el("div", "ring-wrap");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 140 140");
  svg.setAttribute("class", "ring");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `${done} of ${total} workouts`);
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  const gradient = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
  gradient.setAttribute("id", "fitness-ring");
  gradient.setAttribute("x1", "0");
  gradient.setAttribute("y1", "0");
  gradient.setAttribute("x2", "1");
  gradient.setAttribute("y2", "1");
  for (const [offset, color] of [["0%", "#7dffe1"], ["100%", "#8eb6ff"]]) {
    const stop = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    stop.setAttribute("offset", offset);
    stop.setAttribute("stop-color", color);
    gradient.append(stop);
  }
  defs.append(gradient);
  const track = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  track.setAttribute("class", "ring-track");
  track.setAttribute("cx", "70");
  track.setAttribute("cy", "70");
  track.setAttribute("r", String(radius));
  const value = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  value.setAttribute("class", "ring-value");
  value.setAttribute("cx", "70");
  value.setAttribute("cy", "70");
  value.setAttribute("r", String(radius));
  value.setAttribute("stroke-dasharray", `${(ratio * circumference).toFixed(2)} ${circumference.toFixed(2)}`);
  svg.append(defs, track, value);
  const center = el("div", "ring-center");
  center.append(el("p", "ring-count", String(done)));
  center.append(el("p", "ring-of", `of ${total}`));
  wrap.append(svg, center);
  const copy = el("div", "ring-copy");
  copy.append(el("p", "ring-kicker", "This week"));
  copy.append(el("p", "ring-title", `${done} of ${total} workouts`));
  copy.append(el("p", "ring-note", "Done plus still planned. Logged sessions are below."));
  hero.append(wrap, copy);
  return hero;
}

function fitnessHasContent(fitness) {
  if (!fitness || typeof fitness !== "object") return false;
  const recap = typeof fitness.sundayRecap === "string" && fitness.sundayRecap.trim();
  const stats = Array.isArray(fitness.stats) && fitness.stats.length;
  const workouts = Array.isArray(fitness.workouts) && fitness.workouts.length;
  return Boolean(recap || stats || workouts);
}

function renderFitness(fitness) {
  const root = $("#fitness-body");
  root.replaceChildren();
  if (!fitnessHasContent(fitness)) {
    const box = el("div", "placeholder");
    box.append(
      el(
        "p",
        null,
        "Sunday recap and workout stats will land here when Fitness Bot writes data/fitness.json."
      )
    );
    root.append(box);
    return;
  }

  if (fitness.sundayRecap) root.append(el("p", "recap", fitness.sundayRecap));

  const totals = workoutTotals(fitness.stats);
  if (totals) root.append(renderRing(totals.done, totals.total));

  if (Array.isArray(fitness.stats) && fitness.stats.length && !totals) {
    const stats = el("div", "stat-row");
    for (const stat of fitness.stats) {
      const chip = el("div", "stat");
      chip.append(el("p", "stat-value", String(stat.value ?? "—")));
      chip.append(el("p", "stat-label", String(stat.label ?? "")));
      stats.append(chip);
    }
    root.append(stats);
  }

  if (Array.isArray(fitness.workouts) && fitness.workouts.length) {
    const list = el("div", "session-list");
    for (const workout of fitness.workouts) {
      const card = el("article", "session-card");
      const iconWrap = el("div", "habit-icon");
      iconWrap.append(svgIcon(iconNameFor(workout)));
      const copy = el("div", "habit-copy");
      copy.append(el("h3", "habit-name", workout.name || "Workout"));
      if (workout.date) copy.append(el("p", "habit-when", formatCalendarDay(workout.date)));
      if (workout.detail) copy.append(el("p", "habit-note", workout.detail));
      card.append(iconWrap, copy);
      list.append(card);
    }
    root.append(list);
  }
}

function showSectionError(bodyId, message) {
  const root = $(bodyId);
  root.replaceChildren(el("p", "error", message));
}

async function loadSection(url, onData, bodyId, label) {
  try {
    const data = await fetchJson(url);
    onData(data);
    return data;
  } catch (error) {
    if (error.status === 404 && url.endsWith("fitness.json")) {
      onData(null);
      return null;
    }
    showSectionError(bodyId, `${label} could not be loaded.`);
    return null;
  }
}

async function init() {
  paintClock();
  setInterval(tick, 1000);

  $("#reset-all").addEventListener("click", () => {
    const ok = window.confirm("Clear every quit-timer date saved in this browser?");
    if (!ok) return;
    try {
      localStorage.removeItem(OVERRIDE_KEY);
    } catch {
      return;
    }
    for (const timer of state.timers) {
      setTimerStart(timer.id, timer.defaultStart, { override: false });
      const card = document.querySelector(`[data-timer="${timer.id}"]`);
      const input = card.querySelector("input");
      if (input) input.value = toDatetimeLocalValue(timer.defaultStart);
    }
  });

  const quit = await loadSection(
    "data/quit-timers.json",
    renderQuit,
    "#quit-grid",
    "Quit timers"
  );
  const day = await loadSection("data/habits-day.json", renderToday, "#today-body", "Today");
  const week = await loadSection("data/habits-week.json", renderWeek, "#week-body", "This week");
  await loadSection("data/fitness.json", renderFitness, "#fitness-body", "Fitness");

  const sample = Boolean((day && day.sample) || (week && week.sample));
  $("#sample-banner").hidden = !sample;
  if (quit && quit.timezone && quit.timezone !== TZ) {
    const tz = $("#quit-tz");
    tz.hidden = false;
    tz.textContent = `File timezone is ${quit.timezone}. This page still shows Europe/Berlin.`;
  }
}

init();
