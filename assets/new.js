// Filters for /new. Served as a file so the Content-Security-Policy needs no inline script.
const TRACKS = [
  ["forward-deployed", /forward[\s-]*deployed|\bfde\b/i],
  ["applied-ai", /applied\s+ai/i],
  ["ai-agents", /\bai agents?\b|\bagentic\b/i],
  ["solutions-engineer", /solutions?\s+engineer/i],
];
const items = [...document.querySelectorAll("#roles > li")];
const placeEl = document.getElementById("place");
const trackEl = document.getElementById("track");
const empty = document.getElementById("empty");
const apply = () => {
  const place = placeEl.value;
  const track = trackEl.value;
  let shown = 0;
  for (const li of items) {
    const austin = li.dataset.austin === "1";
    const remote = li.dataset.remote === "1";
    const tracks = li.dataset.tracks || "";
    const placeOk = place === "all" || (place === "austin-texas" && austin) || (place === "remote" && remote) || (place === "either" && (austin || remote));
    const trackOk = track === "all" || tracks.split(" ").includes(track);
    const hit = placeOk && trackOk;
    li.hidden = !hit;
    if (hit) shown++;
  }
  empty.style.display = shown ? "none" : "block";
};
placeEl.addEventListener("change", apply);
trackEl.addEventListener("change", apply);
const params = new URLSearchParams(location.search);
if (params.get("place")) placeEl.value = params.get("place");
if (params.get("track")) trackEl.value = params.get("track");
apply();
