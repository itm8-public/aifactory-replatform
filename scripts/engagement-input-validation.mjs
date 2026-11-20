import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

// Checks an engagement input (contract C1) and the questions asked against it. The schema mirrors
// the Management App's shared engagement-input schema. The agent reads C1 first
// and asks the owner only for what `missing` lists.

export const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const schemaPath = resolve(repositoryRoot, 'skills/replatform/schemas/engagement-input.schema.json');
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validateSchema = ajv.compile(JSON.parse(readFileSync(schemaPath, 'utf8')));

const schemaError = (error) =>
  `${error.instancePath || '/'} ${error.message ?? 'does not satisfy the schema'}`;

/** The fields a person can leave open, in the order the Management App lists them. */
export const ENGAGEMENT_INPUT_FIELDS = [
  'tenantId',
  'zone',
  'region',
  'archetype',
  'connectivity',
  'audience',
  'environments',
  'source',
];

const isOpen = {
  tenantId: (input) => !input.tenantId,
  zone: (input) => !input.zone,
  region: (input) => !input.region,
  archetype: (input) => !input.archetype,
  connectivity: (input) => !input.connectivity,
  audience: (input) => !input.audience,
  environments: (input) => input.environments.length === 0,
  source: (input) => !input.source,
};

/** The answers an input leaves open, computed from its own fields. */
export const openFields = (input) => ENGAGEMENT_INPUT_FIELDS.filter((field) => isOpen[field](input));

/** The problems of an engagement input, empty when it is well formed and consistent. */
export function validateEngagementInput(input) {
  if (!validateSchema(input)) return validateSchema.errors.map(schemaError);
  const problems = [];
  const expected = openFields(input);
  if (JSON.stringify(input.missing) !== JSON.stringify(expected)) {
    problems.push(
      `missing is [${input.missing.join(', ')}] but the fields leave [${expected.join(', ')}] open`,
    );
  }
  if (!input.specification) {
    for (const field of ['tenantId', 'zone', 'region', 'archetype', 'connectivity', 'audience']) {
      if (input[field]) problems.push(`${field} is set but no specification holds the answers`);
    }
    if (input.environments.length > 0) problems.push('environments are set but no specification holds the answers');
  }
  return problems;
}

/**
 * The fields the agent may ask the owner about, among those it plans to ask: only the ones C1
 * leaves open. Returns the fields it must not ask again, because C1 already holds the answer.
 */
export function repeatedQuestionFields(input, questionFields) {
  const open = new Set(input.missing);
  return questionFields.filter((field) => !open.has(field));
}

export function validateEngagementInputFile(path) {
  let input;
  try {
    input = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    return { input: null, problems: [`could not read ${path}: ${error.message}`] };
  }
  return { input, problems: validateEngagementInput(input) };
}
