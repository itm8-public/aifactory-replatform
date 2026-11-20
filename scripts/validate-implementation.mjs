import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateImplementationDiff, validatePlanFile } from './plan-validation.mjs';
import { EXIT, parseValidatorArgs, validatorGate } from './sandbox-mode.mjs';

const gitLines = (root, args) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    .split(/\r?\n/)
    .filter(Boolean);

// Compares what changed in the working tree since HEAD with the plan's allowedPaths and plan items.
export const validateImplementation = ({ repositoryDirectory = process.cwd(), planPath } = {}) => {
  if (!planPath) return ['plan path is required'];
  const root = resolve(repositoryDirectory);
  const loaded = validatePlanFile(resolve(root, planPath));
  if (!loaded.plan) return loaded.problems;
  try {
    const changedPaths = [
      ...new Set([
        ...gitLines(root, ['diff', '--name-only', '--no-renames', 'HEAD', '--']),
        ...gitLines(root, ['ls-files', '--others', '--exclude-standard']),
      ]),
    ];
    return validateImplementationDiff(loaded.plan, changedPaths);
  } catch (error) {
    return [`implementation preflight could not complete: ${error.message}`];
  }
};

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMainModule) {
  const usage = () => {
    console.error(
      'Usage: node scripts/validate-implementation.mjs [--sandbox [--marker <file>] [--run-input <file>]] <plan.json>',
    );
    process.exit(2);
  };
  let parsed;
  try {
    parsed = parseValidatorArgs(process.argv.slice(2));
  } catch {
    usage();
  }
  const { values, positionals } = parsed;
  if (positionals.length !== 1) usage();
  // Sandbox mode (--sandbox or AIFACTORY_SANDBOX=1): the runner's marker must check out first.
  const refusals = validatorGate({ sandbox: values.sandbox, marker: values.marker, runInput: values['run-input'] });
  if (refusals?.length) {
    console.log(JSON.stringify({ ok: false, refusals: refusals.map(({ code, message }) => ({ code, message })) }));
    process.exit(EXIT.REFUSED);
  }
  const problems = validateImplementation({ planPath: positionals[0] });
  if (problems.length) {
    console.error('Implementation scope is not valid:');
    for (const problem of problems) console.error(`- ${problem}`);
    process.exit(1);
  }
  console.log('Target-spec and application-path checks passed.');
}
