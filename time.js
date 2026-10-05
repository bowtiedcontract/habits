export const TZ = "Europe/Berlin";

export function berlinParts(date) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hourCycle: "h23",
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const map = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  if (map.hour === "24") map.hour = "00";
  return map;
}

export function berlinDateISO(date) {
  const parts = berlinParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function berlinOffsetMinutes(instant) {
  const parts = berlinParts(instant);
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return Math.round((asUTC - instant.getTime()) / 60000);
}

export function berlinLocalToISO(localValue) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(localValue);
  if (!match) throw new Error("Use a date and time.");
  const [, year, month, day, hour, minute, second = "00"] = match;
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  const h = Number(hour);
  const min = Number(minute);
  const s = Number(second);
  let offset = berlinOffsetMinutes(new Date(Date.UTC(y, m - 1, d, h, min, s)));
  let utc = Date.UTC(y, m - 1, d, h, min, s) - offset * 60000;
  const refined = berlinOffsetMinutes(new Date(utc));
  if (refined !== offset) {
    offset = refined;
    utc = Date.UTC(y, m - 1, d, h, min, s) - offset * 60000;
  }
  const sign = offset >= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  const offsetHour = String(Math.floor(abs / 60)).padStart(2, "0");
  const offsetMinute = String(abs % 60).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}:${second}${sign}${offsetHour}:${offsetMinute}`;
}

export function toDatetimeLocalValue(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = berlinParts(date);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function formatElapsed(ms) {
  if (!Number.isFinite(ms)) {
    return {
      future: false,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      clock: "--:--:--",
      primary: "—",
      unit: "",
      subclock: "",
      spoken: "unknown",
    };
  }
  const future = ms < 0;
  const totalSeconds = Math.floor(Math.abs(ms) / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const clock = [hours, minutes, seconds].map((n) => String(n).padStart(2, "0")).join(":");
  const dayWord = days === 1 ? "day" : "days";
  let primary;
  let unit;
  let subclock;
  if (days > 0) {
    primary = String(days);
    unit = future ? `${dayWord} until start` : dayWord;
    subclock = clock;
  } else {
    primary = clock;
    unit = future ? "until start" : "hours";
    subclock = "";
  }
  const spokenParts = [];
  if (days) spokenParts.push(`${days} ${dayWord}`);
  spokenParts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
  spokenParts.push(`${minutes} ${minutes === 1 ? "minute" : "minutes"}`);
  spokenParts.push(`${seconds} ${seconds === 1 ? "second" : "seconds"}`);
  const spoken = future ? `${spokenParts.join(", ")} until start` : spokenParts.join(", ");
  return { future, days, hours, minutes, seconds, clock, primary, unit, subclock, spoken };
}

export function formatBerlinStamp(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "unknown date";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function formatCalendarDay(isoDate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate || "");
  if (!match) return isoDate || "";
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatBerlinNow(date) {
  return {
    dateLine: new Intl.DateTimeFormat("en-GB", {
      timeZone: TZ,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date),
    timeLine: new Intl.DateTimeFormat("en-GB", {
      timeZone: TZ,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).format(date),
  };
}
