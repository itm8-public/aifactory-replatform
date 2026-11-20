import { resolve } from 'node:path';
import { validatePlan, validatePlanFile } from './plan-validation.mjs';
import { EXIT, parseValidatorArgs, validatorGate } from './sandbox-mode.mjs';

// Strict about options, so a misspelt `--sandbox` cannot silently skip the marker check; extra
// positional arguments are still ignored, as the manual route has always done.
const usage = (message) => {
  if (message) console.error(message);
  console.error('Usage: npm run validate-plan -- [--sandbox [--marker <file>] [--run-input <file>]] <path-to-replatform-plan.json>');
  process.exit(EXIT.USAGE);
};
let parsed;
try {
  parsed = parseValidatorArgs(process.argv.slice(2));
} catch (error) {
  usage(error.message);
}
const { values, positionals } = parsed;

const [file] = positionals;
if (!file) usage();

// Sandbox mode (--sandbox or AIFACTORY_SANDBOX=1): the runner's marker must check out first.
const refusals = validatorGate({ sandbox: values.sandbox, marker: values.marker, runInput: values['run-input'] });
if (refusals?.length) {
  console.log(JSON.stringify({ ok: false, refusals: refusals.map(({ code, message }) => ({ code, message })) }));
  process.exit(EXIT.REFUSED);
}

const path = resolve(file);
const loaded = validatePlanFile(path);
const problems = loaded.plan ? validatePlan(loaded.plan) : loaded.problems;

if (problems.length) {
  console.error(`${path} is not a valid AI Factory replatform plan:`);
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}

console.log(`${path} is valid`);
