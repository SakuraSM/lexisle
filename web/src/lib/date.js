export const APP_TIME_ZONE = "Asia/Shanghai";

const DATE_PARTS_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function getLocalDateKey(value = new Date()) {
  const parts = DATE_PARTS_FORMATTER.formatToParts(value);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function shiftDateKey(dateKey, days) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days, 12));
  return shifted.toISOString().slice(0, 10);
}

export function getWeekDateKeys(dateKey = getLocalDateKey()) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  return Array.from({ length: 7 }, (_, index) => shiftDateKey(dateKey, mondayOffset + index));
}

export function formatChineseDate(dateKey = getLocalDateKey()) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day, 12));
  return {
    date: new Intl.DateTimeFormat("zh-CN", { timeZone: "UTC", year: "numeric", month: "long", day: "numeric" }).format(value),
    weekday: new Intl.DateTimeFormat("zh-CN", { timeZone: "UTC", weekday: "long" }).format(value),
  };
}

export function millisecondsUntilNextLocalDay(now = new Date()) {
  const today = getLocalDateKey(now);
  let upperBound = now.getTime() + 30 * 60 * 60 * 1000;
  let lowerBound = now.getTime();
  while (upperBound - lowerBound > 1000) {
    const middle = Math.floor((upperBound + lowerBound) / 2);
    if (getLocalDateKey(new Date(middle)) === today) lowerBound = middle;
    else upperBound = middle;
  }
  return Math.max(1000, upperBound - now.getTime() + 1000);
}
