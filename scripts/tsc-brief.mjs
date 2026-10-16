/**
 * Runs `tsc` (passing through all arguments) and condenses each diagnostic to
 * one line: `file:line:col TSxxxx message…` (message truncated).
 *
 * * tsc's indented elaboration lines are dropped
 * * other lines (e.g. watch-mode status) pass through unchanged
 * * exits with tsc's exit code
 */
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { join } from 'node:path';


const MAX_MSG_LEN = 20;

// ANSI colours (off when `NO_COLOR` is set)
const useColor = !process.env.NO_COLOR;
const cyan = s => useColor ? `\x1b[36m${s}\x1b[0m` : s;

const tscPath = join(process.cwd(), 'node_modules', 'typescript', 'bin', 'tsc');
const args = [...process.argv.slice(2), '--pretty', 'false'];

const tsc = spawn(process.execPath, [tscPath, ...args], { stdio: ['inherit', 'pipe', 'inherit'] });

const diagRegex = /^(.+)\((\d+),(\d+)\): (?:error|warning) (TS\d+): (.*)$/;

let count = 0;

createInterface({ input: tsc.stdout }).on('line', line => {
    // elaboration of the previous diagnostic
    if (/^\s/.test(line)) { return; }

    const m = line.match(diagRegex);
    if (!m) { console.log(line); return; }

    const [, file, row, col, code, msg] = m;
    const msg_ = msg.length > MAX_MSG_LEN
        ? msg.slice(0, MAX_MSG_LEN - 1) + '…'
        : msg;

    count++;
    console.log(`${cyan(`${file}:${row}:${col}`)} ${code} ${msg_}`);
});

tsc.on('close', code => {
    if (count > 0) { console.log(`${count} error(s)`); }
    process.exit(code ?? 1);
});
