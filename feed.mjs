// 48-hour feed over the public role records. No network.
export const WINDOW_MS = 48 * 60 * 60 * 1000;
const FUTURE_SLACK_MS = 6 * 60 * 60 * 1000;

export const TRACKS = [
  ["forward-deployed", /forward[\s-]*deployed|\bfde\b/i],
  ["applied-ai", /applied\s+ai/i],
  ["ai-agents", /\bai agents?\b|\bagentic\b/i],
  ["solutions-engineer", /solutions?\s+engineer/i],
];

const numberOrNull = (value) => (typeof value === "number" && Number.isFinite(value) ? value : null);
const within = (value, nowMs) => {
  const t = Date.parse(value || "");
  return Number.isFinite(t) && t <= nowMs + FUTURE_SLACK_MS && nowMs - t <= WINDOW_MS;
};

export function seenAt(role) {
  return role?.firstSeen || role?.observedAt || role?.fetched || null;
}
export function postedAt(role) {
  const value = role?.publishedAt || role?.postedAt || "";
  return value && Number.isFinite(Date.parse(value)) ? value : null;
}
export function isInWindow(role, nowMs) {
  return within(seenAt(role), nowMs) || within(postedAt(role), nowMs);
}
export function trackIds(title) {
  return TRACKS.filter(([, re]) => re.test(title || "")).map(([id]) => id);
}
export function isRemote(role) {
  if (role?.remote === true) return true;
  if (role?.remote === false) return false;
  const workplace = String(role?.workplace || "");
  if (/remote/i.test(workplace) && !/hybrid/i.test(workplace)) return true;
  if (/hybrid|on-?site/i.test(workplace)) return false;
  if (/\bremote\b/i.test(role?.location || "")) return true;
  return null;
}
export function payOf(role) {
  const pay = role?.pay;
  if (pay && typeof pay === "object") {
    const text = typeof pay.text === "string" && pay.text.trim() && !pay.text.includes("[object Object]") ? pay.text.trim() : null;
    const min = numberOrNull(pay.min), max = numberOrNull(pay.max);
    if (min != null || max != null || text) return { min, max, currency: pay.currency || null, period: pay.period || null, text };
  }
  const range = (role?.payRanges || []).find((item) => item && (numberOrNull(item.min) != null || numberOrNull(item.max) != null || (typeof item.publishedText === "string" && item.publishedText.trim())));
  if (!range) return null;
  return { min: numberOrNull(range.min), max: numberOrNull(range.max), currency: range.currency || null, period: range.period || null, text: typeof range.publishedText === "string" ? range.publishedText : null };
}
export function matchesPlace(role, place) {
  const loc = role?.location || "";
  const austinTexas = /\baustin\b|\btexas\b|\btx\b/i.test(loc);
  const remote = isRemote(role) === true;
  if (place === "austin-texas") return austinTexas;
  if (place === "remote") return remote;
  if (place === "either") return austinTexas || remote;
  return true;
}
export function matchesTrack(role, track) {
  if (!track || track === "all") return true;
  return trackIds(role?.title).includes(track);
}
export function formatPay(pay) {
  if (!pay) return null;
  const text = pay.text || null;
  const amount = (value) => (typeof value === "number" ? value.toLocaleString("en-US") : null);
  const min = amount(pay.min), max = amount(pay.max);
  let range = null;
  if (min && max) range = min === max ? min : `${min}–${max}`;
  else if (min) range = `From ${min}`;
  else if (max) range = `Up to ${max}`;
  if (!range) return text;
  return [pay.currency, range, pay.period].filter(Boolean).join(" ");
}
export function feedItem(role) {
  return {
    company: String(role.company || "").split(" (")[0],
    title: role.title,
    location: role.location || "",
    remote: isRemote(role),
    pay: payOf(role),
    url: role.url,
    firstSeen: seenAt(role),
    postedAt: postedAt(role),
  };
}
