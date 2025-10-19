import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import minimist from 'minimist';
import cron from 'node-cron';
import config, { loadSettings, runtimeSettings } from './config.mjs';

const __filename = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(__filename);
const ROOT_DIR = path.resolve(SCRIPT_DIR, '..');

const commandPaths = {
    generate: path.join(SCRIPT_DIR, 'generate-url-list.mjs'),
    reporter: path.join(SCRIPT_DIR, 'axe-auto-reporter.mjs'),
    summary: path.join(SCRIPT_DIR, 'build-summary.mjs')
};

const REPORTS_INDEX_PATH = path.join(ROOT_DIR, 'data', 'reports', 'index.json');
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const FREQUENCY_INTERVAL_DAYS = {
    daily: 1,
    weekly: 7,
    monthly: 30
};

const runCommand = (commandPath, args = []) =>
    new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [commandPath, ...args], {
            stdio: 'inherit',
            cwd: ROOT_DIR,
            env: process.env
        });

        child.on('close', (code) => {
            if (code === 0) {
                resolve(undefined);
            } else {
                reject(new Error(`${path.basename(commandPath)} exited with code ${code}`));
            }
        });
    });

const findLatestRunDirectory = async () => {
    const outputDir = config.outputDirectory;

    let entries = [];
    try {
        entries = await fs.readdir(outputDir, { withFileTypes: true });
    } catch (error) {
        console.error('結果ディレクトリの読み込みに失敗しました。', error);
        return null;
    }

    const directories = entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);

    if (directories.length === 0) {
        return null;
    }

    directories.sort((a, b) => b.localeCompare(a));
    return path.join(outputDir, directories[0]);
};

const readLatestRunTimestamp = async () => {
    try {
        const content = await fs.readFile(REPORTS_INDEX_PATH, 'utf-8');
        const parsed = JSON.parse(content);
        if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.runs) || parsed.runs.length === 0) {
            return null;
        }

        const [latest] = parsed.runs;
        if (!latest || typeof latest !== 'object') {
            return null;
        }

        const timestamp =
            typeof latest.runTimestamp === 'string' && latest.runTimestamp
                ? latest.runTimestamp
                : typeof latest.generatedAt === 'string'
                    ? latest.generatedAt
                    : null;

        if (!timestamp) {
            return null;
        }

        const parsedDate = new Date(timestamp);
        return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
    } catch {
        return null;
    }
};

const getCurrentSettings = async () => {
    try {
        return await loadSettings();
    } catch (error) {
        console.warn('設定ファイルの再読込に失敗したため、起動時の設定を使用します。', error);
        return runtimeSettings;
    }
};

const evaluateSchedule = async (frequency) => {
    const intervalDays = FREQUENCY_INTERVAL_DAYS[frequency] ?? FREQUENCY_INTERVAL_DAYS.daily;
    if (frequency === 'daily') {
        return { shouldRun: true, remainingDays: 0, lastRun: null };
    }

    const latestRun = await readLatestRunTimestamp();
    if (!latestRun) {
        return { shouldRun: true, remainingDays: 0, lastRun: null };
    }

    const diffMs = Date.now() - latestRun.getTime();
    const diffDays = diffMs > 0 ? diffMs / DAY_IN_MS : 0;

    if (diffDays >= intervalDays) {
        return { shouldRun: true, remainingDays: 0, lastRun: latestRun };
    }

    return {
        shouldRun: false,
        remainingDays: Math.max(intervalDays - diffDays, 0),
        lastRun: latestRun
    };
};

const runPipeline = async () => {
    const startedAt = new Date().toISOString();
    console.log(`[${startedAt}] 自動テスト処理を開始します。`);

    await runCommand(commandPaths.generate);
    await runCommand(commandPaths.reporter);

    const latestDir = await findLatestRunDirectory();
    if (!latestDir) {
        throw new Error('レポートディレクトリを特定できませんでした。');
    }

    await runCommand(commandPaths.summary, ['--path', latestDir]);

    console.log('Running npm run build to update static assets...');
    await runCommand(process.execPath, ['node_modules/npm/bin/npm-cli.js', 'run', 'build']);

    const finishedAt = new Date().toISOString();
    console.log(`[${finishedAt}] 自動テスト処理が完了しました。`);
};

const maybeRunPipeline = async () => {
    const settings = await getCurrentSettings();
    const rawFrequency = settings?.frequency ?? 'daily';
    const frequency = FREQUENCY_INTERVAL_DAYS[rawFrequency] ? rawFrequency : 'daily';
    const decision = await evaluateSchedule(frequency);

    if (decision.shouldRun) {
        await runPipeline();
        return;
    }

    const remaining = Math.max(decision.remainingDays ?? 0, 0);
    const lastRunText = decision.lastRun ? decision.lastRun.toISOString() : 'N/A';
    console.log(
        `[${new Date().toISOString()}] 頻度設定(${frequency})により定期実行をスキップしました。次の実行まで約 ${remaining.toFixed(
            2
        )} 日です。(最終実行: ${lastRunText})`
    );
};

const args = minimist(process.argv.slice(2), {
    boolean: ['once'],
    alias: { once: 'run' }
});

if (args.once) {
    try {
        await runPipeline();
    } catch (error) {
        console.error('ワンショット実行でエラーが発生しました。', error);
        process.exit(1);
    }
    process.exit(0);
}

const schedule = '0 3 * * *';

cron.schedule(
    schedule,
    () => {
        maybeRunPipeline().catch((error) => {
            console.error('定期実行でエラーが発生しました。', error);
        });
    },
    {
        timezone: 'Asia/Tokyo'
    }
);

const initialFrequency = FREQUENCY_INTERVAL_DAYS[config.frequency] ? config.frequency : 'daily';
console.log(`スケジューラを起動しました。03:00 (Asia/Tokyo) に頻度設定(${initialFrequency})をもとに実行判定を行います。`);
