# MindGrid

MindGrid is a local-first Chrome extension that helps you understand how much active browsing time you spend on each website. It includes a quick popup, a full dashboard, daily and weekly reports, editable categories, rule-based insights, and controls to export or delete your data.

## Can Chrome host MindGrid?

Yes. Chrome runs MindGrid as a browser extension, so you can use it directly in Chrome without setting up a web server, account, database, or backend. For personal use, load the extension folder into Chrome using the steps below. This is different from hosting a public website: the dashboard runs inside Chrome as an extension page.

To distribute MindGrid to other people, package the extension and submit it to the Chrome Web Store. Store publication requires a developer account and compliance with Google's current extension review and privacy policies. Loading an unpacked extension is intended for development and personal testing.

## Install in Chrome

1. Make sure the MindGrid project folder is available on your computer and contains `manifest.json`, `service-worker.js`, and the other extension files.
2. Open `chrome://extensions` in Google Chrome.
3. Turn on **Developer mode** using the switch near the top-right.
4. Select **Load unpacked**.
5. Choose the MindGrid folder that contains `manifest.json` (the `extension` folder in this project).
6. Open Chrome's **Extensions** menu and pin MindGrid to the toolbar for convenient access.
7. Select the MindGrid toolbar icon to open the popup.

No Node.js install, build command, server, or login is required. If you change extension files while developing, return to `chrome://extensions`, select the reload icon on the MindGrid card, and reopen the popup or dashboard.

## Use MindGrid

### Quick popup

Select the MindGrid toolbar icon to see today's tracked time and your three most-used websites. Select **Open full dashboard** for reports and settings.

### Dashboard

The dashboard opens as a Chrome extension page from the popup. You can also open it from the MindGrid card in `chrome://extensions` by selecting **Extension options**.

- **Overview:** total tracked time, number of websites, daily average, comparison with the previous period, a seven-day chart, platform rankings, category totals, and a short locally calculated summary.
- **Report periods:** choose Today, Yesterday, 7 days, or 30 days.
- **Platforms:** search tracked websites, see time and visit counts, inspect visit/session estimates and switches, and change each website's category.
- **Insights:** review simple summaries calculated from your local totals. These are observations, not productivity scores or judgments.
- **Settings:** change the idle threshold, set an optional daily time goal, export a JSON copy, or delete MindGrid data.

Category changes are saved for that website in the current Chrome profile. For example, you can change YouTube from Entertainment to Learning.

## What MindGrid counts

MindGrid estimates time while a regular Chrome window is focused, Chrome reports the computer as active, and an HTTP or HTTPS website is selected. It saves aggregated daily website totals, visit counts, session-time estimates, and website-switch counts. The totals are divided at local midnight.

MindGrid does not count Incognito tabs or browser-internal pages such as `chrome://extensions`. It stores website domains rather than full page URLs, and does not read page contents, search terms, or query strings. The estimate describes active browsing—not whether you are paying attention to a page.

The extension's Manifest V3 service worker can be suspended by Chrome. MindGrid periodically checkpoints its totals and reconciles activity when browser events resume. An uncheckpointed interval is capped when the active website changes or becomes ineligible, to reduce accidental overcounting.

## Data, privacy, and permissions

Reports and preferences are stored in Chrome's local extension storage for the current browser profile. Daily report records older than 30 local calendar days are automatically removed as MindGrid updates its data. Category preferences and settings are not affected by this retention period. Export your data before it ages out if you want to keep a longer-term copy. MindGrid has no account, backend, or cloud sync. Your reports are not automatically shared with other Chrome profiles or devices.

- `tabs`: identify the selected website domain for time totals.
- `idle`: stop counting after the selected inactivity threshold.
- `alarms`: periodically save time totals.
- `storage`: save reports and preferences locally in Chrome.

Use **Export data** in the dashboard or **Settings → Export JSON** to download your MindGrid data. **Settings → Delete my data** removes the saved MindGrid report and category preferences from this Chrome profile. Uninstalling the extension also removes its locally stored Chrome extension data.

## Troubleshooting

- **The extension does not appear:** confirm that Developer mode is enabled and that you selected the folder containing `manifest.json`.
- **The toolbar icon is hidden:** open Chrome's Extensions menu and pin MindGrid.
- **A code change is not showing:** reload MindGrid on `chrome://extensions`, then reopen the popup or dashboard.
- **There is no browsing time yet:** only eligible active Chrome browsing is counted; start with an HTTP or HTTPS site in a focused regular window.
- **Reports differ from time spent looking at a screen:** MindGrid estimates selected-tab browsing time and cannot determine attention or activity in other applications.
