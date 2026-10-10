export const DATA_KEY = "mindgridData";
export const TRACKER_KEY = "mindgridTracker";
export const CATEGORIES = [
  "Learning",
  "Development",
  "AI tools",
  "Social",
  "Entertainment",
  "Other"
];

export function defaultData() {
  return {
    days: {},
    categories: {},
    settings: {
      idleThreshold: 60,
      dailyGoalSeconds: 0
    }
  };
}

export async function readData() {
  const stored = await chrome.storage.local.get(DATA_KEY);
  return stored[DATA_KEY] || defaultData();
}

export async function writeData(data) {
  await chrome.storage.local.set({ [DATA_KEY]: data });
}

export function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function shiftDateKey(key, amount) {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(year, month - 1, day + amount);
  return localDateKey(date);
}

export function pruneOldReports(data, today = localDateKey()) {
  const oldestRetainedDate = shiftDateKey(today, -29);
  for (const date of Object.keys(data.days)) {
    if (date < oldestRetainedDate) delete data.days[date];
  }
}

export function formatDuration(seconds) {
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}m`;
}

export function getCategory(domain, overrides = {}) {
  if (overrides[domain]) return overrides[domain];
  const rules = [
    ["Learning", /(^|\.)leetcode\.com$|(^|\.)geeksforgeeks\.org$|(^|\.)coursera\.org$|(^|\.)udemy\.com$|(^|\.)khanacademy\.org$|(^|\.)w3schools\.com$|(^|\.)mdn\.mozilla\.org$|(^|\.)developer\.mozilla\.org$|(^|\.)docs\.google\.com$/],
    ["Development", /(^|\.)github\.com$|(^|\.)gitlab\.com$|(^|\.)bitbucket\.org$|(^|\.)stackoverflow\.com$|(^|\.)vercel\.com$|(^|\.)npmjs\.com$|(^|\.)localhost$/],
    ["AI tools", /(^|\.)chatgpt\.com$|(^|\.)openai\.com$|(^|\.)claude\.ai$|(^|\.)gemini\.google\.com$|(^|\.)perplexity\.ai$/],
    ["Social", /(^|\.)instagram\.com$|(^|\.)reddit\.com$|(^|\.)linkedin\.com$|(^|\.)facebook\.com$|(^|\.)x\.com$|(^|\.)twitter\.com$|(^|\.)threads\.net$/],
    ["Entertainment", /(^|\.)youtube\.com$|(^|\.)netflix\.com$|(^|\.)twitch\.tv$|(^|\.)spotify\.com$|(^|\.)disneyplus\.com$|(^|\.)primevideo\.com$/]
  ];
  return rules.find(([, pattern]) => pattern.test(domain))?.[0] || "Other";
}

export function aggregateDays(data, dateKeys) {
  const domains = new Map();
  for (const date of dateKeys) {
    const day = data.days[date];
    if (!day) continue;
    for (const [domain, item] of Object.entries(day)) {
      const current = domains.get(domain) || {
        domain,
        seconds: 0,
        visits: 0,
        sessionSeconds: 0,
        switches: 0,
        firstVisit: null,
        lastVisit: null
      };
      current.seconds += item.seconds || 0;
      current.visits += item.visits || 0;
      current.sessionSeconds += item.sessionSeconds || 0;
      current.switches += item.switches || 0;
      if (item.firstVisit && (!current.firstVisit || item.firstVisit < current.firstVisit)) {
        current.firstVisit = item.firstVisit;
      }
      if (item.lastVisit && (!current.lastVisit || item.lastVisit > current.lastVisit)) {
        current.lastVisit = item.lastVisit;
      }
      domains.set(domain, current);
    }
  }
  return [...domains.values()].sort((a, b) => b.seconds - a.seconds);
}

export function dayTotal(data, date) {
  return Object.values(data.days[date] || {}).reduce((sum, item) => sum + (item.seconds || 0), 0);
}
