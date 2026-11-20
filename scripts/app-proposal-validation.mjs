import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

// Checks an app proposal (contract C2) before it is posted to the Management App. The schema
// mirrors the Management App's shared app-proposal schema; the rules below are the playbook's:
// every value the proposal states has evidence (a file and the reason), and nothing in it is a
// secret value. The Management App checks the shape again and refuses the same mistakes.

export const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const schemaPath = resolve(repositoryRoot, 'skills/replatform/schemas/app-proposal.schema.json');
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validateSchema = ajv.compile(JSON.parse(readFileSync(schemaPath, 'utf8')));

const schemaError = (error) =>
  `${error.instancePath || '/'} ${error.message ?? 'does not satisfy the schema'}`;

// A screen for accidents, not a guarantee; the same shapes the Management App refuses.
const SECRET_PATTERNS = [
  /\bgh[pousr]_[A-Za-z0-9]{30,}/,
  /\bgithub_pat_[A-Za-z0-9_]{30,}/,
  /\bglpat-[\w-]{10,}/,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}/,
  /\bsk-(?:ant-api\d+-|proj-|svcacct-)?[A-Za-z0-9_-]{32,}/,
  /:\/\/[^\s/:@]+:[^\s/@]+@/,
  /\bBearer\s+(?=[A-Za-z0-9._~+/-]*\d)[A-Za-z0-9._~+/-]{20,}/i,
];
const looksLikeSecret = (value) => SECRET_PATTERNS.some((pattern) => pattern.test(value));

const strings = (proposal) => [
  ...proposal.notes,
  ...proposal.apps.flatMap((app) => [
    app.name,
    app.root,
    app.healthPath ?? '',
    ...app.settings.map((setting) => setting.name),
    ...app.evidence.flatMap((item) => [item.path, item.note]),
  ]),
];

const isSafeRelativePath = (path) => {
  const unix = path.replaceAll('\\', '/');
  return (
    unix.length > 0 &&
    !unix.startsWith('/') &&
    !/^[a-zA-Z]:\//.test(unix) &&
    !unix.split('/').some((part) => part === '..')
  );
};

/** Evidence the proposal must give for each value it states: the evidence field that covers it. */
const coverage = (app) => [
  { field: 'kind', accepts: ['kind', 'app'], stated: true },
  { field: 'port', accepts: ['port'], stated: app.port !== null },
  { field: 'healthPath', accepts: ['healthPath'], stated: app.healthPath !== null },
  { field: 'settings', accepts: ['settings'], stated: app.settings.length > 0 },
  { field: 'database', accepts: ['database'], stated: app.database },
  { field: 'ai', accepts: ['ai'], stated: app.ai },
];

/**
 * The problems of an agent app proposal, empty when it can be posted. Pass
 * `{ requireAgentSource: false }` to check a quick-scan proposal's shape and evidence.
 */
export function validateAppProposal(proposal, { requireAgentSource = true } = {}) {
  if (!validateSchema(proposal)) return validateSchema.errors.map(schemaError);
  const problems = [];
  if (requireAgentSource && proposal.source !== 'replatform-agent') {
    problems.push('source must be replatform-agent: the quick scan is the Management App’s, not the agent’s');
  }

  const names = new Set();
  const roots = new Set();
  proposal.apps.forEach((app, index) => {
    const where = `apps[${index}] (${app.name})`;
    if (names.has(app.name)) problems.push(`${where}: duplicate app name`);
    names.add(app.name);
    if (roots.has(app.root)) problems.push(`${where}: another app is already at root "${app.root}"`);
    roots.add(app.root);
    if (!isSafeRelativePath(app.root) && app.root !== '') {
      problems.push(`${where}: root must be a relative folder inside the package`);
    }
    const seen = new Set();
    for (const setting of app.settings) {
      if (seen.has(setting.name)) problems.push(`${where}: setting ${setting.name} is listed twice`);
      seen.add(setting.name);
      if (/[=\s]/.test(setting.name)) {
        problems.push(`${where}: setting names hold the name only, never "NAME=value"`);
      }
    }
    for (const rule of coverage(app)) {
      if (rule.stated && !app.evidence.some((item) => rule.accepts.includes(item.field))) {
        problems.push(`${where}: ${rule.field} has no evidence (a file and the reason)`);
      }
    }
    app.evidence.forEach((item, at) => {
      if (!isSafeRelativePath(item.path)) {
        problems.push(`${where}: evidence[${at}].path must be a file inside the package`);
      }
      if (!item.note.trim()) problems.push(`${where}: evidence[${at}].note must say why`);
    });
  });
  if (strings(proposal).some(looksLikeSecret)) {
    problems.push('the proposal holds a value that looks like a secret; give names and paths only');
  }
  return problems;
}

export function validateAppProposalFile(path, options) {
  let proposal;
  try {
    proposal = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    return { proposal: null, problems: [`could not read ${path}: ${error.message}`] };
  }
  return { proposal, problems: validateAppProposal(proposal, options) };
}
