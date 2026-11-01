// Pure helpers for the 48-hour role feed. No network.
export const WINDOW_MS = 48 * 60 * 60 * 1000;
const FUTURE_SLACK_MS = 6 * 60 * 60 * 1000;

export const TRACKS = [
  ["forward-deployed", /forward[\s-]*deployed|\bfde\b/i],
  ["applied-ai", /applied\s+ai/i],
  ["ai-agents", /\bai agents?\b|\bagentic\b/i],
  ["solutions-engineer", /solutions?\s+engineer/i],
];

export function isInWindow(role, nowMs) {
  const within = (value) => {
    const t = Date.parse(value || "");
    return Number.isFinite(t) && t <= nowMs + FUTURE_SLACK_MS && nowMs - t <= WINDOW_MS;
  };
  return within(role?.firstSeen) || within(role?.postedAt);
}

export function trackIds(title) {
  return TRACKS.filter(([, re]) => re.test(title || "")).map(([id]) => id);
}

export function matchesTrack(role, track) {
  if (!track || track === "all") return true;
  return trackIds(role?.title).includes(track);
}

export function placeFlags(role) {
  const loc = role?.location || "";
  return {
    austinTexas: /\baustin\b|\btexas\b|\btx\b/i.test(loc),
    remote: role?.remote === true || /\bremote\b/i.test(loc),
  };
}

export function matchesPlace(role, place) {
  const flags = placeFlags(role);
  if (place === "austin-texas") return flags.austinTexas;
  if (place === "remote") return flags.remote;
  if (place === "either") return flags.austinTexas || flags.remote;
  return true;
}

export function formatPay(pay) {
  if (!pay || typeof pay !== "object") return null;
  const text = typeof pay.text === "string" && pay.text.trim() ? pay.text.trim() : null;
  const amount = (value) => (typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("en-US") : null);
  const min = amount(pay.min);
  const max = amount(pay.max);
  let range = null;
  if (min && max) range = min === max ? min : `${min}–${max}`;
  else if (min) range = `From ${min}`;
  else if (max) range = `Up to ${max}`;
  if (!range) return text;
  return [pay.currency, range, pay.period].filter(Boolean).join(" ");
}

export function feedItem(company, role) {
  return {
    company,
    title: role.title,
    location: role.location || "",
    remote: role.remote === true ? true : role.remote === false ? false : null,
    pay: role.pay || null,
    url: role.url,
    firstSeen: role.firstSeen,
    postedAt: role.postedAt || null,
  };
}
