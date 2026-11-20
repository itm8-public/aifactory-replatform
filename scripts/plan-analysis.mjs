import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { validatePlan, validatePlanFile } from './plan-validation.mjs';

const redAnswers = ['q2', 'q3', 'q4', 'q5', 'a2'];
const norm = (value) => value.split(String.fromCharCode(92)).join('/').replace(/^\.\//, '').replace(/\/+$/, '').toLowerCase();
const covers = (outer, inner) => inner === outer || inner.startsWith(`${outer}/`);

// Read-only consistency report across the plan's parts. CRITICAL stops the run; WARN goes in the PR.
export const analyzePlan = (plan) => {
  const findings = [];
  const add = (severity, code, message) => findings.push({ severity, code, message });

  for (const problem of validatePlan(plan)) add('CRITICAL', 'plan-invalid', problem);

  const text = JSON.stringify(plan);
  const markers = text.match(/\[NEEDS CLARIFICATION[^\]]*\]/g) ?? [];
  if (markers.length) {
    add('CRITICAL', 'open-clarification', `${markers.length} [NEEDS CLARIFICATION] marker(s) remain: ${markers[0]}`);
  }

  const changes = plan.appChanges ?? [];
  const changePaths = changes.map((change) => norm(change.path));
  for (const allowed of plan.allowedPaths ?? []) {
    const path = norm(allowed);
    if (path.startsWith('.aifactory')) continue;
    if (!changePaths.some((changePath) => covers(path, changePath) || covers(changePath, path))) {
      add('WARN', 'unused-allowed-path', `allowedPaths ${allowed} has no appChanges item; narrow it`);
    }
  }
  const usedFields = new Set(changes.map((change) => change.targetSpecField));
  for (const delta of plan.assessment?.draft?.targetSpecDelta ?? []) {
    if (!usedFields.has(delta.field)) {
      add('WARN', 'target-field-without-change', `targetSpecDelta ${delta.field} has no appChanges item (platform gap or a Wizard-side change?)`);
    }
  }
  for (const change of changes) {
    if (!change.evidence?.length) add('WARN', 'change-without-evidence', `${change.planItemId ?? change.path} has no evidence; call it an inference in the PR`);
  }
  for (const finding of plan.assessment?.draft?.findings ?? []) {
    if (!finding.evidence?.length) add('WARN', 'finding-without-evidence', `${finding.id} has no evidence; keep it as an inference or open question`);
  }
  for (const question of plan.questions ?? []) {
    if (!question.answer?.trim()) add('WARN', 'unanswered-question', `${question.id} is unanswered`);
  }

  const yes = (id) => plan.risk?.answers?.some((answer) => answer.id === id && answer.answer === 'yes');
  const redBecause = redAnswers.filter(yes);
  if (redBecause.length && plan.risk.suggestedZone !== 'red') {
    add('WARN', 'red-recommended', `${redBecause.join(', ')} answered yes but the suggested zone is ${plan.risk.suggestedZone}; state why in the PR`);
  }
  if (yes('a1')) add('CRITICAL', 'prohibited-ai', 'a1 answered yes: a prohibited AI practice; stop');

  if (!plan.compatibilityBoundaries?.length) {
    add('INFO', 'no-compatibility-boundaries', 'no compatibilityBoundaries listed; say what must not change');
  }
  return findings;
};

const gitLines = (root, args) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    .split(/\r?\n/)
    .filter(Boolean);

// Plan items whose path has no change in the working tree: what implementation still has to do.
export const unmetPlanItems = (plan, root) => {
  const changed = [
    ...gitLines(root, ['diff', '--name-only', '--no-renames', 'HEAD', '--']),
    ...gitLines(root, ['ls-files', '--others', '--exclude-standard']),
  ].map(norm);
  return (plan.appChanges ?? []).filter((change) => {
    const path = norm(change.path);
    return !changed.some((file) => covers(path, file));
  });
};

const render = (findings) => findings.map((finding) => `${finding.severity} ${finding.code}: ${finding.message}`).join('\n');

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMainModule) {
  const [mode, planArgument, extra] = process.argv.slice(2);
  if (!['analyze', 'converge'].includes(mode) || !planArgument || extra) {
    console.error('Usage: node scripts/plan-analysis.mjs analyze|converge <plan.json>');
    process.exit(2);
  }
  const loaded = validatePlanFile(resolve(planArgument));
  if (!loaded.plan) {
    console.error(loaded.problems.join('\n'));
    process.exit(1);
  }
  if (mode === 'analyze') {
    const findings = analyzePlan(loaded.plan);
    console.log(findings.length ? render(findings) : 'No findings.');
    process.exit(findings.some((finding) => finding.severity === 'CRITICAL') ? 1 : 0);
  }
  const unmet = unmetPlanItems(loaded.plan, process.cwd());
  if (!unmet.length) console.log('Every plan item has a change in the working tree.');
  else {
    console.log('Plan items with no change yet (do them, or say in the PR why not):');
    for (const change of unmet) console.log(`- ${change.planItemId} ${change.path}: ${change.reason}`);
  }
}
