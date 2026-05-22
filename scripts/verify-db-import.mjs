#!/usr/bin/env node
import "dotenv/config";

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const defaultDumpPath = path.resolve(
  projectRoot,
  "..",
  "migration-input",
  "zaico_db_migration",
  "zaico_inventory_full.import.sql",
);

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  printHelp();
  process.exit(0);
}

const dumpPath = path.resolve(process.cwd(), args.file ?? defaultDumpPath);
const sql = await fs.readFile(dumpPath, "utf8");
const expectedCounts = getExpectedCounts(sql);

if (args.dryRun) {
  console.log(`Dump file: ${dumpPath}`);
  for (const [table, expected] of expectedCounts) {
    console.log(`expected ${table.padEnd(28)} rows=${expected}`);
  }
  process.exit(0);
}

const databaseUrl = args.databaseUrl ?? process.env.DATABASE_URL ?? "";
if (!databaseUrl || databaseUrl.includes("USER:PASSWORD@HOST")) {
  throw new Error("DATABASE_URL is not set. Add it to .env or pass --database-url.");
}
const connection = await mysql.createConnection(parseDatabaseUrl(databaseUrl));
const failures = [];

try {
  for (const [table, expected] of expectedCounts) {
    const [rows] = await connection.query(`SELECT COUNT(*) AS count FROM \`${table}\``);
    const actual = Number(rows[0]?.count ?? 0);
    const status = actual === expected ? "ok" : "mismatch";
    console.log(`${status.padEnd(8)} ${table.padEnd(28)} expected=${expected} actual=${actual}`);
    if (actual !== expected) failures.push(`${table}: expected ${expected}, actual ${actual}`);
  }

  const [settings] = await connection.query(
    "SELECT `value` FROM `system_settings` WHERE `key` = 'zaico_enabled' LIMIT 1",
  );
  const zaicoEnabled = settings[0]?.value;
  if (zaicoEnabled !== "false") {
    failures.push(`system_settings.zaico_enabled should be false, actual ${String(zaicoEnabled)}`);
  } else {
    console.log("ok       system_settings.zaico_enabled=false");
  }
} finally {
  await connection.end();
}

if (failures.length > 0) {
  console.error("\nDB import verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("\nDB import verification passed.");

function getExpectedCounts(sqlText) {
  const counts = new Map();
  for (const match of sqlText.matchAll(/^CREATE TABLE `([^`]+)`/gm)) {
    counts.set(match[1], 0);
  }

  const insertRe = /^INSERT INTO `([^`]+)` .*? VALUES ([\s\S]*?);$/gm;
  for (const match of sqlText.matchAll(insertRe)) {
    const table = match[1];
    const rowCount = countValueTuples(match[2]);
    counts.set(table, (counts.get(table) ?? 0) + rowCount);
  }

  return new Map([...counts.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function countValueTuples(valuesSql) {
  let count = 0;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (const char of valuesSql) {
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "'") {
        inString = false;
      }
      continue;
    }

    if (char === "'") {
      inString = true;
    } else if (char === "(") {
      if (depth === 0) count += 1;
      depth += 1;
    } else if (char === ")") {
      depth -= 1;
    }
  }

  return count;
}

function parseArgs(rawArgs) {
  const parsed = {};
  for (let i = 0; i < rawArgs.length; i += 1) {
    const arg = rawArgs[i];
    if (arg === "--") continue;
    else if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--dry-run") parsed.dryRun = true;
    else if (arg === "--file") parsed.file = readValue(rawArgs, ++i, "--file");
    else if (arg.startsWith("--file=")) parsed.file = arg.slice("--file=".length);
    else if (arg === "--database-url") parsed.databaseUrl = readValue(rawArgs, ++i, "--database-url");
    else if (arg.startsWith("--database-url=")) parsed.databaseUrl = arg.slice("--database-url=".length);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function readValue(rawArgs, index, flagName) {
  const value = rawArgs[index];
  if (!value || value.startsWith("--")) throw new Error(`${flagName} requires a value.`);
  return value;
}

function parseDatabaseUrl(rawUrl) {
  const url = new URL(rawUrl);
  if (url.protocol !== "mysql:" && url.protocol !== "mysql2:") {
    throw new Error(`Unsupported DATABASE_URL protocol: ${url.protocol}`);
  }

  const options = {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\/+/, "")),
    charset: "utf8mb4",
    multipleStatements: true,
  };

  const sslParam = url.searchParams.get("ssl");
  const sslMode = url.searchParams.get("ssl-mode") ?? url.searchParams.get("sslmode");
  if (sslParam) {
    if (sslParam === "true" || sslParam === "1") options.ssl = {};
    else if (sslParam !== "false" && sslParam !== "0") options.ssl = JSON.parse(sslParam);
  }
  if (sslMode && sslMode.toLowerCase() !== "disabled") {
    options.ssl ??= { rejectUnauthorized: true };
  }

  return options;
}

function printHelp() {
  console.log(`Usage:
  corepack pnpm run db:verify:import -- --dry-run
  corepack pnpm run db:verify:import

Options:
  --file <path>          SQL dump path. Defaults to migration-input/zaico_db_migration/zaico_inventory_full.import.sql.
  --database-url <url>   Override DATABASE_URL from .env.
  --dry-run              Read expected row counts from the dump without connecting to DB.
`);
}
