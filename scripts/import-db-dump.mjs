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
const databaseUrl = args.databaseUrl ?? process.env.DATABASE_URL ?? "";
const sql = await readImportSql(dumpPath);
const summary = summarizeSql(sql);

if (args.dryRun) {
  printSummary({ dumpPath, databaseUrl, summary, dryRun: true });
  process.exit(0);
}

if (!databaseUrl || databaseUrl.includes("USER:PASSWORD@HOST")) {
  throw new Error("DATABASE_URL is not set. Add it to .env or pass --database-url.");
}

if (summary.dropTableCount > 0 && !args.confirmDrop && process.env.ALLOW_DB_IMPORT_DROP !== "true") {
  throw new Error(
    "This dump contains DROP TABLE statements. Re-run with ALLOW_DB_IMPORT_DROP=true or --confirm-drop after confirming the target DB is empty/disposable.",
  );
}

const connectionOptions = parseDatabaseUrl(databaseUrl);
printSummary({ dumpPath, databaseUrl, summary, dryRun: false });

const connection = await mysql.createConnection(connectionOptions);
try {
  await connection.query(sql);
  console.log("Import completed successfully.");
} finally {
  await connection.end();
}

async function readImportSql(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return raw
    .replace(/^\uFEFF/, "")
    .replaceAll(/\/\*T!\[[^\]]*\][^*]*\*\//g, "")
    .replaceAll(/^LOCK TABLES .*?\r?\n/gm, "")
    .replaceAll(/^UNLOCK TABLES;\r?\n/gm, "");
}

function summarizeSql(sqlText) {
  return {
    bytes: Buffer.byteLength(sqlText, "utf8"),
    createTableCount: countMatches(sqlText, /^CREATE TABLE `/gm),
    dropTableCount: countMatches(sqlText, /^DROP TABLE IF EXISTS `/gm),
    insertStatementCount: countMatches(sqlText, /^INSERT INTO `/gm),
  };
}

function countMatches(text, pattern) {
  return Array.from(text.matchAll(pattern)).length;
}

function parseArgs(rawArgs) {
  const parsed = {};
  for (let i = 0; i < rawArgs.length; i += 1) {
    const arg = rawArgs[i];
    if (arg === "--") continue;
    else if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--dry-run") parsed.dryRun = true;
    else if (arg === "--confirm-drop") parsed.confirmDrop = true;
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

function printSummary({ dumpPath, databaseUrl, summary, dryRun }) {
  const target = databaseUrl ? maskDatabaseUrl(databaseUrl) : "(DATABASE_URL not set)";
  console.log(`${dryRun ? "Dry run" : "Import"} target: ${target}`);
  console.log(`Dump file: ${dumpPath}`);
  console.log(`SQL bytes: ${summary.bytes}`);
  console.log(`CREATE TABLE statements: ${summary.createTableCount}`);
  console.log(`DROP TABLE statements: ${summary.dropTableCount}`);
  console.log(`INSERT statements: ${summary.insertStatementCount}`);
}

function maskDatabaseUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.password) url.password = "****";
    return url.toString();
  } catch {
    return "(invalid DATABASE_URL)";
  }
}

function printHelp() {
  console.log(`Usage:
  corepack pnpm run db:import:dump -- --dry-run
  $env:ALLOW_DB_IMPORT_DROP='true'; corepack pnpm run db:import:dump

Options:
  --file <path>          SQL dump path. Defaults to migration-input/zaico_db_migration/zaico_inventory_full.import.sql.
  --database-url <url>   Override DATABASE_URL from .env.
  --dry-run              Read and summarize the dump without connecting to DB.
  --confirm-drop         Allow execution of DROP TABLE statements for this run.
`);
}
