import type { CodingLanguage, CodingTestResultView } from '@mentra/shared';
import { getQuickJS, type QuickJSWASMModule } from 'quickjs-emscripten';
import { logger } from '../../logger.js';

/**
 * In-process JavaScript grading. The Coding module is JavaScript-only, so instead of an
 * external sandbox service we run each submission inside a QuickJS interpreter compiled to
 * WebAssembly (`quickjs-emscripten`). The student's code is fully walled off in the WASM
 * VM — no filesystem, no network, no host globals — so untrusted code is safe to run right
 * here in the API. Each test case gets a FRESH VM (no state leaks between cases), bounded by
 * a wall-clock deadline and a memory cap.
 *
 * I/O contract (mirrors the old stdin/stdout model): the test case's `input` is exposed to
 * the student code as the global string `input`, plus `readLine()` / `readInt()` helpers to
 * consume it line by line. The program writes its answer with `console.log(...)` / `print(...)`;
 * that captured output (trimmed) is compared to the test case's expected output.
 */

/** Per-test-case limits. Kept in code (not env) — one fewer thing to configure. */
const TIME_LIMIT_MS = 3_000; // wall-clock per test case; guards infinite loops
const MEMORY_LIMIT_BYTES = 128 * 1024 * 1024; // 128 MB per VM
const STACK_LIMIT_BYTES = 4 * 1024 * 1024; // deep-recursion guard
const OUTPUT_CAP_BYTES = 64 * 1024; // cap captured stdout so a print-spam loop can't OOM us

/**
 * In-sandbox prelude establishing the student-facing I/O contract. Evaluated in the VM
 * BEFORE the student code (as a separate eval, so error line numbers in the student code
 * stay accurate). `__stdin__` (string) and `__print` (host fn) are injected from the host.
 */
const PRELUDE = `
globalThis.input = typeof __stdin__ === 'string' ? __stdin__ : '';
(function () {
  var __lines = input.length ? input.split('\\n') : [];
  var __i = 0;
  globalThis.readLine = function () { return __i < __lines.length ? __lines[__i++] : ''; };
  globalThis.readline = globalThis.readLine;
  globalThis.readInt = function () { return parseInt(globalThis.readLine(), 10); };
  globalThis.readFloat = function () { return parseFloat(globalThis.readLine()); };
  function fmt(a) {
    if (typeof a === 'string') return a;
    if (a === undefined) return 'undefined';
    if (a === null) return 'null';
    if (typeof a === 'object') { try { return JSON.stringify(a); } catch (e) { return String(a); } }
    return String(a);
  }
  function out() { __print(Array.prototype.map.call(arguments, fmt).join(' ')); }
  globalThis.print = out;
  globalThis.console = { log: out, info: out, error: out, warn: out, debug: out };
})();
`;

type RunOutput = { stdout: string; stderr: string; ok: boolean };

let quickjsPromise: Promise<QuickJSWASMModule> | null = null;
/** Load (once) and cache the WASM module — the heavy part; VMs are cheap to spin per run. */
function quickjs(): Promise<QuickJSWASMModule> {
  return (quickjsPromise ??= getQuickJS());
}

/** Run one submission against one stdin in a fresh, bounded QuickJS VM. */
function runOnce(QuickJS: QuickJSWASMModule, code: string, stdin: string): RunOutput {
  const runtime = QuickJS.newRuntime();
  runtime.setMemoryLimit(MEMORY_LIMIT_BYTES);
  runtime.setMaxStackSize(STACK_LIMIT_BYTES);
  const deadline = Date.now() + TIME_LIMIT_MS;
  runtime.setInterruptHandler(() => Date.now() > deadline);

  const vm = runtime.newContext();
  const chunks: string[] = [];
  let outBytes = 0;
  let truncated = false;

  const printFn = vm.newFunction('__print', (argHandle) => {
    const s = vm.getString(argHandle);
    if (outBytes < OUTPUT_CAP_BYTES) {
      chunks.push(s);
      outBytes += s.length;
    } else {
      truncated = true;
    }
  });
  vm.setProp(vm.global, '__print', printFn);
  printFn.dispose();

  const stdinHandle = vm.newString(stdin);
  vm.setProp(vm.global, '__stdin__', stdinHandle);
  stdinHandle.dispose();

  let stderr = '';
  let ok = false;
  try {
    const pre = vm.evalCode(PRELUDE, 'prelude.js');
    if ('error' in pre && pre.error) {
      pre.error.dispose();
      throw new Error('sandbox prelude failed to initialize');
    }
    (pre as { value: import('quickjs-emscripten').QuickJSHandle }).value.dispose();

    const res = vm.evalCode(code, 'submission.js');
    if ('error' in res && res.error) {
      const dumped = vm.dump(res.error) as unknown;
      res.error.dispose();
      stderr = formatSandboxError(dumped, deadline);
    } else {
      (res as { value: import('quickjs-emscripten').QuickJSHandle }).value.dispose();
      // Drain any queued microtasks (resolved promises) the code scheduled.
      runtime.executePendingJobs(64);
      ok = true;
    }
  } catch (err) {
    stderr = err instanceof Error ? err.message : String(err);
  } finally {
    vm.dispose();
    runtime.dispose();
  }

  let stdout = chunks.join('\n');
  if (truncated) stdout += '\n[output truncated]';
  return { stdout, stderr, ok };
}

/** Turn a dumped sandbox error into a concise, student-readable stderr line. */
function formatSandboxError(dumped: unknown, deadline: number): string {
  if (dumped && typeof dumped === 'object') {
    const e = dumped as { name?: string; message?: string };
    const msg = `${e.message ?? ''}`;
    if (/interrupted/i.test(msg) || Date.now() > deadline) {
      return `Time limit exceeded (>${TIME_LIMIT_MS} ms)`;
    }
    if (/out of memory/i.test(msg)) return 'Memory limit exceeded';
    return [e.name, e.message].filter(Boolean).join(': ') || 'Runtime error';
  }
  const s = String(dumped);
  if (/interrupted/i.test(s)) return `Time limit exceeded (>${TIME_LIMIT_MS} ms)`;
  return s || 'Runtime error';
}

/** stdout comparison: normalize line endings, trim trailing whitespace + surrounding blanks. */
function normalizeOutput(s: string): string {
  return s
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n+$/, '')
    .trim();
}

export type GradeResult = {
  status: 'passed' | 'failed' | 'error';
  passedCount: number;
  totalCount: number;
  percent: number;
  results: CodingTestResultView[];
};

/**
 * Run the student's code against every test case and grade it. `passed` means EVERY case
 * matched; a sandbox failure on a case yields `error`. Hidden cases are graded but their
 * I/O is blanked in the returned results.
 */
export async function gradeSubmission(
  language: CodingLanguage,
  code: string,
  testCases: { input: string; expectedOutput: string; hidden: boolean }[],
): Promise<GradeResult> {
  const total = testCases.length;

  // The module is JavaScript-only; guard defensively in case an old/other value slips in.
  if (language !== 'javascript') {
    return {
      status: 'error',
      passedCount: 0,
      totalCount: total,
      percent: 0,
      results: testCases.map((tc, index) => ({
        index,
        passed: false,
        hidden: tc.hidden,
        input: tc.hidden ? '' : tc.input,
        expected: tc.hidden ? '' : tc.expectedOutput,
        actual: '',
        stderr: 'Only JavaScript submissions are supported.',
      })),
    };
  }

  let QuickJS: QuickJSWASMModule;
  try {
    QuickJS = await quickjs();
  } catch (err) {
    logger.error({ err }, 'coding.exec.wasm_load_failed');
    return {
      status: 'error',
      passedCount: 0,
      totalCount: total,
      percent: 0,
      results: testCases.map((tc, index) => ({
        index,
        passed: false,
        hidden: tc.hidden,
        input: tc.hidden ? '' : tc.input,
        expected: tc.hidden ? '' : tc.expectedOutput,
        actual: '',
        stderr: 'Code execution engine failed to start. Try again shortly.',
      })),
    };
  }

  const results: CodingTestResultView[] = [];
  let passedCount = 0;
  let hadError = false;

  for (let index = 0; index < testCases.length; index += 1) {
    const tc = testCases[index]!;
    let actual = '';
    let stderr = '';
    let passed = false;
    try {
      const out = runOnce(QuickJS, code, tc.input);
      actual = out.stdout;
      stderr = out.stderr;
      passed = out.ok && normalizeOutput(out.stdout) === normalizeOutput(tc.expectedOutput);
    } catch (err) {
      hadError = true;
      stderr = err instanceof Error ? err.message : 'Execution failed';
      logger.warn({ err, index }, 'coding.exec.run_failed');
    }
    if (stderr && !passed) hadError = true;
    if (passed) passedCount += 1;
    results.push({
      index,
      passed,
      hidden: tc.hidden,
      input: tc.hidden ? '' : tc.input,
      expected: tc.hidden ? '' : tc.expectedOutput,
      actual: tc.hidden ? '' : actual,
      stderr: tc.hidden ? (stderr ? 'error' : '') : stderr,
    });
  }

  const percent = total > 0 ? Math.round((passedCount / total) * 100) : 0;
  const status: GradeResult['status'] =
    passedCount === total && total > 0 ? 'passed' : hadError && passedCount === 0 ? 'error' : 'failed';

  return { status, passedCount, totalCount: total, percent, results };
}
