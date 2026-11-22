import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isIP } from 'node:net';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

export const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const schemaPath = resolve(repositoryRoot, 'skills/replatform/schemas/ai-factory-spec.schema.json');
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validateSchema = ajv.compile(JSON.parse(readFileSync(schemaPath, 'utf8')));

const yellowRegions = new Set(['swedencentral', 'westeurope', 'northeurope', 'germanywestcentral']);
const euRegions = new Set(['swedencentral','swedensouth','northeurope','westeurope','germanywestcentral','francecentral','italynorth','polandcentral','spaincentral']);
const redAddressSpace = { network: 0x0a140000, mask: 0xffff0000 };
const redVpnPool = { network: 0xac10c900, mask: 0xffffff00 };

const toIPv4Number = (ip) => {
  if (isIP(ip) !== 4) return null;
  return ip.split('.').reduce((value, part) => ((value << 8) | Number(part)) >>> 0, 0);
};

const inRange = (address, cidr) =>
  address !== null && ((address & cidr.mask) >>> 0) === cidr.network;

const isPrivateIPv4 = (ip) => {
  const address = toIPv4Number(ip);
  return address !== null && (
    inRange(address, { network: 0x0a000000, mask: 0xff000000 }) ||
    inRange(address, { network: 0xac100000, mask: 0xfff00000 }) ||
    inRange(address, { network: 0xc0a80000, mask: 0xffff0000 })
  );
};

const issueText = (error) => `${error.instancePath || '/'} ${error.message ?? 'is invalid'}`;

export const validateWizardSpec = (spec, { orderDate } = {}) => {
  const errors = [];
  const blockers = [];
  const warnings = [];
  const warn = (code, message) => warnings.push({ code, message });

  if (!validateSchema(spec)) {
    return { errors: validateSchema.errors.map(issueText), blockers, warnings };
  }

  const allowedRegions = spec.allowedRegions ?? [];
  if (!spec.archetype) blockers.push('The Wizard requires a human-selected CAF archetype; do not infer it.');
  if (!spec.connectivity) blockers.push('The Wizard requires a human answer for internal versus isolated connectivity.');
  if (!spec.audience) blockers.push('The Wizard requires a human answer for internal, external, or public audience.');
  if (!spec.region) {
    blockers.push('No region is selected. Ask the customer; the agent must not default a region.');
  } else if (!euRegions.has(spec.region)) {
    errors.push('region is not in the verified AI Factory EU region catalogue.');
  } else if (allowedRegions.length && !allowedRegions.includes(spec.region)) {
    errors.push('region must be one of the customer-approved allowedRegions');
  } else if (!allowedRegions.length) {
    warn('allowed-regions-unknown', 'allowedRegions is unknown; a selected region is not evidence of CAF approval.');
  }
  if (spec.zone === 'red' && spec.region && spec.region !== 'swedencentral') {
    errors.push('Red workloads are restricted to swedencentral.');
  }
  if (spec.zone === 'yellow' && spec.region && !yellowRegions.has(spec.region)) {
    errors.push('Yellow is currently supported only in swedencentral, westeurope, northeurope, or germanywestcentral.');
  }

  const refusal = (field, reason) => blockers.push(
    `${field}: the current Wizard refuses this combination under its archetype rules (still Proposed): ${reason} Do not change the zone or archetype automatically; ask the responsible reviewers.`,
  );
  if (spec.archetype === 'corp' && spec.zone === 'green') {
    refusal('archetype/zone', 'Corp + Green.');
  }
  if (spec.archetype === 'public' && spec.zone === 'red') {
    refusal('archetype/zone', 'Public + Red.');
  }
  if (spec.connectivity === 'internal' && spec.archetype && spec.archetype !== 'corp') {
    refusal('connectivity/archetype', 'internal connectivity needs Corp.');
  }
  if (spec.audience === 'public' && spec.archetype === 'corp') {
    refusal('audience/archetype', 'public audience is refused in Corp.');
  }
  if (spec.audience === 'public' && spec.zone === 'red') {
    refusal('audience/zone', 'Red has VPN-only entry.');
  }
  if (spec.audience === 'external' && spec.archetype === 'corp') {
    warn('external-corp-entry', 'External users in Corp require a customer-platform-approved entry; record the human decision.');
  }
  if (spec.audience === 'external' && spec.zone === 'red') {
    warn('external-red-vpn', 'External users in Red need customer-provided VPN access.');
  }

  // Production on its own (no dev or test before it) needs a person's approval, which the Wizard
  // records as prodOnlyApproval. The agent never writes it and never defaults it.
  const environmentNames = spec.environments.map((environment) => environment.name);
  const prodOnly = environmentNames.length > 0 && environmentNames.every((name) => name === 'prod');
  if (prodOnly && !spec.prodOnlyApproval) {
    blockers.push('Production is the only environment: a person must approve deploying it without a lower environment in the Wizard ("I approve deploying production without a lower environment"). Never write the approval yourself.');
  } else if (prodOnly && Number.isNaN(Date.parse(spec.prodOnlyApproval.approvedAt))) {
    errors.push('prodOnlyApproval.approvedAt must be a date-time.');
  } else if (!prodOnly && spec.prodOnlyApproval) {
    warn('prod-only-approval-ignored', 'prodOnlyApproval only applies while production is the only environment; the Wizard ignores it beside a lower environment.');
  }

  // TLS certificate source, DNS owner and mail.
  for (const [index, app] of (spec.apps ?? []).entries()) {
    if (app.certificateSource && app.kind !== 'web') {
      errors.push(`apps[${index}].certificateSource: Only web apps have a TLS certificate.`);
    }
  }
  if (spec.services?.mail && spec.services.mail.mode !== 'none' && !spec.services.mail.senderDomain?.trim()) {
    errors.push('services.mail.senderDomain: Mail needs a sender domain.');
  }
  if (spec.zone === 'red' && spec.services?.mail?.mode === 'acs-email') {
    errors.push('services.mail.mode: Red sends no mail through Azure Communication Services Email.');
  }

  // Sub-zones and egress per audience (an amendment to the archetype rules).
  const subZoneZone = { 'yellow-public': 'yellow', 'yellow-internal': 'yellow', 'red-hub': 'red', 'red-isolated': 'red' };
  if (spec.subZone && subZoneZone[spec.subZone] !== spec.zone) {
    errors.push(`${spec.subZone} belongs to the ${subZoneZone[spec.subZone]} zone, not ${spec.zone}: Yellow-Public and Yellow-Internal need zone yellow, Red-Hub and Red-Isolated need zone red.`);
  }
  if (spec.egress && !(spec.zone === 'red' || (spec.zone === 'yellow' && spec.subZone))) {
    errors.push('Only Red, or Yellow with a sub-zone, routes egress through a firewall or none; do not add it to Green or to Yellow without a sub-zone.');
  }
  if (spec.zone === 'red' && spec.network) {
    warn('legacy-red-network-block', 'Legacy Red network data is ignored by the Wizard; new Red specs use egress only. Do not carry the network block forward.');
  }
  if (spec.egress?.firewall === 'nat-gateway' && spec.zone === 'red') {
    blockers.push("Red never uses an unfiltered NAT gateway: send egress through the customer's firewall, a FortiGate or Azure Firewall, or choose none.");
  }
  if (spec.egress?.firewall === 'none' && ['external', 'public'].includes(spec.audience) && (spec.apps ?? []).some((app) => app.kind === 'web')) {
    blockers.push("Egress none is refused: a web app serves users outside the customer's network and needs outbound internet. Choose a NAT gateway or a firewall; none is for internal APIs and workers only.");
  }
  if ((spec.subZone === 'red-hub' || spec.subZone === 'red-isolated') && spec.soc !== true) {
    blockers.push('A Red sub-zone requires the SOC: turn it on (soc). Never turn it on for the customer without their answer.');
  }
  if (spec.zone === 'red') {
    if (!spec.egress) {
      blockers.push('Red egress firewall is not selected. Ask the customer; never default to Azure Firewall.');
    } else if (spec.egress.firewall === 'azure-firewall') {
      if (!spec.egress.azureFirewallApproval?.trim()) {
        blockers.push('Azure Firewall requires an itm8 Operations approval reference; do not invent one.');
      }
    } else if (['existing', 'fortigate'].includes(spec.egress.firewall)) {
      const nextHop = (spec.egress.firewallNextHopIp ?? '').trim();
      const address = toIPv4Number(nextHop);
      if (address === null) {
        errors.push('existing/FortiGate egress requires a valid private IPv4 next-hop address.');
      } else if (!isPrivateIPv4(nextHop)) {
        errors.push('egress next hop must be a private IPv4 address.');
      } else if (inRange(address, redAddressSpace) || inRange(address, redVpnPool)) {
        errors.push('egress next hop must be outside Red 10.20.0.0/16 and VPN 172.16.201.0/24.');
      }
    }
  }

  if (spec.evaluation) {
    const evaluation = spec.evaluation;
    if (!['synthetic', 'non-sensitive'].includes(evaluation.data)) {
      errors.push('evaluation data must be synthetic or non-sensitive; personal/sensitive data is refused.');
    }
    if (!orderDate) {
      blockers.push('Evaluation expiry cannot be checked because no order date was supplied; take it from the Management App engagement.');
    } else {
      const expiry = Date.parse(`${evaluation.expiresOn}T00:00:00Z`);
      const start = Date.parse(`${orderDate}T00:00:00Z`);
      const days = (expiry - start) / 86_400_000;
      if (!Number.isFinite(days) || days < 1 || days > 90 || new Date(expiry).toISOString().slice(0, 10) !== evaluation.expiresOn) {
        errors.push('evaluation expiresOn must be 1–90 calendar days after the order date.');
      }
    }
    if (spec.zone !== 'green') errors.push('evaluation landing zones must use Green.');
    if (spec.connectivity === 'internal') errors.push('evaluation landing zones are isolated and cannot reach internal resources.');
    if (spec.archetype === 'corp') errors.push('evaluation landing zones are isolated; Corp is refused by the current Wizard.');
    if (spec.environments.some((environment) => environment.name === 'prod')) {
      errors.push('evaluation landing zones cannot include prod; production requires a new reviewed order.');
    }
    if (spec.environments.some((environment) => environment.level !== 'basic')) {
      errors.push('evaluation environments must all be Basic.');
    }
    if (spec.network?.gatewayMode === 'existing' || spec.network?.existingRegistryId?.trim()) {
      errors.push('evaluation landing zones cannot reuse a shared gateway or registry.');
    }
    if (spec.dataPlatform) errors.push('evaluation landing zones cannot use shared Fabric/data-platform capacity.');
    if (spec.foundry?.enabled) {
      const evaluationFoundry = spec.readiness?.foundryOption ?? 'not-used';
      if (evaluationFoundry === 'shared-itm8') {
        errors.push('evaluation landing zones cannot use shared itm8 Foundry.');
      } else if (!['itm8-dedicated', 'customer-foundry'].includes(evaluationFoundry)) {
        blockers.push('Evaluation Foundry must be explicitly dedicated to itm8 or customer-owned; do not infer ownership.');
      }
    }
  }

  if (spec.foundry?.enabled && (spec.foundry.level ?? 'basic') === 'premium') {
    if (!Number.isInteger(spec.foundry.tokensPerMinute) || spec.foundry.tokensPerMinute < 1) {
      blockers.push('Foundry Premium needs a customer-approved per-app tokensPerMinute value; never invent a limit.');
    }
    if (spec.foundry.monthlyTokenQuota === undefined) {
      blockers.push('Foundry Premium needs an explicit monthlyTokenQuota; use 0 only when a human chooses no monthly cap.');
    }
    if (!spec.foundry.gatewayContact?.trim()) {
      blockers.push('Foundry Premium needs a customer-selected shared gateway contact; do not invent an email address.');
    }
    for (const app of spec.apps ?? []) {
      if (app.settings.some((setting) => setting.name === 'AZURE_AI_PROJECT_ENDPOINT')) {
        errors.push('Foundry Premium apps must use the AI gateway and must not receive AZURE_AI_PROJECT_ENDPOINT.');
        break;
      }
    }
  }

  if (!spec.caf) {
    warn('caf-profile-unknown', 'No confirmed CAF profile block is present. Do not assume Defender or Bastion is inherited/present.');
  } else {
    if (Object.keys(spec.caf).length === 0 || typeof spec.caf.defenderInherited !== 'boolean' || typeof spec.caf.bastionPresent !== 'boolean') {
      warn('caf-profile-incomplete', 'CAF Defender/Bastion answers are incomplete; do not infer the missing confirmed fact.');
    }
    if (spec.caf.defenderInherited === true && !spec.network) {
      blockers.push('A confirmed inherited Defender profile needs the Wizard network answer.');
    } else if (spec.caf.defenderInherited === true && spec.network?.defenderPlans !== false) {
      errors.push('caf.defenderInherited=true requires network.defenderPlans=false in every zone.');
    }
  }

  const readiness = spec.readiness ?? {};
  const foundryOption = readiness.foundryOption ?? 'not-used';
  if (spec.foundry?.enabled && foundryOption === 'not-used') {
    blockers.push('Foundry is enabled but its customer/itm8 tenancy option is unanswered.');
  }
  if (!spec.foundry?.enabled && foundryOption !== 'not-used') {
    blockers.push('A Foundry tenancy was selected but no application uses Foundry.');
  }
  if (readiness.ownershipMode !== 'prototype-isolated') {
    if (readiness.socLogging !== 'ready') {
      blockers.push('Customer SOC must attest SOC/logging onboarding readiness.');
    }
    if (readiness.accessGroups !== 'ready') {
      blockers.push('Customer identity team must attest static Owner/Contributor/Reader groups and PIM settings.');
    }
    if (!readiness.eligibleAccounts?.trim()) {
      blockers.push('Customer identity team must provide an eligible-accounts evidence reference.');
    }
    if (!readiness.accessAdmin?.name?.trim() || !readiness.accessAdmin?.email?.trim()) {
      blockers.push('Customer identity team must name an access administrator in the Wizard. Do not copy their contact details into the plan or logs.');
    }
    if (readiness.accessGroups === 'ready' && (!readiness.eligibleAccounts?.trim() || !readiness.accessAdmin?.name?.trim() || !readiness.accessAdmin?.email?.trim())) {
      errors.push('readiness.accessGroups cannot be treated as ready without eligible-accounts evidence and a named access administrator.');
    }
  }
  if (readiness.customerActions?.length) {
    blockers.push(`${readiness.customerActions.length} Wizard customer action(s) remain open; keep them as actions, not inferred answers.`);
  }

  return { errors, blockers, warnings };
};

export const validateWizardSpecFile = (file, options) => {
  try {
    const spec = JSON.parse(readFileSync(file, 'utf8'));
    return { spec, ...validateWizardSpec(spec, options) };
  } catch (error) {
    return { spec: null, errors: [`could not read JSON: ${error.message}`], blockers: [], warnings: [] };
  }
};