// Sandbox mode for the replatform plugin: a run that a runner started inside a sandbox, with its
// context in files instead of MCP tools. Off by default; the manual route never touches this file.
//
//   node scripts/sandbox-mode.mjs preflight --sandbox --run-input <file>   (before the run)
//   node scripts/sandbox-mode.mjs result    --sandbox --run-input <file>   (after the last phase)
//
// The gate (`sandboxGate`) refuses unless all of these hold:
//   1. the mode is switched on explicitly: `--sandbox` or AIFACTORY_SANDBOX=1;
//   2. the runner's marker file exists, is a regular file owned by root, is not writable by group
//      or other, and names this run; and the process itself is not root;
//   3. the run input matches contracts/mgmt/run-input.schema.json and passes the code checks below
//      (sandbox mode, no customer source, a consistent C1, an intent this slice supports).
// The result builder also refuses a plan that carries an answer nobody gave (`ownerClaimProblems`):
// nobody is there to answer, so every question in the plan is an open one, except the ones the run
// input's `answers` (a resume run) answer, copied word for word with `answeredBy: "run-input"`.
// None of this authenticates anyone: SKILL.md is guidance, and the control is the runner running
// this gate and the validators (reference/sandbox-mode.md). The marker only proves that a trusted
// step, which the run user cannot imitate, started this run.
//
// Exit codes follow the orchestrator: 0 ok, 1 invalid, 2 usage, 3 refused. Output is one JSON line.

import { lstatSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { repositoryRoot, validateEngagementInput } from './engagement-input-validation.mjs';
import { validatePlan } from './plan-validation.mjs';

export const EXIT = { OK: 0, INVALID: 1, USAGE: 2, REFUSED: 3 };

const USAGE =
  'Usage: sandbox-mode.mjs preflight|result --sandbox --run-input <file> [--marker <file>] [--plan <file>] [--result <file>]';

export const DEFAULT_MARKER_PATH = '/etc/aifactory/sandbox-run.json';
export const DEFAULT_PLAN_PATH = '.aifactory/replatform-plan.json';
export const DEFAULT_RESULT_PATH = '.aifactory/sandbox-result.json';

/** A run that cannot go on asks at most this many questions, then stops. */
export const MAX_NEEDS_INPUT_QUESTIONS = 10;

/**
 * The questions this run may ask: the run input's `limits.maxQuestions` (the Management App's
 * default is 5), never more than ten. Zero: the run asks nothing and records gaps instead.
 */
export const questionLimit = (input) => {
  const limit = input?.limits?.maxQuestions;
  return Number.isInteger(limit) && limit >= 0 ? Math.min(limit, MAX_NEEDS_INPUT_QUESTIONS) : MAX_NEEDS_INPUT_QUESTIONS;
};

/** How a plan question records an answer that came in the run input's `answers`. */
export const RUN_INPUT_ANSWERED_BY = 'run-input';

/** The id of the question that asks for an open C1 field: `C1-<field>`, for example `C1-zone`. */
export const c1QuestionId = (field) => `C1-${field}`;

/** The run input's answers by question id; empty for a first run. */
export const runInputAnswers = (input) =>
  new Map((Array.isArray(input?.answers) ? input.answers : []).map((entry) => [entry.id, entry.answer]));

/** Customer code is not allowed yet. Everything else, including a missing class, is refused. */
export const ALLOWED_SOURCE_CLASSES = ['synthetic', 'internal'];

/**
 * The intents a sandbox run may name. `null` means supported; a string is the reason it is refused.
 * The Phase 4 slice flips `rebuild` and `security-only` here and nowhere else.
 */
export const PHASE_4_REASON = 'not supported until the Phase 4 slice';
export const INTENT_SUPPORT = {
  assess: null,
  plan: null,
  rebuild: PHASE_4_REASON,
  'security-only': PHASE_4_REASON,
};

/** The plan status a run that reached the end of its intent leaves behind. Never `approved`. */
const COMPLETED_PLAN_STATUS = { assess: 'draft', plan: 'awaiting-approval' };
const PLAN_STATUSES_WHILE_NEEDING_INPUT = ['draft', 'questions'];

const MAX_INPUT_BYTES = 1024 * 1024;
const MAX_MARKER_BYTES = 4096;
const MAX_SCHEMA_MESSAGES = 10;

/** Every refusal code and whether it is a refusal (exit 3) or an invalid input (exit 1). */
export const CODES = {
  'marker-missing': 'refused',
  'marker-unreadable': 'refused',
  'marker-not-regular-file': 'refused',
  'marker-not-root-owned': 'refused',
  'marker-writable': 'refused',
  'marker-invalid': 'refused',
  'marker-run-mismatch': 'refused',
  'process-is-root': 'refused',
  'platform-unsupported': 'refused',
  'mode-not-sandbox': 'refused',
  'source-class-customer': 'refused',
  'source-class-not-allowed': 'refused',
  'intent-unsupported': 'refused',
  'input-unreadable': 'invalid',
  'input-invalid': 'invalid',
  'engagement-mismatch': 'invalid',
  'engagement-input-inconsistent': 'invalid',
  'source-hash-mismatch': 'invalid',
  'plan-unreadable': 'invalid',
  'plan-invalid': 'invalid',
  'plan-source-mismatch': 'invalid',
  'plan-status-not-allowed': 'invalid',
  'plan-status-inconsistent': 'invalid',
  'plan-owner-answer': 'invalid',
  'duplicate-question-id': 'invalid',
  'too-many-questions': 'invalid',
  'no-question-for-open-input': 'invalid',
  'result-invalid': 'invalid',
};

const refusal = (code, message) => {
  if (!(code in CODES)) throw new Error(`unknown sandbox refusal code ${code}`);
  return { code, kind: CODES[code], message };
};

/** The exit code for a list of refusals: any refusal beats an invalid input. */
export const exitCodeFor = (refusals) =>
  refusals.length === 0 ? EXIT.OK : refusals.some((item) => item.kind === 'refused') ? EXIT.REFUSED : EXIT.INVALID;

/** Switched on only by `--sandbox` or AIFACTORY_SANDBOX=1; any other value of the variable is off. */
export const sandboxEnabled = ({ flag = false, env = process.env } = {}) => flag === true || env.AIFACTORY_SANDBOX === '1';

const readJsonFile = (path, readFile = readFileSync) => {
  const text = readFile(path, 'utf8');
  if (text.length > MAX_INPUT_BYTES) throw new Error('the file is larger than 1 MiB');
  return JSON.parse(text);
};

// ---- The marker --------------------------------------------------------------------------------

const systemCalls = () => ({
  lstat: (path) => lstatSync(path),
  getuid: () => (typeof process.getuid === 'function' ? process.getuid() : undefined),
  platform: process.platform,
  readFile: readFileSync,
});

const UUID_TEXT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Checks the runner's marker. It uses lstat, so a symlink is seen as a symlink. Refuses when the
 * file is missing, is not a regular file, is not owned by root, can be written by group or other,
 * when this process is root (it could have written the marker itself), and on win32, where
 * ownership cannot be verified. `sys` replaces lstat, getuid, platform and readFile in tests.
 * Returns { refusals, marker }; marker is the parsed { schemaVersion, runId } when it passes.
 */
export function checkMarker(path, sys = {}) {
  const { lstat, getuid, platform, readFile } = { ...systemCalls(), ...sys };
  let stat;
  try {
    stat = lstat(path);
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') {
      return { refusals: [refusal('marker-missing', `the sandbox marker ${path} does not exist`)] };
    }
    return { refusals: [refusal('marker-unreadable', `the sandbox marker ${path} could not be inspected (${error?.code ?? 'error'})`)] };
  }
  if (!stat) return { refusals: [refusal('marker-missing', `the sandbox marker ${path} does not exist`)] };
  if (platform === 'win32') {
    return { refusals: [refusal('platform-unsupported', 'file ownership cannot be verified on this platform; sandbox mode runs on Linux only')] };
  }
  if (typeof stat.isSymbolicLink === 'function' && stat.isSymbolicLink()) {
    return { refusals: [refusal('marker-not-regular-file', `the sandbox marker ${path} is a symbolic link`)] };
  }
  if (typeof stat.isFile !== 'function' || !stat.isFile()) {
    return { refusals: [refusal('marker-not-regular-file', `the sandbox marker ${path} is not a regular file`)] };
  }
  if (stat.uid !== 0) {
    return { refusals: [refusal('marker-not-root-owned', `the sandbox marker ${path} is not owned by root`)] };
  }
  if (typeof stat.mode !== 'number' || (stat.mode & 0o022) !== 0) {
    return { refusals: [refusal('marker-writable', `the sandbox marker ${path} can be written by group or other`)] };
  }
  const uid = getuid();
  if (typeof uid !== 'number') {
    return { refusals: [refusal('platform-unsupported', 'the process owner cannot be determined')] };
  }
  if (uid === 0) {
    return { refusals: [refusal('process-is-root', 'sandbox mode must not run as root: root could have written the marker itself')] };
  }
  if (typeof stat.size === 'number' && stat.size > MAX_MARKER_BYTES) {
    return { refusals: [refusal('marker-invalid', `the sandbox marker ${path} is larger than ${MAX_MARKER_BYTES} bytes`)] };
  }
  let marker;
  try {
    marker = JSON.parse(readFile(path, 'utf8'));
  } catch {
    return { refusals: [refusal('marker-invalid', `the sandbox marker ${path} is not JSON`)] };
  }
  const keys = marker && typeof marker === 'object' && !Array.isArray(marker) ? Object.keys(marker).sort().join() : '';
  if (keys !== 'runId,schemaVersion' || marker.schemaVersion !== 1 || typeof marker.runId !== 'string' || !UUID_TEXT.test(marker.runId)) {
    return { refusals: [refusal('marker-invalid', 'the sandbox marker must be { "schemaVersion": 1, "runId": "<uuid>" } and nothing else')] };
  }
  return { refusals: [], marker };
}

/** The marker must name the run it guards: a stray root-owned file from another run cannot pass. */
export function bindMarkerToRun(marker, runInput) {
  const runId = typeof runInput?.runId === 'string' ? runInput.runId.toLowerCase() : undefined;
  if (runId !== marker.runId.toLowerCase()) {
    return [refusal('marker-run-mismatch', 'the sandbox marker names a different run than the run input')];
  }
  return [];
}

// ---- The run input -----------------------------------------------------------------------------

let compiledRunInput;
let compiledResult;
const compile = (relativePath) => {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(JSON.parse(readFileSync(resolve(repositoryRoot, relativePath), 'utf8')));
};
const runInputValidator = () => (compiledRunInput ??= compile('contracts/mgmt/run-input.schema.json'));
const resultValidator = () => (compiledResult ??= compile('skills/replatform/schemas/sandbox-result.schema.json'));

const schemaMessages = (errors) => {
  const messages = errors.map((error) => `${error.instancePath || '/'} ${error.message ?? 'does not satisfy the schema'}`);
  const shown = [...new Set(messages)].slice(0, MAX_SCHEMA_MESSAGES);
  return messages.length > shown.length ? [...shown, `(and ${messages.length - shown.length} more)`] : shown;
};

/**
 * The refusals for a parsed run input; empty when a sandbox run may start from it. Never echoes a
 * value from the input, only field paths. The policy checks look at the raw document, so a missing
 * or odd class is refused even when the schema also fails.
 */
export function checkRunInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return [refusal('input-invalid', 'the run input must be a JSON object')];
  }
  const refusals = [];
  if (input.mode !== 'sandbox') {
    refusals.push(refusal('mode-not-sandbox', 'the run input is not for a sandbox run (mode must be "sandbox")'));
  }
  const sourceClass = input.source?.class;
  if (sourceClass === 'customer') {
    refusals.push(refusal('source-class-customer', 'customer source code is not allowed in the sandbox yet'));
  } else if (!ALLOWED_SOURCE_CLASSES.includes(sourceClass)) {
    refusals.push(refusal('source-class-not-allowed', `source.class must be one of ${ALLOWED_SOURCE_CLASSES.join(', ')}; a missing or unknown class is refused`));
  }
  if (typeof input.intent === 'string' && Object.hasOwn(INTENT_SUPPORT, input.intent) && INTENT_SUPPORT[input.intent]) {
    refusals.push(refusal('intent-unsupported', `intent ${input.intent} is refused: ${INTENT_SUPPORT[input.intent]}`));
  }
  const validate = runInputValidator();
  if (!validate(input)) {
    for (const message of schemaMessages(validate.errors)) refusals.push(refusal('input-invalid', message));
    return refusals;
  }
  if ((input.engagementId === null) !== (input.engagement === null)) {
    refusals.push(refusal('engagement-mismatch', 'engagement must be null exactly when engagementId is null'));
  }
  const roles = (input.prerequisiteRoles ?? []).map((entry) => entry.role);
  if (new Set(roles).size !== roles.length) {
    refusals.push(refusal('input-invalid', '/prerequisiteRoles lists a role twice'));
  }
  for (const problem of validateEngagementInput(input.engagementInput)) {
    refusals.push(refusal('engagement-input-inconsistent', `engagementInput: ${problem}`));
  }
  const held = input.engagementInput.source;
  if (held && held.sha256 !== input.source.sha256) {
    refusals.push(refusal('source-hash-mismatch', 'engagementInput.source.sha256 differs from source.sha256: the Wizard holds a different upload'));
  }
  return refusals;
}

/** The C1 fields still open for the run: C1's `missing`, leaving out `source`, which the run holds. */
export const openInputFields = (input) => input.engagementInput.missing.filter((field) => field !== 'source');

/**
 * The open C1 fields that no answer settles: a resume run's answer to `C1-<field>` settles that
 * field for this run, although C1 lists it until a person saves it in the Wizard.
 */
export const unsettledInputFields = (input) => {
  const answers = runInputAnswers(input);
  return openInputFields(input).filter((field) => !answers.has(c1QuestionId(field)));
};

/**
 * The full gate before a sandbox run: marker, then run input. `markerPath` and `runInputPath` are
 * files; `sys` replaces the system calls in tests. Returns { ok, refusals, marker, input }.
 */
export function sandboxGate({ markerPath = DEFAULT_MARKER_PATH, runInputPath, sys = {} }) {
  const checked = checkMarkerForRun({ markerPath, runInputPath, sys });
  if (checked.refusals.length) return { ok: false, refusals: checked.refusals };
  const refusals = checkRunInput(checked.input);
  return { ok: refusals.length === 0, refusals, marker: checked.marker, input: checked.input };
}

/**
 * The marker check, and when a run input file is given, its binding to that file's runId. The
 * validators use this with the optional run input; `sandboxGate` always has one.
 */
export function checkMarkerForRun({ markerPath = DEFAULT_MARKER_PATH, runInputPath, sys = {} }) {
  const checked = checkMarker(markerPath, sys);
  if (checked.refusals.length) return checked;
  if (!runInputPath) return checked;
  let input;
  try {
    input = readJsonFile(runInputPath, sys.readFile);
  } catch (error) {
    return { refusals: [refusal('input-unreadable', `the run input could not be read: ${error.message}`)] };
  }
  return { refusals: bindMarkerToRun(checked.marker, input), marker: checked.marker, input };
}

const VALIDATOR_OPTIONS = {
  sandbox: { type: 'boolean' },
  marker: { type: 'string' },
  'run-input': { type: 'string' },
};

/**
 * The command line of validate-plan and validate-implementation, parsed the same strict way by
 * both. An option that is ignored (`--sandbox=true`, a misspelt `--sandbx`) would leave the marker
 * unchecked while the run looks gated, so an unknown option, a value on `--sandbox` and a missing
 * value all throw (the validator exits 2). Extra positional arguments are the caller's business,
 * but one that starts with `-` can only have come after a `--` and is refused too.
 */
export function parseValidatorArgs(args) {
  const parsed = parseArgs({ args, allowPositionals: true, options: VALIDATOR_OPTIONS });
  const stray = parsed.positionals.find((value) => value.startsWith('-'));
  if (stray !== undefined) throw new Error(`Unexpected argument '${stray}': options go before the plan path, and none follows a --`);
  return parsed;
}

/**
 * What validate-plan and validate-implementation call. Sandbox mode off: undefined, and the
 * validator behaves exactly as it always did. On: the marker check (bound to the run when a run
 * input file is given); a non-empty list means the validator must refuse with exit 3.
 */
export function validatorGate({ sandbox = false, marker, runInput, env = process.env, cwd = process.cwd(), sys } = {}) {
  if (!sandboxEnabled({ flag: sandbox === true, env })) return undefined;
  const text = (value) => (typeof value === 'string' && value ? value : undefined);
  const runInputPath = text(runInput) ?? text(env.AIFACTORY_RUN_INPUT);
  return checkMarkerForRun({
    markerPath: resolve(cwd, text(marker) ?? text(env.AIFACTORY_SANDBOX_MARKER) ?? DEFAULT_MARKER_PATH),
    runInputPath: runInputPath && resolve(cwd, runInputPath),
    sys,
  }).refusals;
}

// ---- Nobody answers ----------------------------------------------------------------------------

const asList = (value) => (Array.isArray(value) ? value : []);
const isOwnerReference = (id) => typeof id === 'string' && id.startsWith('owner:');

/** True when a plan question carries exactly the answer the run input gave for its id. */
const carriesRunInputAnswer = (question, answers) =>
  answers.has(question.id) && question.answer === answers.get(question.id) && question.answeredBy === RUN_INPUT_ANSWERED_BY;

/**
 * The premise of a sandbox run is that nobody is there to answer. The only answers are the ones the
 * run input carries (`answers`, on a run that resumes a needs-input run). So a plan question may
 * carry `answer` and `answeredBy` only when the run input answered its id, with that answer word for
 * word and `answeredBy: "run-input"`; and a risk answer may have the source `owner` or cite
 * `owner:<question-id>` only when every such id is one of those questions. Anything else was written
 * by the plan author, and plan validation would accept it as an owner's. Pure; tolerant of a
 * malformed plan (validatePlan reports that); messages name a position, never a value from the plan.
 */
export function ownerClaimProblems(plan, runInput) {
  const answers = runInputAnswers(runInput);
  const problems = [];
  const answered = new Set();
  for (const [index, question] of asList(plan?.questions).entries()) {
    if (question && typeof question === 'object' && (Object.hasOwn(question, 'answer') || Object.hasOwn(question, 'answeredBy'))) {
      if (carriesRunInputAnswer(question, answers)) answered.add(question.id);
      else problems.push(`questions[${index}] carries an answer or answeredBy the run input did not give: only an answer from the run input's answers, word for word with answeredBy run-input, may be recorded`);
    }
  }
  for (const [index, entry] of asList(plan?.risk?.answers).entries()) {
    const owners = asList(entry?.evidence).filter(isOwnerReference);
    const backed = owners.length > 0 && owners.every((id) => answered.has(id.slice('owner:'.length)));
    if ((entry?.source === 'owner' || owners.length > 0) && !backed) {
      problems.push(`risk.answers[${index}] names an owner (source owner or owner:<question-id> evidence) that the run input did not answer; answer from the code or leave it unknown`);
    }
  }
  return problems;
}

/** The plan questions still open: the ones without an answer. */
const openQuestions = (plan) => asList(plan?.questions).filter((question) => !Object.hasOwn(question ?? {}, 'answer'));

// ---- Resume ------------------------------------------------------------------------------------

/** Validates a result against the result schema; the problems, empty when it is well formed. */
export function validateResult(result) {
  const validate = resultValidator();
  return validate(result) ? [] : schemaMessages(validate.errors);
}

/**
 * Where a second run starts. Pure. It skips Phase 1 (`from: 'classify'`) only when the plan on
 * disk validates with status `questions` AND the previous result file is a valid needs-input
 * result for the same engagement and the same source.sha256. Anything else starts fresh
 * (`from: 'discover'`): a run never resumes over a different source or someone else's plan, and
 * never over a plan that carries answers nobody gave.
 */
export function lastGoodStep({ plan, previousResult, runInput }) {
  const fresh = (reason) => ({ from: 'discover', reason });
  if (!plan) return fresh('there is no plan from an earlier run');
  if (validatePlan(plan).length) return fresh('the plan on disk does not validate');
  if (ownerClaimProblems(plan, runInput).length) return fresh('the plan on disk holds answers or owner references that nobody gave in this run input');
  if (plan.status !== 'questions') return fresh('the plan on disk is not waiting for answers');
  if (!previousResult) return fresh('there is no result file from an earlier run');
  if (validateResult(previousResult).length) return fresh('the earlier result file does not validate');
  if (previousResult.status !== 'needs-input') return fresh('the earlier run did not end needs-input');
  if (previousResult.source.sha256 !== runInput.source.sha256) return fresh('the earlier run was over a different source');
  if (previousResult.engagementId !== runInput.engagementId) return fresh('the earlier run belonged to a different engagement');
  return { from: 'classify', reason: 'the plan holds the Phase 1 evidence and the earlier run ended needs-input over the same source' };
}

// ---- The result --------------------------------------------------------------------------------

/**
 * Builds the result from the run input and the plan; deterministic, nothing from the model but the
 * plan's open questions. A question may carry an answer only when the run input gave it
 * (`ownerClaimProblems`); answered questions are not asked again and do not count. Returns
 * { result } or { refusals }. needs-input applies when C1 leaves a field open that no answer
 * settles (not counting `source`) and the run may ask, or the plan is at `questions` with open
 * questions. It never truncates: more open questions than `questionLimit`, or an open C1 without
 * a question while the run may ask, is invalid. With a limit of zero the run asks nothing: an open
 * C1 field is a gap the plan records, not a question.
 */
export function buildResult({ runInput, plan }) {
  const fail = (code, message) => ({ refusals: [refusal(code, message)] });
  const claims = ownerClaimProblems(plan, runInput);
  if (claims.length) {
    return { refusals: claims.slice(0, MAX_SCHEMA_MESSAGES).map((claim) => refusal('plan-owner-answer', `plan: ${claim}`)) };
  }
  const problems = validatePlan(plan);
  if (problems.length) {
    return { refusals: problems.slice(0, MAX_SCHEMA_MESSAGES).map((problem) => refusal('plan-invalid', `plan: ${problem}`)) };
  }
  if (plan.intake.packageSha256 !== runInput.source.sha256) {
    return fail('plan-source-mismatch', 'plan intake.packageSha256 must equal the run input source.sha256: the plan is about another source');
  }
  const ids = plan.questions.map((question) => question.id);
  if (new Set(ids).size !== ids.length) return fail('duplicate-question-id', 'two plan questions share an id');
  const questions = openQuestions(plan);
  const limit = questionLimit(runInput);
  if (questions.length > limit) {
    return fail('too-many-questions', `${questions.length} open questions; this run's limit is ${limit}. Ask the open C1 fields first, then the highest-impact risk questions, and record the rest as assumptions or gaps`);
  }
  const open = limit > 0 ? unsettledInputFields(runInput) : [];
  if (open.length > 0 && questions.length === 0) {
    return fail('no-question-for-open-input', `C1 leaves ${open.join(', ')} open but the plan holds no open question`);
  }
  const needsInput = open.length > 0 || (plan.status === 'questions' && questions.length > 0);
  if (needsInput && !PLAN_STATUSES_WHILE_NEEDING_INPUT.includes(plan.status)) {
    return fail('plan-status-not-allowed', `plan status ${plan.status} cannot end a run that needs input; it must be draft or questions`);
  }
  if (!needsInput) {
    if (plan.status === 'questions') {
      return fail('plan-status-inconsistent', 'the plan waits for answers (questions) but holds no question');
    }
    if (plan.status !== COMPLETED_PLAN_STATUS[runInput.intent]) {
      return fail('plan-status-not-allowed', `a completed ${runInput.intent} run leaves the plan at ${COMPLETED_PLAN_STATUS[runInput.intent]}, not ${plan.status}; an approval is never the agent's`);
    }
  }
  const result = {
    schemaVersion: 1,
    runId: runInput.runId,
    engagementId: runInput.engagementId,
    status: needsInput ? 'needs-input' : 'completed',
    step: needsInput ? 'assess' : runInput.intent,
    intent: runInput.intent,
    source: { sha256: runInput.source.sha256 },
    policy: {
      snapshotId: runInput.policy.snapshotId,
      version: runInput.policy.version,
      sha256: runInput.policy.sha256,
    },
    questions: questions.map(({ id, text, why, options }) => (options ? { id, text, why, options } : { id, text, why })),
  };
  const invalid = validateResult(result);
  if (invalid.length) return { refusals: invalid.map((problem) => refusal('result-invalid', `result: ${problem}`)) };
  return { result };
}

/** Writes the result next to the plan: a temporary file in the same folder, then a rename. */
export function writeResult(path, result) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  try {
    writeFileSync(temporary, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
    renameSync(temporary, path);
  } finally {
    rmSync(temporary, { force: true });
  }
}

// ---- Command line ------------------------------------------------------------------------------

const readOptional = (path) => {
  try {
    return { value: readJsonFile(path) };
  } catch (error) {
    return error?.code === 'ENOENT' ? { value: undefined } : { error };
  }
};

/**
 * Runs the command line and returns the exit code. `io.stdout` and `io.stderr` take strings;
 * `sys` replaces the system calls the marker check makes. Tests call this instead of spawning.
 */
export function main(argv, { env = process.env, cwd = process.cwd(), stdout, stderr, sys } = {}) {
  const out = (value) => stdout(`${JSON.stringify(value)}\n`);
  const usage = (message) => {
    stderr(`${message}\n`);
    return EXIT.USAGE;
  };
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        sandbox: { type: 'boolean', default: false },
        marker: { type: 'string' },
        'run-input': { type: 'string' },
        plan: { type: 'string' },
        result: { type: 'string' },
      },
    });
  } catch (error) {
    return usage(`${error.message}\n${USAGE}`);
  }
  const { values, positionals } = parsed;
  if (!sandboxEnabled({ flag: values.sandbox, env })) {
    return usage('sandbox mode is off: pass --sandbox or set AIFACTORY_SANDBOX=1');
  }
  const [command, ...extra] = positionals;
  if (!['preflight', 'result'].includes(command) || extra.length) {
    return usage(USAGE);
  }
  const runInputPath = values['run-input'] ?? env.AIFACTORY_RUN_INPUT;
  if (!runInputPath) return usage('--run-input <file> (or AIFACTORY_RUN_INPUT) is required');

  const gate = sandboxGate({
    markerPath: resolve(cwd, values.marker ?? env.AIFACTORY_SANDBOX_MARKER ?? DEFAULT_MARKER_PATH),
    runInputPath: resolve(cwd, runInputPath),
    sys,
  });
  const finish = (refusals) => {
    out({ ok: false, refusals: refusals.map(({ code, message }) => ({ code, message })) });
    return exitCodeFor(refusals);
  };
  if (!gate.ok) return finish(gate.refusals);

  const planPath = resolve(cwd, values.plan ?? DEFAULT_PLAN_PATH);
  const resultPath = resolve(cwd, values.result ?? env.AIFACTORY_RUN_RESULT ?? DEFAULT_RESULT_PATH);
  const plan = readOptional(planPath);

  if (command === 'preflight') {
    const previous = readOptional(resultPath);
    out({
      ok: true,
      runId: gate.input.runId,
      engagementId: gate.input.engagementId,
      intent: gate.input.intent,
      sourceClass: gate.input.source.class,
      source: { sha256: gate.input.source.sha256 },
      openFields: unsettledInputFields(gate.input),
      maxQuestions: questionLimit(gate.input),
      answers: [...runInputAnswers(gate.input).keys()],
      resume: lastGoodStep({ plan: plan.value, previousResult: previous.value, runInput: gate.input }),
    });
    return EXIT.OK;
  }

  if (plan.error || plan.value === undefined) {
    return finish([refusal('plan-unreadable', `the plan ${planPath} could not be read`)]);
  }
  const built = buildResult({ runInput: gate.input, plan: plan.value });
  if (built.refusals) return finish(built.refusals);
  writeResult(resultPath, built.result);
  out({
    ok: true,
    status: built.result.status,
    step: built.result.step,
    questions: built.result.questions.length,
    result: resultPath,
  });
  return EXIT.OK;
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMainModule) {
  process.exitCode = main(process.argv.slice(2), {
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text),
  });
}
