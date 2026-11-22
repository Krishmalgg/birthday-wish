import { PERSON } from "./config";

/** Parse "YYYY-MM-DD" into {y, m, d}; null if invalid or in the future. */
export function parseDob(value, now = new Date()) {
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(value ?? "").trim());
  if (!match) return null;
  const [y, m, d] = match.slice(1).map(Number);
  const check = new Date(y, m - 1, d);
  const valid = check.getFullYear() === y && check.getMonth() === m - 1 && check.getDate() === d;
  if (!valid || y < 1900 || check > now) return null;
  return { y, m, d };
}

/** Exact age in calendar years, months and days. */
export function calculateAge(dob, now = new Date()) {
  let years = now.getFullYear() - dob.y;
  let months = now.getMonth() + 1 - dob.m;
  let days = now.getDate() - dob.d;

  if (days < 0) {
    months -= 1;
    days += new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { years, months, days };
}

export const isBirthdayToday = (dob, now = new Date()) =>
  now.getMonth() + 1 === dob.m && now.getDate() === dob.d;

/**
 * Midnight at the start of the upcoming birthday. A 29 Feb birthday falls back
 * to 1 March in non-leap years.
 */
export function nextBirthdayAt(dob, now = new Date()) {
  const at = (year) => {
    const date = new Date(year, dob.m - 1, dob.d, 0, 0, 0, 0);
    if (date.getDate() !== dob.d) date.setDate(1); // 29 Feb -> 1 Mar
    return date;
  };
  const thisYear = at(now.getFullYear());
  return thisYear > now ? thisYear : at(now.getFullYear() + 1);
}

/** Time remaining, already split up and floored at zero. */
export function timeUntil(target, now = new Date()) {
  const total = Math.max(0, target.getTime() - now.getTime());
  const s = Math.floor(total / 1000);
  return {
    total,
    days: Math.floor(s / 86400),
    hours: Math.floor(s / 3600) % 24,
    minutes: Math.floor(s / 60) % 60,
    seconds: s % 60,
  };
}

/** .env values, with ?name= / ?date= overriding them when present. */
export function readParams(searchParams, now = new Date()) {
  const rawName = (searchParams.get("name") ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
  const name = rawName || PERSON.name;
  const dob = parseDob(searchParams.get("date"), now) ?? parseDob(PERSON.dob, now) ?? { y: 2000, m: 1, d: 1 };
  return { name, dob };
}

export function ordinal(n) {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  return `${n}${{ 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th"}`;
}
