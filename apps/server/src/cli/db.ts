// Database maintenance CLI.
//
//   tsx src/cli/db.ts <command> [options]
//
// Deliberately does not import services/db.js. That module starts an hourly
// cleanup setInterval at import time and never clears it, so anything importing
// it can never reach a clean exit -- a maintenance command that has to be
// Ctrl-C'd is worse than no command. It also runs a writability preflight that
// calls process.exit(1), which is not what you want from a tool whose job is to
// report on the data directory. So this opens its own handle.
//
// The one thing it must agree with the app about is *where* the files are, so
// paths come from services/data-dir.js -- the same module db.ts and crypto.ts
// read. Two copies of a DATA_DIR lookup is how a database and its encryption
// key end up in different directories, which is unrecoverable.

import 'dotenv/config';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
// node:readline/promises, not node:readline: question() is callback-only in the
// callback module's types (@types/node 20), and awaiting the callback form means
// wrapping it in a constructor-shaped promise for no gain.
import readline from 'node:readline/promises';
import Database from 'better-sqlite3';
import { DATA_DIR, DATA_DIR_IS_DEFAULT, DB_PATH, KEY_PATH, UPLOAD_TEMP_DIR, DB_SIDECAR_PATHS } from '../services/data-dir.js';

// `db info | head` and `db sql "..." | grep` close the pipe while output is
// still buffered. Node turns that into an unhandled 'error' on stdout and
// prints a stack trace over the output the user was trying to read. Exiting
// quietly is what every other CLI does.
process.stdout.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EPIPE') process.exit(0);
  throw err;
});

const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

const noColour =
  process.env.NO_COLOR !== undefined || !(process.stdout.isTTY || process.stderr.isTTY);
const c = (code: string, s: string) => (noColour ? s : `${code}${s}${RESET}`);

// Prompts and previews for the destructive commands go to stderr, never stdout.
// `db reset | head` closes stdout after a few lines; if the preview were on
// stdout, the process would be killed by EPIPE partway through and exit 0 having
// deleted nothing -- a destructive command that reports success but does not
// act. Keeping these off stdout also means the prompt survives being piped into
// tee or a pager, which is the conventional place for it.
const warn = (msg = ''): void => console.error(msg);

const humanBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
};

const sizeOf = (p: string): string => (fs.existsSync(p) ? humanBytes(fs.statSync(p).size) : c(DIM, 'absent'));

/**
 * Prompt before a destructive command.
 *
 * Refuses rather than assuming when stdin is not a terminal. A script that
 * blocks forever waiting for a keypress in CI or inside `pnpm -r` is a hang
 * with no diagnostic, so the non-interactive case has to be an explicit --yes.
 */
const confirm = async (question: string): Promise<boolean> => {
  if (!process.stdin.isTTY) {
    console.error(
      `\n${c(YELLOW, 'Refusing to run a destructive command without a terminal.')}\n` +
        `Pass --yes to confirm non-interactively.`,
    );
    return false;
  }
  // Prompt goes to stderr so it is not swallowed by a pipe on stdout.
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  try {
    const answer = (await rl.question(`${question} [y/N] `)).trim().toLowerCase();
    return answer === 'y' || answer === 'yes';
  } finally {
    rl.close();
  }
};

/** Open the database read-write, creating an empty file if none exists. */
const open = (): Database.Database => {
  if (!fs.existsSync(DATA_DIR)) {
    if (!process.argv.includes('--create')) {
      console.error(
        `${c(RED, 'error')} data directory does not exist: ${DATA_DIR}\n` +
          `Start the server once to create it, or pass --create.`,
      );
      process.exit(1);
    }
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  return new Database(DB_PATH);
};

/** Application tables, excluding SQLite's own bookkeeping. */
const appTables = (db: Database.Database): string[] =>
  (db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`).all() as { name: string }[]).map(
    (r) => r.name,
  );

/**
 * Is something already serving on the app's port?
 *
 * Wiping the database out from under a running server is the failure this check
 * exists for, and SQLite will not stop it: the server holds an open handle, its
 * hourly cleanup timer can write a session row moments after the wipe, and
 * index.ts caches session_secret in memory at boot, so a reset leaves it signing
 * cookies with a secret that no longer exists in the database. The result is a
 * server that appears healthy and rejects every login.
 *
 * A connection attempt cannot prove *which* process answered, so this is a
 * warning rather than a refusal -- a false positive costs one line of output,
 * whereas refusing outright would break resetting a box where the port is held
 * by something unrelated.
 */
const serverLooksRunning = async (): Promise<boolean> => {
  const port = Number(process.env.PORT) || 3000;
  return new Promise<boolean>((resolve) => {
    // Not connecting to 0.0.0.0/:: -- bind the loopback interface instead.
    const socket = new net.Socket();
    const settle = (result: boolean): void => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(400);
    socket.once('connect', () => settle(true));
    socket.once('timeout', () => settle(false));
    socket.once('error', () => settle(false));
    socket.connect(port, '127.0.0.1');
  });
};

const warnIfServerRunning = async (): Promise<void> => {
  if (!(await serverLooksRunning())) return;
  const port = Number(process.env.PORT) || 3000;
  warn(`\n  ${c(YELLOW, 'warning')}  something is already listening on port ${port}.`);
  warn(`  ${c(DIM, 'If that is the S3 Explorer server, stop it first. It caches')}`);
  warn(`  ${c(DIM, 'session_secret in memory and will keep writing rows after a wipe,')}`);
  warn(`  ${c(DIM, 'leaving a server that looks healthy but rejects every login.')}`);
};

const printTable = (name: string, rows: unknown[]): void => {
  if (rows.length === 0) {
    console.log(`  ${c(name, name)}\n    ${c(DIM, '(no rows)')}`);
    return;
  }
  const columns = Object.keys(rows[0] as Record<string, unknown>);
  // Long blobs (session payloads) are truncated so one wide row cannot push
  // every other column off the terminal.
  const cells = rows.map((r) =>
    columns.map((col) => {
      const v = (r as Record<string, unknown>)[col];
      if (v === null || v === undefined) return c(DIM, 'NULL');
      const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
      return s.length > 60 ? `${s.slice(0, 57)}...` : s;
    }),
  );
  const widths = columns.map((col, i) => Math.max(col.length, ...cells.map((row) => row[i].length)));
  const line = (vals: string[]) => vals.map((v, i) => v.padEnd(widths[i])).join('  ');

  console.log(`  ${c(BOLD, name)}  ${c(DIM, `(${rows.length} row${rows.length === 1 ? '' : 's'})`)}`);
  console.log(`    ${c(DIM, line(columns))}`);
  console.log(`    ${c(DIM, widths.map((w) => '-'.repeat(w)).join('  '))}`);
  for (const row of cells) console.log(`    ${line(row)}`);
};

// Path on its own line, size right-aligned against the label column. Absolute
// paths in a mounted volume get long, and putting them on the same line as the
// size pushes the sizes into a ragged column.
/**
 * "There is nothing here" is the message that most needed to be actionable and
 * was least actionable: the path is a derived default, so `no database at
 * /data/s3explorer.db` tells the reader nothing about why they are looking in
 * the wrong place or what to do instead.
 */
const noDatabase = (): void => {
  warn(`  ${c(YELLOW, 'no database')} at ${DB_PATH}`);
  if (DATA_DIR_IS_DEFAULT) {
    warn(`\n  ${c(DIM, 'DATA_DIR is not set, so the development default was used:')}`);
    warn(`    ${c(BOLD, DATA_DIR)}`);
    warn(`\n  If your database is elsewhere, point at it:`);
    warn(`    ${c(BOLD, 'DATA_DIR=/path/to/dir')} pnpm db:info`);
    warn(`\n  ${c(DIM, 'A container deployment sets DATA_DIR=/data; a local one normally wants')}`);
    warn(`  ${c(DIM, 'apps/server/data. Both the server and this CLI read the same variable.')}`);
  }
  warn(`\n  ${c(DIM, 'If this is a fresh install, start the server once and it will create the database.')}`);
};

const describe = (p: string, label: string): string =>
  `  ${c(BOLD, label)}\n    ${p}  ${c(DIM, sizeOf(p))}`;

// ---------------------------------------------------------------- commands

const cmdInfo = (): void => {
  console.log(`\n${c(BOLD, 'Storage')}`);
  console.log(
    DATA_DIR_IS_DEFAULT
      ? `  ${c(DIM, 'DATA_DIR is unset')} ${c(YELLOW, '->')} ${c(DIM, 'default for')} NODE_ENV=${process.env.NODE_ENV ?? '(unset)'}`
      : `  ${c(DIM, `DATA_DIR=${process.env.DATA_DIR}`)}`,
  );
  console.log(describe(DB_PATH, 'database'));
  console.log(describe(KEY_PATH, 'encryption key'));
  for (const sidecar of DB_SIDECAR_PATHS) {
    if (fs.existsSync(sidecar)) console.log(describe(sidecar, path.basename(sidecar)));
  }
  console.log(describe(UPLOAD_TEMP_DIR, 'tmp-uploads'));

  if (!fs.existsSync(DB_PATH)) {
    noDatabase();
    return;
  }

  const db = open();
  try {
    const journal = db.pragma('journal_mode', { simple: true }) as string;
    const { v: sqliteVersion } = db.prepare('SELECT sqlite_version() AS v').get() as { v: string };
    console.log(`\n${c(BOLD, 'Database')}`);
    console.log(`  ${'sqlite version'.padEnd(22)} ${sqliteVersion}`);
    console.log(`  ${'journal mode'.padEnd(22)} ${journal}`);
    // The check that matters: a WAL left behind by a killed process is the
    // normal way this file gets into a state where reads silently return
    // nothing useful.
    const integrity = (db.pragma('integrity_check', { simple: true }) as string).trim();
    if (integrity === 'ok') {
      console.log(`  ${'integrity check'.padEnd(22)} ${c(GREEN, 'ok')}`);
    } else {
      console.log(`  ${'integrity check'.padEnd(22)} ${c(RED, integrity)}`);
      process.exitCode = 1;
    }

    const tables = appTables(db);
    const total = tables.reduce((n, t) => n + (db.prepare(`SELECT COUNT(*) AS n FROM "${t}"`).get() as { n: number }).n, 0);
    console.log(`\n${c(BOLD, 'Tables')}  ${c(DIM, `${tables.length} tables, ${total} rows total`)}`);
    for (const t of tables) {
      const n = (db.prepare(`SELECT COUNT(*) AS n FROM "${t}"`).get() as { n: number }).n;
      console.log(`  ${t.padEnd(20)} ${String(n).padStart(8)}${n === 0 ? c(DIM, '') : ''}`);
    }
    if (total === 0) console.log(`\n  ${c(DIM, 'nothing stored -- this is a fresh database.')}`);
  } finally {
    db.close();
  }
};

const cmdSql = (args: string[]): void => {
  const statement = args.join(' ').trim();
  if (!statement) {
    console.error(`usage: db sql "SELECT * FROM connections"`);
    process.exit(1);
  }
  const db = open();
  try {
    console.log(`${c(DIM, '>')} ${statement}\n`);
    if (/^\s*(select|pragma|with|explain)/i.test(statement)) {
      printTable('result', db.prepare(statement).all());
    } else {
      const info = db.prepare(statement).run();
      const changed = info.changes;
      console.log(`  ${c(GREEN, 'ok')}  ${changed} row${changed === 1 ? '' : 's'} affected`);
    }
  } catch (err) {
    console.error(`  ${c(RED, 'error')} ${(err as Error).message}`);
    process.exitCode = 1;
  } finally {
    db.close();
  }
};

const cmdBackup = async (args: string[]): Promise<void> => {
  if (!fs.existsSync(DB_PATH)) {
    noDatabase();
    process.exit(1);
    process.exit(1);
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dest = path.resolve(args[0] ?? path.join(process.cwd(), `s3explorer-${stamp}.db`));

  const db = open();
  try {
    // SQLite online backup API, not fs.copyFile. In WAL mode the committed data
    // may live in the -wal file and not yet be in the main database, so a plain
    // file copy can yield a backup that is missing recent writes, or internally
    // inconsistent. The backup API checkpoints as it copies.
    await db.backup(dest);
    console.log(`  ${c(GREEN, "ok")}  wrote ${c(BOLD, dest)}  ${c(DIM, humanBytes(fs.statSync(dest).size))}`);
  } catch (err) {
    console.error(`  ${c(RED, "error")} ${(err as Error).message}`);
    process.exitCode = 1;
    return;
  } finally {
    db.close();
  }

  // A database backup is not a data-dir backup. This note is the reason the
  // command exists, rather than silently producing an artefact that looks
  // complete and is not.
  console.log(
    fs.existsSync(KEY_PATH)
      ? `
  ${c(YELLOW, "note")}  the backup does NOT include ${path.basename(KEY_PATH)}. Copy it alongside, or the encrypted credentials inside are unreadable.`
      : `
  ${c(DIM, "note")}  no encryption key present, so nothing in this backup is encrypted.`,
  );
};

const cmdReset = async (args: string[]): Promise<void> => {
  const yes = args.includes('--yes');
  if (!fs.existsSync(DB_PATH)) {
    noDatabase();
    return;
  }

  const db = open();
  const tables = appTables(db);
  const counts = tables.map((t) => [t, (db.prepare(`SELECT COUNT(*) AS n FROM "${t}"`).get() as { n: number }).n] as const);
  const total = counts.reduce((n, [, c2]) => n + c2, 0);
  db.close();

  if (total === 0) {
    warn(`  ${c(YELLOW, 'nothing to do')} -- every table is already empty`);
    return;
  }

  warn(`\n${c(BOLD, 'Will delete')}  ${c(DIM, `${total} rows across ${tables.length} tables`)}`);
  for (const [t, n] of counts.filter(([, n]) => n > 0)) warn(`  ${t.padEnd(20)} ${String(n).padStart(8)}`);
  warn(`\n  ${c(DIM, `keeps ${path.basename(KEY_PATH)}, so credentials re-added later use the same key`)}`);

  await warnIfServerRunning();

  if (!yes && !(await confirm(`\nDelete all ${total} rows?`))) {
    warn('  cancelled');
    return;
  }

  const handle = open();
  try {
    // Deletes go in one transaction, so a failure part-way cannot leave a
    // half-wiped database. VACUUM is deliberately outside it -- SQLite refuses
    // to vacuum from inside a transaction, and wrapping both means the reset
    // fails at the last step having already discarded all the work.
    const wipe = handle.transaction(() => {
      let removed = 0;
      for (const t of tables) removed += handle.prepare(`DELETE FROM "${t}"`).run().changes;
      // Reset AUTOINCREMENT counters so ids restart at 1 in a fresh install.
      // appTables filters out sqlite_% already, so this is looked up directly.
      if (handle.prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name='sqlite_sequence'`).get()) {
        handle.exec('DELETE FROM sqlite_sequence');
      }
      return removed;
    });
    const removed = wipe();
    // Reclaims the file space rather than leaving it allocated to deleted rows.
    handle.exec('VACUUM');
    warn(`\n  ${c(GREEN, 'ok')}  deleted ${removed} rows, ${c(DIM, `now ${humanBytes(fs.statSync(DB_PATH).size)}`)}`);
  } catch (err) {
    console.error(`  ${c(RED, 'error')} ${(err as Error).message}`);
    process.exitCode = 1;
  } finally {
    handle.close();
  }
};

const cmdNuke = async (args: string[]): Promise<void> => {
  const yes = args.includes('--yes');

  // The irreversibility check. Deleting the key while leaving ciphertext behind
  // is the one combination that silently breaks a working install: the
  // connections rows still list valid-looking endpoints, and every request
  // fails at decrypt time with a confusing auth error instead of "no key".
  let connectionCount = 0;
  if (fs.existsSync(DB_PATH)) {
    const db = open();
    try {
      if (appTables(db).includes('connections')) {
        connectionCount = (db.prepare('SELECT COUNT(*) AS n FROM connections').get() as { n: number }).n;
      }
    } finally {
      db.close();
    }
  }

  const targets = [DB_PATH, ...DB_SIDECAR_PATHS, KEY_PATH].filter((p) => fs.existsSync(p));

  if (targets.length === 0) {
    warn(`  ${c(YELLOW, 'nothing to do')} -- ${DATA_DIR} contains no database or key`);
    return;
  }

  warn(`\n${c(BOLD, 'Will delete')}`);
  for (const t of targets) warn(`  ${t}  ${c(DIM, humanBytes(fs.statSync(t).size))}`);

  if (connectionCount > 0) {
    warn(
      `\n  ${c(RED, `${connectionCount} stored connection${connectionCount === 1 ? '' : 's'}`)} will be lost, including S3\n` +
        `  credentials. The encryption key is deleted alongside them, so a backup\n` +
        `  of this data dir will never be decryptable again.`,
    );
  }

  await warnIfServerRunning();

  if (!yes && !(await confirm(`\nPermanently delete ${targets.length} file(s)?`))) {
    warn('  cancelled');
    return;
  }

  for (const t of targets) {
    fs.rmSync(t, { force: true });
    warn(`  ${c(GREEN, 'removed')}  ${t}`);
  }
  // Interrupted multipart uploads are the other thing that does not belong in a
  // "fresh install": multer never got to clean them up.
  if (fs.existsSync(UPLOAD_TEMP_DIR)) {
    const leftover = fs.readdirSync(UPLOAD_TEMP_DIR).length;
    fs.rmSync(UPLOAD_TEMP_DIR, { recursive: true, force: true });
    if (leftover) warn(`  ${c(GREEN, 'removed')}  ${UPLOAD_TEMP_DIR} ${c(DIM, `(${leftover} partial upload(s))`)}`);
  }
  warn(`\n  ${c(GREEN, 'ok')}  ${DATA_DIR} is clear. The server recreates everything on next start.`);
};

// ------------------------------------------------------------------ runner

const USAGE = `
${c(BOLD, 'S3 Explorer database CLI')}

  ${c(BOLD, 'db info')}                  paths, sizes, row counts, integrity check
  ${c(BOLD, 'db sql')} "<statement>"     run a statement; SELECT results print as a table
  ${c(BOLD, 'db backup')} [file]        consistent online backup (handles WAL correctly)
  ${c(BOLD, 'db reset')} [--yes]        delete all rows, keep schema and encryption key
  ${c(BOLD, 'db nuke')} [--yes]         delete the database, its WAL sidecars, and the key

${c(BOLD, 'reset vs nuke')}
  reset   keeps ${path.basename(KEY_PATH)} and the schema. Use this to start over.
  nuke    removes the key too. Only for rotating a key you suspect was exposed;
          without it, deleting the database alone already clears every credential.

${c(DIM, 'Honours DATA_DIR, the same variable the server uses. Defaults to /data.')}`;

const [, , command, ...args] = process.argv;

switch (command) {
  case 'info':
    cmdInfo();
    break;
  case 'sql':
    cmdSql(args);
    break;
  case 'backup':
    await cmdBackup(args);
    break;
  case 'reset':
    await cmdReset(args);
    break;
  case 'nuke':
    await cmdNuke(args);
    break;
  case undefined:
  case '--help':
  case '-h':
  case 'help':
    console.log(USAGE);
    break;
  default:
    console.error(`${c(RED, 'error')} unknown command: ${command}\n`);
    console.log(USAGE);
    process.exitCode = 1;
}
