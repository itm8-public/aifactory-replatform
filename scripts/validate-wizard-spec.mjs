import { resolve } from 'node:path';
import { validateWizardSpecFile } from './wizard-spec-validation.mjs';

const [file] = process.argv.slice(2);
if (!file || process.argv.slice(2).length !== 1) {
  console.error('Usage: npm run validate-wizard-spec -- <path-to-ai-factory.json>');
  process.exit(64);
}

const path = resolve(file);
const result = validateWizardSpecFile(path);
for (const error of result.errors) console.error(`ERROR: ${error}`);
for (const blocker of result.blockers) console.error(`BLOCKER: ${blocker}`);
for (const warning of result.warnings) console.warn(`WARNING ${warning.code}: ${warning.message}`);

if (result.errors.length) process.exit(1);
if (result.blockers.length) process.exit(2);
console.log(`${path} passes structural and semantic Wizard-spec validation`);