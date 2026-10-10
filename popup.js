import { dayTotal, formatDuration, localDateKey, readData } from "./shared.js";

const date = new Date();
document.querySelector("#popup-date").textContent = date.toLocaleDateString(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric"
});
document.querySelector("#open-dashboard").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
});

function displayName(domain) {
  return domain.split(".")[0].replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function render(data) {
  const today = localDateKey(date);
  const entries = Object.entries(data.days[today] || {}).sort((a, b) => b[1].seconds - a[1].seconds);
  document.querySelector("#popup-total").textContent = formatDuration(dayTotal(data, today));
  document.querySelector("#popup-count").textContent = `${entries.length} ${entries.length === 1 ? "platform" : "platforms"}`;
  document.querySelector("#popup-empty").hidden = entries.length > 0;
  document.querySelector("#popup-platforms").innerHTML = entries.slice(0, 3).map(([domain, item]) => `
    <div class="popup-platform">
      <span class="site-monogram" aria-hidden="true">${escapeHtml(displayName(domain).slice(0, 2))}</span>
      <span>
        <span class="popup-site-name">${escapeHtml(displayName(domain))}</span>
        <span class="popup-site-domain">${escapeHtml(domain)}</span>
      </span>
      <span class="popup-site-time">${formatDuration(item.seconds)}</span>
    </div>
  `).join("");
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

async function refresh() {
  try {
    const response = await chrome.runtime.sendMessage({ type: "mindgrid:sync" });
    if (!response?.ok) throw new Error(response?.error || "The extension could not refresh its report.");
    render(await readData());
  } catch (error) {
    console.error("MindGrid could not load today's browsing report:", error);
    document.querySelector("#popup-empty").hidden = false;
    document.querySelector("#popup-empty").textContent = "Your report could not be loaded. Try reopening MindGrid.";
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.mindgridData) {
    readData().then(render).catch((error) => console.error("MindGrid could not refresh today's report:", error));
  }
});

refresh();
