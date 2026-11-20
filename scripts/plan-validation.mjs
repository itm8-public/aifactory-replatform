import { readFileSync } from 'node:fs';
import { dirname, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { validateAppProposal } from './app-proposal-validation.mjs';

export const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const schemaPath = resolve(repositoryRoot, 'skills/replatform/schemas/replatform-plan.schema.json');
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validateSchema = ajv.compile(JSON.parse(readFileSync(schemaPath, 'utf8')));

const riskQuestionIds = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'a1', 'a2', 'a3'];
const planGateStatuses = new Set(['awaiting-approval', 'approved', 'implementing', 'ready-for-review']);
const schemaError = (error) =>
  `${error.instancePath || '/'} ${error.message ?? 'does not satisfy the schema'}`;

const hasCredentialBearingSource = (reference) => {
  if (/(?:^|[?&;])(?:access_?token|token|api_?key|client_?secret|password|secret|sig|signature|credential)=/i.test(reference)) {
    return true;
  }
  try {
    const url = new URL(reference);
    return Boolean(url.username || url.password || [...url.searchParams.keys()].some((key) =>
      /^(?:access_?token|token|api_?key|client_?secret|password|secret|sig|signature|credential)$/i.test(key),
    ));
  } catch {
    return /:\/\/[^/\s:@]+:[^/\s@]+@/.test(reference);
  }
};
const canonicalizeRelativePath = (value) => {
  const unixPath = value.replaceAll('\\', '/');
  if (!unixPath || unixPath.startsWith('/') || unixPath.startsWith('//') || /^[a-zA-Z]:\//.test(unixPath)) {
    return { error: 'must be a non-empty relative path' };
  }

  const normalized = posix.normalize(unixPath).replace(/^\.\//, '').replace(/\/+$/, '').toLowerCase();
  if (!normalized || normalized === '.' || normalized === '..' || normalized.startsWith('../')) {
    return { error: 'must not name the repository root or escape it' };
  }
  return { path: normalized };
};

const evidenceCatalog = (plan) => {
  const report = plan.assessment.report;
  const facts = new Set();
  const azureFacts = new Set();
  const azureUnavailable = new Set();

  for (const component of report.facts.components) {
    facts.add(`component:${component.ecosystem}/${component.name}`);
  }
  for (const license of report.facts.licenses) facts.add(`license:${license.declaredIn}`);
  for (const item of report.facts.iac) facts.add(`iac:${item.path}`);
  for (const item of report.facts.tests) facts.add(`test:${item.path}`);
  for (const item of report.facts.runtimes) facts.add(`runtime:${item.path}`);
  for (const item of report.facts.secrets) facts.add(`secret:${item.path}:${item.rule}`);

  const unavailable = new Set(report.unavailable.map((item) => `unavailable:${item.check}`));
  const toolErrors = new Set(report.toolErrors.map((item) => `tool-error:${item.path}`));
  const ownerAnswers = new Set(
    plan.questions
      .filter((question) => question.answer?.trim() && question.answeredBy?.trim())
      .map((question) => `owner:${question.id}`),
  );

  const discovery = plan.azureDiscovery;
  if (discovery?.discoveryId) {
    for (const query of discovery.queryEvidence) {
      const id = `azure-discovery:${discovery.discoveryId}:${query.category}`;
      if (query.status === 'available') azureFacts.add(id);
      else azureUnavailable.add(`unavailable:${id}`);
    }
  }

  return { facts, azureFacts, azureUnavailable, unavailable, toolErrors, ownerAnswers };
};

const isKnownEvidence = (id, catalog, { allowOwner = true } = {}) =>
  catalog.facts.has(id) ||
  catalog.azureFacts.has(id) ||
  catalog.azureUnavailable.has(id) ||
  catalog.unavailable.has(id) ||
  catalog.toolErrors.has(id) ||
  (allowOwner && catalog.ownerAnswers.has(id));

export const isKnownPlanEvidence = (plan, id) =>
  isKnownEvidence(id, evidenceCatalog(plan));

const validateEvidence = (
  problems,
  location,
  evidence,
  catalog,
  { allowOwner = true } = {},
) => {
  // Empty evidence is allowed (a claim without evidence stays an inference or open question);
  // an id that names nothing is still a mistake.
  for (const id of evidence) {
    if (!isKnownEvidence(id, catalog, { allowOwner })) {
      problems.push(`${location}: unknown evidence id ${id}`);
    }
  }
};

const validateFindingEvidence = (problems, finding, location, catalog) => {
  validateEvidence(problems, `${location}.evidence`, finding.evidence, catalog, {
    allowOwner: false,
  });

  const hasOnlyFacts = finding.evidence.every(
    (id) => catalog.facts.has(id) || catalog.azureFacts.has(id),
  );
  const hasOnlyUnavailable = finding.evidence.every(
    (id) =>
      catalog.unavailable.has(id) ||
      catalog.azureUnavailable.has(id) ||
      catalog.toolErrors.has(id),
  );

  if (finding.basis === 'fact' && !hasOnlyFacts) {
    problems.push(`${location}: fact findings may cite only observed fact ids`);
  }
  if (finding.basis === 'unavailable' && !hasOnlyUnavailable) {
    problems.push(`${location}: unavailable findings may cite only unavailable or tool-error ids`);
  }
};

const validateRisk = (problems, plan, catalog) => {
  const { risk } = plan;
  const answers = new Map();
  for (const [index, answer] of risk.answers.entries()) {
    const location = `risk.answers[${index}]`;
    if (answers.has(answer.id)) {
      problems.push(`risk.answers: duplicate answer for ${answer.id}`);
    }
    answers.set(answer.id, answer.answer);

    validateEvidence(problems, `${location}.evidence`, answer.evidence, catalog, {
      allowOwner: answer.source === 'owner',
    });
    if (answer.source === 'code' && !answer.evidence.every((id) => catalog.facts.has(id))) {
      problems.push(`${location}.evidence: code answers may cite only observed fact ids`);
    }
    if (answer.source === 'owner' && !answer.evidence.some((id) => catalog.ownerAnswers.has(id))) {
      problems.push(`${location}.evidence: owner answers require an answered owner:<question-id> reference`);
    }
  }

  if (planGateStatuses.has(plan.status)) {
    for (const id of riskQuestionIds) {
      if (!answers.has(id)) {
        problems.push(`risk.answers: ${id} must be answered before ${plan.status}`);
      } else if (answers.get(id) === 'unknown') {
        problems.push(`risk.answers: ${id} must be resolved before ${plan.status}`);
      }
    }
  }

  const answerIsYes = (id) => answers.get(id) === 'yes';
  const flags = new Set(risk.flags ?? []);

  if (answerIsYes('q1') && risk.suggestedZone === 'green') {
    problems.push('risk.suggestedZone: q1 answered yes cannot be green');
  }
  if (answerIsYes('q3') && !flags.has('dpia')) {
    problems.push('risk.flags: q3 answered yes requires dpia');
  }
  if (answerIsYes('q5') && !flags.has('ai-act-high-risk-check')) {
    problems.push('risk.flags: q5 answered yes requires ai-act-high-risk-check');
  }
  if (answerIsYes('q6') && !flags.has('tool-approval')) {
    problems.push('risk.flags: q6 answered yes requires tool-approval');
  }
  if (answerIsYes('q7') && !flags.has('eu-only')) {
    problems.push('risk.flags: q7 answered yes requires eu-only');
  }
  if (answerIsYes('a1') && !flags.has('prohibited')) {
    problems.push('risk.flags: a1 answered yes requires prohibited');
  }
  if (answerIsYes('a1') && planGateStatuses.has(plan.status)) {
    problems.push(`risk.answers: a1 answered yes blocks ${plan.status}`);
  }
  if (answerIsYes('a2') && (!flags.has('dpia') || !flags.has('ai-act-high-risk-check'))) {
    problems.push('risk.flags: a2 answered yes requires dpia and ai-act-high-risk-check');
  }
  if (answerIsYes('a3') && !flags.has('transparency')) {
    problems.push('risk.flags: a3 answered yes requires transparency');
  }
};

const validateDecisionRecords = (problems, decisions, catalog) => {
  const ids = new Set();
  for (const [index, decision] of decisions.entries()) {
    const location = `decisionRecords[${index}]`;
    if (ids.has(decision.id)) problems.push(`${location}: duplicate decision id ${decision.id}`);
    ids.add(decision.id);

    validateEvidence(problems, `${location}.evidence`, decision.evidence, catalog, {
      allowOwner: false,
    });
    validateEvidence(problems, `${location}.recommendation.evidence`, decision.recommendation.evidence, catalog, {
      allowOwner: false,
    });

    const optionIds = new Set(decision.options.map((option) => option.id));
    if (!optionIds.has(decision.recommendation.optionId)) {
      problems.push(`${location}.recommendation.optionId: does not name an available option`);
    }
    if (decision.decision && !optionIds.has(decision.decision.optionId)) {
      problems.push(`${location}.decision.optionId: does not name an available option`);
    }
    if (decision.status === 'approved' && !decision.decision) {
      problems.push(`${location}: approved decisions require a human decision record`);
    }
    if (decision.decision?.by?.toLowerCase().includes('agent')) {
      problems.push(`${location}.decision.by: an agent cannot approve a decision`);
    }
  }
};

const validatePaths = (problems, plan) => {
  const allowed = [];
  const seenAllowed = new Set();

  for (const [index, rawPath] of plan.allowedPaths.entries()) {
    const location = `allowedPaths[${index}]`;
    const result = canonicalizeRelativePath(rawPath);
    if (result.error) {
      problems.push(`${location}: ${result.error}`);
      continue;
    }
    if (seenAllowed.has(result.path)) {
      problems.push(`${location}: duplicates an existing allowed path`);
      continue;
    }
    seenAllowed.add(result.path);
    allowed.push(result.path);
  }

  const plannedPaths = new Set();
  for (const [index, change] of plan.appChanges.entries()) {
    const location = `appChanges[${index}].path`;
    const result = canonicalizeRelativePath(change.path);
    if (result.error) {
      problems.push(`${location}: ${result.error}`);
      continue;
    }
    if (!allowed.some((allowedPath) => result.path === allowedPath || result.path.startsWith(`${allowedPath}/`))) {
      problems.push(`${location}: is outside allowedPaths`);
    }
    // validate-implementation maps each changed file to one plan item, so two items on one path
    // would pass here and fail after the work is done.
    if (plannedPaths.has(result.path)) {
      problems.push(`${location}: ${result.path} is already planned by another appChanges item; merge them`);
    }
    plannedPaths.add(result.path);
  }
};

const validateImplementationMappings = (problems, plan) => {
  const mappingsRequired = planGateStatuses.has(plan.status);
  const targetFields = new Map();
  for (const [index, delta] of plan.assessment.draft.targetSpecDelta.entries()) {
    if (targetFields.has(delta.field)) {
      problems.push(`assessment.draft.targetSpecDelta[${index}].field: duplicates ${delta.field}`);
    }
    targetFields.set(delta.field, delta);
  }

  const itemIds = new Set();
  for (const [index, change] of plan.appChanges.entries()) {
    const location = `appChanges[${index}]`;
    if (!change.planItemId) {
      if (mappingsRequired) problems.push(`${location}.planItemId: is required before ${plan.status}`);
    } else {
      if (itemIds.has(change.planItemId)) {
        problems.push(`${location}.planItemId: duplicates ${change.planItemId}`);
      }
      itemIds.add(change.planItemId);
    }

    if (!change.targetSpecField) {
      if (mappingsRequired) {
        problems.push(`${location}.targetSpecField: is required before ${plan.status}`);
      }
      continue;
    }
    const delta = targetFields.get(change.targetSpecField);
    if (!delta) {
      problems.push(`${location}.targetSpecField: ${change.targetSpecField} is not in targetSpecDelta`);
      continue;
    }
    if (!change.evidence.every((id) => delta.evidence.includes(id))) {
      problems.push(`${location}.evidence: each change evidence id must also support its target-spec field`);
    }
  }
};

const validateAzureDiscovery = (problems, plan) => {
  const discovery = plan.azureDiscovery;
  if (!discovery) return;

  const categories = new Set();
  for (const [index, query] of discovery.queryEvidence.entries()) {
    if (categories.has(query.category)) {
      problems.push(`azureDiscovery.queryEvidence[${index}]: duplicate category ${query.category}`);
    }
    categories.add(query.category);
    if (query.status === 'available' && query.itemCount === null) {
      problems.push(`azureDiscovery.queryEvidence[${index}]: available categories require an item count`);
    }
    if (query.status === 'unavailable' && query.itemCount !== null) {
      problems.push(`azureDiscovery.queryEvidence[${index}]: unavailable categories require a null item count`);
    }
  }
  const available = discovery.queryEvidence.filter((query) => query.status === 'available').length;
  const unavailable = discovery.queryEvidence.length - available;
  if (discovery.discoveryId === null) {
    if (discovery.status !== 'unavailable') {
      problems.push('azureDiscovery: only an unavailable result may omit the discovery id');
    }
    if (discovery.contentSha256 !== null || discovery.queryEvidence.length > 0) {
      problems.push('azureDiscovery: a missing discovery id cannot carry a hash or query evidence');
    }
    if (
      discovery.status === 'unavailable' &&
      !plan.assessment.report.unavailable.some((check) => check.check === 'azure-discovery')
    ) {
      problems.push(
        'azureDiscovery: an unavailable result without a discovery id requires unavailable:azure-discovery evidence',
      );
    }
  } else {
    if (discovery.contentSha256 === null) {
      problems.push('azureDiscovery: a persisted discovery id requires its content SHA-256');
    }
    if (discovery.sourceScope.subscriptionCount === 0) {
      problems.push('azureDiscovery: a persisted discovery id requires a readable subscription scope');
    }
  }

  if (discovery.status === 'available' && (unavailable > 0 || discovery.sourceScope.unavailableSubscriptionCount > 0)) {
    problems.push('azureDiscovery.status: available cannot include unavailable queries or subscriptions');
  }
  if (discovery.status === 'available' && available === 0) {
    problems.push('azureDiscovery.status: available requires at least one available query');
  }
  if (
    discovery.status === 'partial' &&
    (available === 0 ||
      (unavailable === 0 && discovery.sourceScope.unavailableSubscriptionCount === 0))
  ) {
    problems.push('azureDiscovery.status: partial requires both available and unavailable evidence');
  }
  if (discovery.status === 'unavailable' && available > 0) {
    problems.push('azureDiscovery.status: unavailable cannot include available query evidence');
  }
  if (
    discovery.discoveryId !== null &&
    discovery.status === 'unavailable' &&
    discovery.queryEvidence.length === 0
  ) {
    problems.push('azureDiscovery.status: a persisted unavailable snapshot requires query evidence');
  }
  if (discovery.status === 'available' && discovery.reasonCode !== null) {
    problems.push('azureDiscovery.reasonCode: available results must not have a reason code');
  }
  if (discovery.status === 'partial' && discovery.reasonCode !== 'partial-results') {
    problems.push('azureDiscovery.reasonCode: partial results require partial-results');
  }
  if (
    discovery.discoveryId !== null &&
    discovery.status === 'unavailable' &&
    discovery.reasonCode !== 'queries-unavailable'
  ) {
    problems.push('azureDiscovery.reasonCode: a persisted unavailable snapshot requires queries-unavailable');
  }
};

export const validatePlan = (plan) => {
  if (!validateSchema(plan)) {
    return validateSchema.errors.map(schemaError);
  }

  const problems = [];
  if (hasCredentialBearingSource(plan.intake.source)) {
    problems.push("intake.source must be a sanitized repository/package reference without URL credentials or secret-like query parameters");
  }
  if (plan.assessment.report.revision !== plan.intake.revision) {
    problems.push("assessment.report.revision must match the inspected intake revision");
  }
  if (plan.intake.packageSha256 && plan.assessment.report.packageSha256 !== plan.intake.packageSha256) {
    problems.push("assessment.report.packageSha256 must match the intake package hash");
  }
  validateAzureDiscovery(problems, plan);
  const catalog = evidenceCatalog(plan);
  const draft = plan.assessment.draft;

  validateEvidence(problems, 'assessment.draft.currentArchitecture.evidence', draft.currentArchitecture.evidence, catalog, {
    allowOwner: false,
  });
  validateEvidence(problems, 'assessment.draft.targetArchitecture.evidence', draft.targetArchitecture.evidence, catalog, {
    allowOwner: false,
  });
  draft.findings.forEach((finding, index) =>
    validateFindingEvidence(problems, finding, `assessment.draft.findings[${index}]`, catalog),
  );
  draft.targetSpecDelta.forEach((item, index) =>
    validateEvidence(problems, `assessment.draft.targetSpecDelta[${index}].evidence`, item.evidence, catalog, {
      allowOwner: false,
    }),
  );
  // The typed app proposal (contract C2): the schema above checked the shape, this checks that
  // every value has evidence (a file and the reason) and that nothing in it is a secret value.
  if (draft.appProposal) {
    for (const problem of validateAppProposal(draft.appProposal)) {
      problems.push(`assessment.draft.appProposal: ${problem}`);
    }
  }
  draft.backlog.forEach((item, index) =>
    validateEvidence(problems, `assessment.draft.backlog[${index}].evidence`, item.evidence, catalog, {
      allowOwner: false,
    }),
  );
  plan.appChanges.forEach((item, index) =>
    validateEvidence(problems, `appChanges[${index}].evidence`, item.evidence, catalog, {
      allowOwner: true,
    }),
  );
  plan.hosting.signals.forEach((item, index) =>
    validateEvidence(problems, `hosting.signals[${index}].evidence`, item.evidence, catalog, {
      allowOwner: true,
    }),
  );

  validatePaths(problems, plan);
  validateImplementationMappings(problems, plan);
  validateRisk(problems, plan, catalog);
  validateDecisionRecords(problems, plan.decisionRecords ?? [], catalog);
  return problems;
};

export const validateImplementationDiff = (plan, changedPaths) => {
  const problems = validatePlan(plan).map((problem) => `plan: ${problem}`);
  if (problems.length) return problems;
  if (!Array.isArray(changedPaths)) return ['changed paths must be an array'];

  const allowedPaths = plan.allowedPaths
    .map((value) => canonicalizeRelativePath(value).path)
    .filter(Boolean);
  for (const [index, rawPath] of changedPaths.entries()) {
    const location = `changedPaths[${index}]`;
    if (typeof rawPath !== 'string') {
      problems.push(`${location}: must be a path string`);
      continue;
    }
    const result = canonicalizeRelativePath(rawPath);
    if (result.error) {
      problems.push(`${location}: ${result.error}`);
      continue;
    }
    const path = result.path;
    if (path.startsWith('.aifactory/')) continue; // the agent's own plan, spec, logs and reports
    if (!allowedPaths.some((allowed) => path === allowed || path.startsWith(`${allowed}/`))) {
      problems.push(`${location}: ${path} is outside allowedPaths`);
      continue;
    }

    const mapped = plan.appChanges
      .map((change) => ({ change, path: canonicalizeRelativePath(change.path).path }))
      .filter(({ path: plannedPath }) =>
        plannedPath && (path === plannedPath || path.startsWith(`${plannedPath}/`)),
      )
      .sort((a, b) => b.path.length - a.path.length);
    if (!mapped.length) {
      problems.push(`${location}: ${path} is not mapped to an approved appChanges plan item`);
      continue;
    }
    if (mapped.length > 1 && mapped[0].path.length === mapped[1].path.length) {
      problems.push(`${location}: ${path} maps to multiple appChanges plan items`);
      continue;
    }
    const { planItemId, targetSpecField } = mapped[0].change;
    if (!planItemId || !targetSpecField) {
      problems.push(`${location}: the mapped appChanges item lacks its plan ID or target-spec field`);
    }
  }
  return problems;
};

export const validatePlanFile = (file) => {
  try {
    return { plan: JSON.parse(readFileSync(file, 'utf8')), problems: [] };
  } catch (error) {
    return { plan: null, problems: [`could not read JSON: ${error.message}`] };
  }
};