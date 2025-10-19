# axe Auto Reporter Web

This dashboard application uses [@axe-core/puppeteer](https://github.com/dequelabs/axe-core-npm/blob/develop/packages/puppeteer/README.md) to crawl the URLs listed in a `sitemap.xml`, execute accessibility audits automatically, and surface the results as reports.

![axe Auto Reporter Web](./public/img/main-logo.svg)

![Dashboard screenshot](./public/img/screen-shot-axe-Auto-Reporter-Web.png)

![Report page screenshot](./public/img/screen-shot-axe-Auto-Reporter-Web-02.png)

## Requirements
- Node.js 22.x or later
- npm 10.x or later

> [!TIP]  
> When running on Linux, Chromium dependencies required by Puppeteer might be missing. If you hit runtime errors, install the packages listed in the project `Dockerfile` before running the scripts.

## Installation
Clone the repository, move into it, and install the dependencies.

```sh
git clone https://github.com/burnworks/axe-auto-reporter-web.git
cd axe-auto-reporter-web
npm install
```

## Initial Setup & First Report

### 1. Build and preview the site
Run the commands below and open `http://localhost:3000` in your browser.

```sh
npm run build
npm run preview -- --host 0.0.0.0 --port 3000
```

The first launch creates the required files under `data/`.

### 2. Configure the settings
Open the Settings screen, enter the sitemap URL and other required options, and save. The values are written to `data/settings.json` and `data/url-list.txt`.

### 3. Execute the pipeline once
Run the following command in another terminal to trigger a one-off crawl with the saved settings (wait until the command completes).

```sh
node script/scheduler.mjs --once
```

### 4. Verify the report
Return to the browser and refresh the page to confirm that the first report cards are displayed.

### 5. Test scheduling
After the initial report has been generated you have two options:

1)   
Keep the scheduler running in another terminal so it follows the frequency selected on the Settings screen.

```sh
node script/scheduler.mjs
```

2)   
Or, schedule the following command with Windows Task Scheduler, macOS launchd, or a similar tool. In this mode the in-app “test frequency” is ignored; configure the interval on the OS side instead.

```sh
node script/scheduler.mjs --once
```

If scheduling is troublesome, feel free to run `node script/scheduler.mjs --once` manually whenever you need a fresh report.

The scheduler always reads `data/settings.json` before each run and uses the sitemap URL, tags, crawl mode, maximum pages, and frequency (`daily`, `weekly`, or `monthly`). Generated reports are stored under `src/pages/results/` and indexed in `data/reports/index.json`.

## Notes (as of v1.0.0)

- This project is intended for local machines or closed server environments. Authentication and authorization are not implemented, so do not deploy it on a publicly accessible server.
- Only URLs beginning with `http://` or `https://` are processed. Non-HTML resources (e.g., PDFs) may open in the browser viewer, but meaningful accessibility results will not be produced.
- The dashboard does not expose failure alerts. If a report is missing or incomplete, check the execution logs from `script/axe-auto-reporter.mjs`.

## Related Scripts

- [burnworks/axe-auto-reporter](https://github.com/burnworks/axe-auto-reporter/tree/main)
