import {
  CATEGORIES,
  aggregateDays,
  dayTotal,
  defaultData,
  formatDuration,
  getCategory,
  localDateKey,
  readData,
  shiftDateKey
} from "./shared.js";

const root = document.querySelector("#view-root");
const toast = document.querySelector("#toast");
const state = { view: "overview", range: "7", search: "", expanded: null, data: defaultData() };
let toastTimer;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function siteName(domain) {
  return domain.split(".")[0].replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dateLabel(key, options = { month: "short", day: "numeric" }) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day, 12).toLocaleDateString(undefined, options);
}

function periodDates(count, end = localDateKey()) {
  return Array.from({ length: count }, (_, index) => shiftDateKey(end, index - count + 1));
}

function rangeDays() {
  return state.range === "30" ? 30 : state.range === "7" ? 7 : 1;
}

function rangeEnd() {
  return state.range === "yesterday" ? shiftDateKey(localDateKey(), -1) : localDateKey();
}

function currentPeriod() {
  const dates = periodDates(rangeDays(), rangeEnd());
  const domains = aggregateDays(state.data, dates);
  return { dates, domains, total: domains.reduce((sum, item) => sum + item.seconds, 0) };
}

function categoryTotals(domains) {
  const totals = new Map();
  for (const item of domains) {
    const category = getCategory(item.domain, state.data.categories);
    totals.set(category, (totals.get(category) || 0) + item.seconds);
  }
  return totals;
}

function rangeControls() {
  return `<div class="range-switch" aria-label="Report period">
    ${[["today", "Today"], ["yesterday", "Yesterday"], ["7", "7 days"], ["30", "30 days"]].map(([range, label]) =>
      `<button class="range-button${state.range === range ? " is-active" : ""}" data-range="${range}" aria-pressed="${state.range === range}">${label}</button>`
    ).join("")}
  </div>`;
}

function pageHeader(title, subtitle, eyebrow = "YOUR DIGITAL WELLBEING", trailing = "") {
  return `<div class="page-heading">
    <div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p>${subtitle}</p></div>${trailing}
  </div>`;
}

function chartMarkup() {
  const dates = periodDates(7);
  const totals = dates.map((date) => dayTotal(state.data, date));
  const maximum = Math.max(...totals, 60);
  const today = localDateKey();
  return `<div class="chart" role="img" aria-label="Tracked time for the last seven days">
    ${dates.map((date, index) => {
      const total = totals[index];
      const height = total ? Math.max(5, Math.round((total / maximum) * 100)) : 2;
      const isToday = date === today;
      return `<div class="chart-column" title="${escapeHtml(dateLabel(date, { weekday: "long", month: "long", day: "numeric" }))}: ${formatDuration(total)}">
        <span class="chart-value">${total ? formatDuration(total) : ""}</span>
        <div class="chart-track"><div class="chart-bar${isToday ? " is-today" : ""}" style="height:${height}%"></div></div>
        <span class="chart-label${isToday ? " is-today" : ""}">${escapeHtml(dateLabel(date, { weekday: "short" }))}</span>
      </div>`;
    }).join("")}
  </div>`;
}

function platformRows(domains, limit = 5) {
  const shown = domains.slice(0, limit);
  if (shown.length === 0) {
    return `<div class="empty-state"><span class="empty-illustration">◷</span><strong>Your report is getting started</strong>Browse a website in Chrome and your tracked time will appear here.</div>`;
  }
  const highest = shown[0].seconds || 1;
  return `<div class="platform-list">${shown.map((item) => `
    <button class="platform-row" data-open-domain="${escapeHtml(item.domain)}" aria-label="View details for ${escapeHtml(item.domain)}">
      <span class="site-monogram" aria-hidden="true">${escapeHtml(siteName(item.domain).slice(0, 2))}</span>
      <span class="platform-info"><span class="platform-name">${escapeHtml(siteName(item.domain))}</span><span class="platform-domain">${escapeHtml(item.domain)}</span></span>
      <span class="platform-meter" aria-hidden="true"><span style="width:${Math.max(3, Math.round(item.seconds / highest * 100))}%"></span></span>
      <span class="platform-time">${formatDuration(item.seconds)}</span>
    </button>
  `).join("")}</div>`;
}

function insightCopy(period) {
  if (!period.domains.length) {
    return ["No browsing patterns yet", "Your summaries are calculated from your browsing activity and will appear once MindGrid has something to report."];
  }
  const top = period.domains[0];
  const share = period.total ? Math.round(top.seconds / period.total * 100) : 0;
  const categories = categoryTotals(period.domains);
  const learning = categories.get("Learning") || 0;
  const visits = period.domains.reduce((sum, item) => sum + item.visits, 0);
  const switches = period.domains.reduce((sum, item) => sum + (item.switches || 0), 0);
  if (period.domains.length === 1) {
    return [`${siteName(top.domain)} is your top platform`, `You spent ${formatDuration(top.seconds)} on ${top.domain} in this period${share ? `, about ${share}% of your tracked time` : ""}.`];
  }
  if (learning > 0) {
    return ["Time across your learning sites", `You spent ${formatDuration(learning)} across websites categorized as Learning in this period.`];
  }
  if (switches > 0) {
    return ["A note on your browsing rhythm", `MindGrid recorded ${switches} switches between websites in this period. This is an observation, not a measure of productivity.`];
  }
  return [`${siteName(top.domain)} leads this period`, `${top.domain} accounted for ${formatDuration(top.seconds)} (${share}%) of your tracked browsing time. ${visits} platform visits were recorded.`];
}

function overviewMarkup() {
  const period = currentPeriod();
  const days = rangeDays();
  const previousDates = periodDates(days, shiftDateKey(rangeEnd(), -days));
  const previousTotal = previousDates.reduce((sum, date) => sum + dayTotal(state.data, date), 0);
  const change = period.total - previousTotal;
  const todayTotal = dayTotal(state.data, localDateKey());
  const goal = state.data.settings.dailyGoalSeconds || 0;
  const insight = insightCopy(period);
  const categorySummary = [...categoryTotals(period.domains).entries()].sort((a, b) => b[1] - a[1]);
  const comparisonPeriod = state.range === "today"
    ? "yesterday (full day)"
    : state.range === "yesterday" ? "the previous day" : `the previous ${days} days`;
  const datesLabel = state.range === "today" ? "today"
    : state.range === "yesterday" ? "yesterday"
      : `the last ${days} days`;

  return `${pageHeader("Your digital day", `A clear picture of where your browsing time goes · ${dateLabel(rangeEnd(), { weekday: "long", month: "long", day: "numeric" })}`, "YOUR DIGITAL WELLBEING", rangeControls())}
    <section class="stats-grid" aria-label="Usage summary">
      <article class="stat-card"><div class="stat-card-label"><span>Total tracked</span><span class="stat-icon">◷</span></div><div class="stat-value">${formatDuration(period.total)}</div><div class="stat-foot">Across ${datesLabel}</div></article>
      <article class="stat-card"><div class="stat-card-label"><span>Platforms</span><span class="stat-icon">▤</span></div><div class="stat-value">${period.domains.length}</div><div class="stat-foot">${period.domains.length === 1 ? "website visited" : "websites visited"}</div></article>
      <article class="stat-card"><div class="stat-card-label"><span>Daily average</span><span class="stat-icon">◴</span></div><div class="stat-value">${formatDuration(period.total / days)}</div><div class="stat-foot">Per day in this period</div></article>
      <article class="stat-card"><div class="stat-card-label"><span>Period change</span><span class="stat-icon">↗</span></div><div class="stat-value">${previousTotal ? `${change >= 0 ? "+" : "−"}${formatDuration(Math.abs(change))}` : "—"}</div><div class="stat-foot">${previousTotal ? `${change >= 0 ? "More" : "Less"} than ${comparisonPeriod}` : "Build a baseline over time"}</div></article>
    </section>
    ${goal ? `<section class="panel" style="margin-bottom:13px;padding:13px 17px">
      <div class="panel-heading"><div><h2>Today's personal goal</h2><p>${formatDuration(todayTotal)} of ${formatDuration(goal)} · ${Math.min(100, Math.round(todayTotal / goal * 100))}%</p></div><button class="subtle-link" data-view="settings">Manage goal</button></div>
      <div class="goal-progress"><span style="width:${Math.min(100, Math.round(todayTotal / goal * 100))}%"></span></div>
    </section>` : ""}
    <div class="dashboard-grid">
      <section class="panel">
        <div class="panel-heading"><div><h2>Your week at a glance</h2><p>Tracked browsing time · local time</p></div><button class="subtle-link" data-view="insights">See insights →</button></div>
        ${chartMarkup()}
      </section>
      <section class="panel">
        <div class="panel-heading"><div><h2>Time by platform</h2><p>Ranked by time spent · ${datesLabel}</p></div><button class="subtle-link" data-view="platforms">View all →</button></div>
        ${platformRows(period.domains)}
        <div class="insight-callout"><span class="insight-spark">✳</span><div><strong>${escapeHtml(insight[0])}</strong><p>${escapeHtml(insight[1])}</p></div></div>
        <p class="insight-note">Rule-based summary from your local statistics. Active browsing time estimates activity, not attention.</p>
      </section>
    </div>
    <section class="section-heading"><div><h2>Time by category</h2><p>Categories are inferred by website and can be changed in Platforms.</p></div><button class="subtle-link" data-view="platforms">Edit categories →</button></section>
    <section class="category-summary">${categorySummary.length ? categorySummary.map(([category, seconds]) => `
      <article class="category-tile"><span class="category-name">${escapeHtml(category)}</span><span class="category-time">${formatDuration(seconds)}</span></article>
    `).join("") : `<div class="table-empty">Category totals will appear as you browse.</div>`}</section>`;
}

function platformDetailMarkup(item) {
  const averageSession = item.visits ? item.sessionSeconds / item.visits : 0;
  const first = item.firstVisit ? new Date(item.firstVisit).toLocaleString() : "—";
  const last = item.lastVisit ? new Date(item.lastVisit).toLocaleString() : "—";
  const switches = item.switches || 0;
  return `<div class="detail-row">
    <strong>${item.visits} ${item.visits === 1 ? "visit" : "visits"}</strong> ·
    Average time per visit ${formatDuration(averageSession)} ·
    ${switches} ${switches === 1 ? "switch" : "switches"} to this site
    <br>First visit: ${escapeHtml(first)} · Last visit: ${escapeHtml(last)}
  </div>`;
}

function platformTableMarkup(domains) {
  if (!domains.length) return `<div class="table-empty">No tracked websites in this period yet. Your report will fill in as you browse.</div>`;
  return `<div class="platform-table-head"><span>PLATFORM</span><span>CATEGORY</span><span>TIME SPENT</span><span>VISITS</span><span></span></div>
    ${domains.map((item) => `
      <div class="platform-table-row">
        <div class="table-site"><span class="site-monogram" aria-hidden="true">${escapeHtml(siteName(item.domain).slice(0, 2))}</span><span class="table-site-copy"><strong>${escapeHtml(siteName(item.domain))}</strong><span>${escapeHtml(item.domain)}</span></span></div>
        <div><select class="category-select" data-category-domain="${escapeHtml(item.domain)}" aria-label="Category for ${escapeHtml(item.domain)}">${CATEGORIES.map((category) => `<option value="${escapeHtml(category)}"${getCategory(item.domain, state.data.categories) === category ? " selected" : ""}>${escapeHtml(category)}</option>`).join("")}</select></div>
        <div class="table-time">${formatDuration(item.seconds)}</div>
        <div class="table-muted">${item.visits}</div>
        <div><button class="details-button" data-expand-domain="${escapeHtml(item.domain)}">${state.expanded === item.domain ? "Hide details" : "View details"}</button></div>
        ${state.expanded === item.domain ? platformDetailMarkup(item) : ""}
      </div>
    `).join("")}`;
}

function renderPlatformList() {
  const list = root.querySelector("#platform-list");
  if (!list) return;
  const period = currentPeriod();
  const filtered = period.domains.filter((item) =>
    item.domain.toLowerCase().includes(state.search.toLowerCase()) ||
    siteName(item.domain).toLowerCase().includes(state.search.toLowerCase())
  );
  list.innerHTML = platformTableMarkup(filtered);
}

function platformsMarkup() {
  const period = currentPeriod();
  return `${pageHeader("Your platforms", "Explore your website-by-website usage and make every category your own.", "BROWSING BREAKDOWN", rangeControls())}
    <div class="section-heading" style="margin-top:0">
      <div><h2>All tracked websites</h2><p>${period.domains.length} ${period.domains.length === 1 ? "platform" : "platforms"} · Category changes are saved on this device.</p></div>
      <div class="platform-page-tools"><label class="search-box"><span class="search-symbol" aria-hidden="true">⌕</span><input id="platform-search" class="search-input" type="search" placeholder="Search websites" value="${escapeHtml(state.search)}" aria-label="Search websites"></label></div>
    </div>
    <section id="platform-list" class="panel list-panel">${platformTableMarkup(period.domains.filter((item) =>
      item.domain.toLowerCase().includes(state.search.toLowerCase()) ||
      siteName(item.domain).toLowerCase().includes(state.search.toLowerCase())
    ))}</section>`;
}

function insightsMarkup() {
  const period = currentPeriod();
  const insight = insightCopy(period);
  const categories = [...categoryTotals(period.domains).entries()].sort((a, b) => b[1] - a[1]);
  const top = period.domains[0];
  const visits = period.domains.reduce((sum, item) => sum + item.visits, 0);
  const switches = period.domains.reduce((sum, item) => sum + (item.switches || 0), 0);
  const cards = [
    [ "↗", "Your biggest time consumer", top ? `${top.domain} was your most-used website in this period, with ${formatDuration(top.seconds)} of tracked browsing.` : "Your most-used websites will appear here as you browse." ],
    [ "◈", "Your category mix", categories.length ? categories.slice(0, 3).map(([category, seconds]) => `${category}: ${formatDuration(seconds)}`).join(" · ") : "Category totals appear once browsing time has been collected." ],
    [ "◷", "Your browsing rhythm", visits ? `${visits} platform ${visits === 1 ? "visit" : "visits"} and ${switches} recorded ${switches === 1 ? "switch" : "switches"} between websites in this period.` : "Visits and website switches are counted locally as activity changes." ],
    [ "⌁", "Your daily average", `${formatDuration(period.total / rangeDays())} per day across ${rangeDays()} ${rangeDays() === 1 ? "day" : "days"} in this report.` ],
    [ "✳", "A pattern to notice", insight[1] ],
    [ "◌", "A note about the numbers", "MindGrid estimates active browsing from your selected tab, browser focus, and idle state. It cannot tell whether you are paying attention to a page." ]
  ];
  return `${pageHeader("A little perspective", "Small, transparent observations based on your own browsing stats.", "YOUR INSIGHTS", rangeControls())}
    <section class="insight-grid">${cards.map(([icon, title, body]) => `
      <article class="panel insight-card"><span class="insight-card-icon" aria-hidden="true">${icon}</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(body)}</p></article>
    `).join("")}</section>
    <p class="insight-disclaimer">These summaries are generated on your device using simple rules—not AI, predictions, or judgments about how you use your time.</p>`;
}

function settingsMarkup() {
  const settings = { ...defaultData().settings, ...state.data.settings };
  const todayTotal = dayTotal(state.data, localDateKey());
  const goalProgress = settings.dailyGoalSeconds ? Math.min(100, Math.round(todayTotal / settings.dailyGoalSeconds * 100)) : 0;
  return `${pageHeader("Your settings", "Set up how MindGrid measures time and manage the data stored on this device.", "PREFERENCES")}
    <div class="settings-grid">
      <section class="panel settings-card"><h2>Tracking preferences</h2><p>MindGrid counts time only while a regular Chrome window is focused, the computer is active, and a website tab is selected. Browser pages such as chrome:// are not counted.</p>
        <label class="setting-row"><span class="setting-copy"><strong>Idle detection</strong><span>Stop counting after this long without keyboard or mouse activity.</span></span><select id="idle-threshold" class="setting-input" aria-label="Idle detection threshold"><option value="30"${settings.idleThreshold === 30 ? " selected" : ""}>30 seconds</option><option value="60"${settings.idleThreshold === 60 ? " selected" : ""}>1 minute</option><option value="120"${settings.idleThreshold === 120 ? " selected" : ""}>2 minutes</option><option value="300"${settings.idleThreshold === 300 ? " selected" : ""}>5 minutes</option></select></label>
      </section>
      <section class="panel settings-card"><h2>Daily browsing goal</h2><p>A personal reference for your total tracked website time today. It does not block websites or send notifications.</p>
        <label class="setting-row"><span class="setting-copy"><strong>Time goal</strong><span>Leave at zero to turn the goal off.</span></span><span><input id="daily-goal" class="setting-input" type="number" min="0" max="1440" step="15" value="${Math.round(settings.dailyGoalSeconds / 60)}" aria-label="Daily browsing goal in minutes"> <span class="table-muted">min</span></span></label>
        ${settings.dailyGoalSeconds ? `<p style="margin-top:13px;color:#73796f;font-size:9px">Today: ${formatDuration(todayTotal)} of ${formatDuration(settings.dailyGoalSeconds)}</p><div class="goal-progress"><span style="width:${goalProgress}%"></span></div>` : ""}
      </section>
      <section class="panel settings-card"><h2>Your data, your choice</h2><p>Your browsing reports and category preferences are stored locally in Chrome. Nothing is sent to a MindGrid account or backend. Daily reports older than 30 local calendar days are automatically deleted; category preferences and settings are kept.</p>
        <div class="data-actions"><p>Export a copy before it ages out, or permanently remove all MindGrid browsing data from this browser profile.</p><div class="settings-actions"><button class="button button-soft" id="settings-export">↓ Export JSON</button><button class="button button-danger" id="delete-data">Delete my data</button></div></div>
      </section>
      <p class="insight-disclaimer" style="margin-top:0">Time is an estimate of active browsing, not attention. MindGrid does not collect page contents, URLs beyond the website domain, or search queries.</p>
    </div>`;
}

function render() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === state.view);
  });
  root.innerHTML = ({
    overview: overviewMarkup,
    platforms: platformsMarkup,
    insights: insightsMarkup,
    settings: settingsMarkup
  })[state.view]();
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

async function exportData() {
  const data = await readData();
  const contents = JSON.stringify({
    exportedAt: new Date().toISOString(),
    format: "MindGrid local browsing report",
    ...data
  }, null, 2);
  const url = URL.createObjectURL(new Blob([contents], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `mindgrid-data-${localDateKey()}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast("Your MindGrid data has been exported.");
}

document.addEventListener("click", async (event) => {
  const nav = event.target.closest("[data-view]");
  if (nav) {
    state.view = nav.dataset.view;
    render();
    return;
  }
  const rangeButton = event.target.closest("[data-range]");
  if (rangeButton) {
    state.range = rangeButton.dataset.range;
    state.expanded = null;
    render();
    return;
  }
  const domainButton = event.target.closest("[data-expand-domain], [data-open-domain]");
  if (domainButton) {
    state.expanded = domainButton.dataset.expandDomain || domainButton.dataset.openDomain;
    state.view = "platforms";
    render();
    return;
  }
  if (event.target.closest("#export-button, #settings-export")) {
    try {
      await exportData();
    } catch (error) {
      console.error("MindGrid could not export local data:", error);
      showToast("Export failed. Please try again.");
    }
    return;
  }
  if (event.target.closest("#delete-data")) {
    if (!window.confirm("Permanently delete all MindGrid browsing history and category preferences from this browser?")) return;
    try {
      const response = await chrome.runtime.sendMessage({ type: "mindgrid:clear" });
      if (!response?.ok) throw new Error(response?.error || "The extension could not clear its data.");
      state.expanded = null;
      state.search = "";
      state.data = await readData();
      showToast("Your local MindGrid data has been deleted.");
      render();
    } catch (error) {
      console.error("MindGrid could not delete local data:", error);
      showToast("Could not delete your data. Please try again.");
    }
  }
});

document.addEventListener("input", (event) => {
  if (event.target.id === "platform-search") {
    state.search = event.target.value;
    renderPlatformList();
  }
});

document.addEventListener("change", async (event) => {
  try {
    if (event.target.matches("[data-category-domain]")) {
      const response = await chrome.runtime.sendMessage({
        type: "mindgrid:category",
        domain: event.target.dataset.categoryDomain,
        category: event.target.value
      });
      if (!response?.ok) throw new Error(response?.error || "The extension could not save this website category.");
      state.data = await readData();
      showToast(`Category updated to ${event.target.value}.`);
      render();
      return;
    }
    if (event.target.id === "idle-threshold") {
      const response = await chrome.runtime.sendMessage({
        type: "mindgrid:settings",
        setting: "idleThreshold",
        value: Number(event.target.value)
      });
      if (!response?.ok) throw new Error(response?.error || "The extension could not save this preference.");
      state.data = await readData();
      const syncResponse = await chrome.runtime.sendMessage({ type: "mindgrid:sync" });
      if (!syncResponse?.ok) throw new Error(syncResponse?.error || "The extension could not apply the idle detection preference.");
      showToast("Idle detection preference saved.");
      return;
    }
    if (event.target.id === "daily-goal") {
      const minutes = Math.max(0, Math.min(1440, Number(event.target.value) || 0));
      const response = await chrome.runtime.sendMessage({
        type: "mindgrid:settings",
        setting: "dailyGoalSeconds",
        value: Math.round(minutes * 60)
      });
      if (!response?.ok) throw new Error(response?.error || "The extension could not save this preference.");
      state.data = await readData();
      render();
      showToast(minutes ? "Daily browsing goal saved." : "Daily browsing goal turned off.");
    }
  } catch (error) {
    console.error("MindGrid could not save this preference:", error);
    showToast("Could not save this preference. Please try again.");
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.mindgridData) {
    readData().then((data) => {
      state.data = data;
      render();
    }).catch((error) => {
      console.error("MindGrid could not refresh the dashboard:", error);
      showToast("Could not refresh your report.");
    });
  }
});

async function initialize() {
  try {
    const response = await chrome.runtime.sendMessage({ type: "mindgrid:sync" });
    if (!response?.ok) throw new Error(response?.error || "The extension could not refresh its report.");
    state.data = await readData();
    render();
  } catch (error) {
    console.error("MindGrid could not initialize the dashboard:", error);
    root.innerHTML = `<div class="panel empty-state"><strong>Your report could not be loaded.</strong>Reload the dashboard to try again.</div>`;
  }
}

initialize();
