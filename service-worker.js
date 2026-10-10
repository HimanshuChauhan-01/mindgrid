import { CATEGORIES, DATA_KEY, TRACKER_KEY, defaultData, localDateKey, pruneOldReports, readData, writeData } from "./shared.js";

let workQueue = Promise.resolve();

function enqueue(task) {
  const operation = workQueue.then(task);
  workQueue = operation.catch((error) => {
    console.error("MindGrid could not update browsing data:", error);
  });
  return operation;
}

async function activeContext() {
  const stored = await chrome.storage.local.get(DATA_KEY);
  const settings = stored[DATA_KEY]?.settings || defaultData().settings;
  const [window, idleState] = await Promise.all([
    chrome.windows.getLastFocused({ populate: true }),
    chrome.idle.queryState(settings.idleThreshold)
  ]);
  if (!window.focused || window.type !== "normal" || idleState !== "active") return null;
  const tab = window.tabs?.find((candidate) => candidate.active);
  if (!tab?.url || tab.incognito) return null;
  try {
    const url = new URL(tab.url);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.hostname.toLowerCase().replace(/^www\./, "");
  } catch (error) {
    if (error instanceof TypeError) return null;
    throw error;
  }
}

function addElapsed(data, domain, from, to) {
  while (from < to) {
    const current = new Date(from);
    const nextDay = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 1).getTime();
    const end = Math.min(to, nextDay);
    const seconds = (end - from) / 1000;
    const date = localDateKey(current);
    if (seconds > 0) {
      data.days[date] ||= {};
      data.days[date][domain] ||= {
        seconds: 0,
        visits: 0,
        sessionSeconds: 0,
        firstVisit: null,
        lastVisit: null
      };
      data.days[date][domain].seconds += seconds;
      data.days[date][domain].sessionSeconds += seconds;
    }
    from = end;
  }
}

async function syncTracker({ skipElapsed = false } = {}) {
  const now = Date.now();
  const [storedTracker, nextDomain] = await Promise.all([
    chrome.storage.local.get(TRACKER_KEY),
    activeContext()
  ]);
  const previous = storedTracker[TRACKER_KEY] || null;
  const data = await readData();

  if (!skipElapsed && previous?.domain && previous.lastTick < now) {
    const sameContext = previous.domain === nextDomain;
    const stopAt = sameContext ? now : Math.min(now, previous.lastTick + 60_000);
    addElapsed(data, previous.domain, previous.lastTick, stopAt);
  }
  pruneOldReports(data, localDateKey(new Date(now)));

  const changed = previous?.domain !== nextDomain;
  if (changed && nextDomain) {
    const date = localDateKey(new Date(now));
    data.days[date] ||= {};
    data.days[date][nextDomain] ||= {
      seconds: 0,
      visits: 0,
      sessionSeconds: 0,
      firstVisit: null,
      lastVisit: null
    };
    const item = data.days[date][nextDomain];
    item.visits += 1;
    item.firstVisit ||= new Date(now).toISOString();
    item.lastVisit = new Date(now).toISOString();
  }
  if (changed && previous?.domain && nextDomain) {
    const date = localDateKey(new Date(now));
    data.days[date] ||= {};
    data.days[date][nextDomain] ||= {
      seconds: 0,
      visits: 0,
      sessionSeconds: 0,
      firstVisit: null,
      lastVisit: null
    };
    data.days[date][nextDomain].switches = (data.days[date][nextDomain].switches || 0) + 1;
  }

  await Promise.all([
    writeData(data),
    chrome.storage.local.set({
      [TRACKER_KEY]: nextDomain ? { domain: nextDomain, lastTick: now } : null
    })
  ]);
}

function scheduleSync() {
  enqueue(syncTracker).catch(() => {});
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("mindgrid-minute-sync", { periodInMinutes: 1 });
  enqueue(() => syncTracker({ skipElapsed: true })).catch(() => {});
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create("mindgrid-minute-sync", { periodInMinutes: 1 });
  enqueue(() => syncTracker({ skipElapsed: true })).catch(() => {});
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "mindgrid-minute-sync") scheduleSync();
});

chrome.tabs.onActivated.addListener(scheduleSync);
chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
  if (changeInfo.url || changeInfo.status === "complete") scheduleSync();
});
chrome.tabs.onRemoved.addListener(scheduleSync);
chrome.windows.onFocusChanged.addListener(scheduleSync);
chrome.idle.onStateChanged.addListener(scheduleSync);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "mindgrid:sync") {
    enqueue(syncTracker).then(
      () => sendResponse({ ok: true }),
      (error) => sendResponse({ ok: false, error: error.message })
    );
    return true;
  }
  if (message?.type === "mindgrid:clear") {
    enqueue(async () => {
      await chrome.storage.local.remove([DATA_KEY, TRACKER_KEY]);
      const domain = await activeContext();
      const now = Date.now();
      await chrome.storage.local.set({
        [DATA_KEY]: defaultData(),
        [TRACKER_KEY]: domain ? { domain, lastTick: now } : null
      });
    }).then(
      () => sendResponse({ ok: true }),
      (error) => sendResponse({ ok: false, error: error.message })
    );
    return true;
  }
  if (message?.type === "mindgrid:category") {
    enqueue(async () => {
      if (typeof message.domain !== "string" || !message.domain || !CATEGORIES.includes(message.category)) {
        throw new TypeError("The requested website category is invalid.");
      }
      const data = await readData();
      data.categories[message.domain] = message.category;
      await writeData(data);
    }).then(
      () => sendResponse({ ok: true }),
      (error) => sendResponse({ ok: false, error: error.message })
    );
    return true;
  }
  if (message?.type === "mindgrid:settings") {
    enqueue(async () => {
      const allowedThresholds = [30, 60, 120, 300];
      const { setting, value } = message;
      if (setting === "idleThreshold" && allowedThresholds.includes(value)) {
        const data = await readData();
        data.settings.idleThreshold = value;
        await writeData(data);
        return;
      }
      if (setting === "dailyGoalSeconds" && Number.isInteger(value) && value >= 0 && value <= 86_400) {
        const data = await readData();
        data.settings.dailyGoalSeconds = value;
        await writeData(data);
        return;
      }
      throw new TypeError("The requested MindGrid setting is invalid.");
    }).then(
      () => sendResponse({ ok: true }),
      (error) => sendResponse({ ok: false, error: error.message })
    );
    return true;
  }
  return false;
});
