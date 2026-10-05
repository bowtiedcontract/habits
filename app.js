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
  tag.textContent = "Your date";
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

  for (const timer of state.timers) {
    grid.append(renderQuitCard(timer));
    paintElapsed(timer);
  }
  updateResetAll();
}

function renderQuitCard(timer) {
  const card = el("article", "quit-card");
  card.dataset.timer = timer.id;

  const top = el("div", "quit-card-top");
  top.append(el("h3", null, timer.label));
  const tag = el("span", "source-tag", "Your date");
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

  const editButton = el("button", "text-btn", "Edit start");
  editButton.type = "button";
  card.append(editButton);

  const form = el("form", "edit-form");
  form.hidden = true;
  const label = el("label", "field-label", "Start in Europe/Berlin");
  const input = document.createElement("input");
  input.type = "datetime-local";
  input.required = true;
  input.step = "60";
  input.value = toDatetimeLocalValue(timer.start);
  label.append(input);
  form.append(label);

  const error = el("p", "form-error");
  error.hidden = true;
  form.append(error);

  const actions = el("div", "edit-actions");
  const save = el("button", "btn", "Save");
  save.type = "submit";
  const restart = el("button", "btn btn-quiet", "Restart from now");
  restart.type = "button";
  const reset = el("button", "btn btn-quiet", "Use file default");
  reset.type = "button";
  reset.dataset.reset = "";
  reset.hidden = !timer.override;
  const cancel = el("button", "btn btn-quiet", "Cancel");
  cancel.type = "button";
  actions.append(save, restart, reset, cancel);
  form.append(actions);
  card.append(form);

  editButton.addEventListener("click", () => {
    input.value = toDatetimeLocalValue(timer.start);
    error.hidden = true;
    form.hidden = false;
    editButton.hidden = true;
    input.focus();
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
    editButton.hidden = false;
    error.hidden = true;
  }

  return card;
}

function renderToday(day) {
  const root = $("#today-body");
  root.replaceChildren();
  const dateLabel = formatCalendarDay(day.date);
  $("#today-when").textContent = dateLabel ? `Today · ${dateLabel}` : "Today";

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

  const list = el("div", "habit-list");
  for (const item of items) {
    const row = el("div", "habit-row");
    const name = el("p", "habit-name", item.name || item.id || "Habit");
    if (item.note) {
      const note = el("span", "habit-note", item.note);
      name.append(note);
    }
    const planned = el(
      "p",
      "plan-flag",
      item.planned === false ? "Not on plan" : "Planned"
    );
    const info = statusInfo(item.status);
    const actual = el("p", `status ${info.className}`, info.label);
    row.append(name, planned, actual);
    list.append(row);
  }
  root.append(list);
}

function countLine(counts) {
  if (!counts) return "";
  const parts = [];
  if (counts.completed) parts.push(`${counts.completed} completed`);
  if (counts.missed) parts.push(`${counts.missed} missed`);
  if (counts.skipped) parts.push(`${counts.skipped} skipped`);
  if (counts.open) parts.push(`${counts.open} still open`);
  return parts.join(" · ");
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
  $("#week-when").textContent = start && end ? `This week · ${start} – ${end}` : "This week";

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

  const score = el("p", "percent");
  score.append(el("span", "percent-num", percent == null ? "—" : `${percent}%`));
  score.append(el("span", "percent-label", "done"));
  root.append(score);

  const counts = countLine(week.counts);
  if (counts) root.append(el("p", "counts", counts));

  const split = el("div", "split");
  const doneCol = el("div");
  doneCol.append(el("h3", "subhead", "Completed"));
  doneCol.append(renderNameList(week.completed, "None yet"));
  const missedCol = el("div");
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
    const list = el("div", "habit-list");
    for (const workout of workouts) {
      const row = el("div", "habit-row habit-row-two");
      row.append(el("p", "habit-name", workout.name || workout.id || "Workout"));
      const info = statusInfo(workout.status);
      row.append(el("p", `status ${info.className}`, info.label));
      list.append(row);
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

  if (Array.isArray(fitness.stats) && fitness.stats.length) {
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
    const list = el("ul", "plain-list");
    for (const workout of fitness.workouts) {
      const li = el("li");
      li.append(el("span", "item-name", workout.name || "Workout"));
      const bits = [workout.date ? formatCalendarDay(workout.date) : "", workout.detail || ""]
        .filter(Boolean)
        .join(" · ");
      if (bits) li.append(el("span", "item-when", bits));
      list.append(li);
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
