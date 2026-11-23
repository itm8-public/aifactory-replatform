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

/** A setting that would carry a model or gateway key: Foundry Premium has none (keyless). */
const AI_KEY_SETTING = /(OPENAI|FOUNDRY|AZURE_AI|APIM|GATEWAY|COGNITIVE).*KEY/i;

/**
 * The edge one environment gets (Management App `edgeFor`):
 * no `edge` keeps an App Gateway; Red and Yellow-Internal always a private App Gateway; Green and
 * Yellow Basic none; Yellow Standard and Premium the chosen WAF edge.
 */
export const edgeFor = (spec, level) => {
  if (!spec.edge) return 'app-gateway';
  if (spec.zone === 'red' || spec.subZone === 'yellow-internal') return 'app-gateway';
  if (spec.zone === 'green' || level === 'basic') return 'none';
  return spec.edge.kind === 'none' ? 'app-gateway' : spec.edge.kind;
};

/** Green with an `edge`: no network, public endpoints behind Entra and RBAC (`isPublicGreen`). */
const isPublicGreen = (spec) => spec.zone === 'green' && Boolean(spec.edge);

/** What the edge and the database refuse with the zone (Management App `tierRefusals`). */
export const tierRefusals = (spec) => {
  const out = [];
  const { edge } = spec;
  if (edge) {
    const publicYellow = spec.zone === 'yellow' && spec.subZone !== 'yellow-internal';
    if (spec.zone === 'green' && edge.kind !== 'none') {
      out.push('edge: Green has no gateway: its web apps are reached on the Container Apps endpoint behind Entra sign-in. For a WAF edge choose Yellow, Standard or Premium.');
    }
    if (publicYellow && edge.kind === 'none' && spec.environments.some((environment) => environment.level !== 'basic')) {
      out.push('edge: Standard and Premium put a WAF in front of the web apps: choose App Gateway or Front Door, or set every environment to Basic.');
    }
    if (edge.kind === 'front-door' && (spec.zone === 'red' || spec.subZone === 'yellow-internal')) {
      out.push('edge: Front Door is a public edge: Red and Yellow-Internal are never reached from the internet.');
    }
    if (edge.kind === 'front-door' && edge.mode === 'existing' && !edge.existingId?.trim()) {
      out.push('edge: Give the resource ID of the existing Front Door profile.');
    }
  }
  if (spec.database === 'cosmos-nosql' && spec.zone === 'red') {
    out.push('database: Red keeps PostgreSQL for now: Cosmos DB with a customer-managed key is not built yet.');
  }
  return out;
};

const API_MANAGEMENT_ID = /^\/subscriptions\/[0-9a-f-]{36}\/resourceGroups\/[^/]+\/providers\/Microsoft\.ApiManagement\/service\/[^/]+$/i;
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The tier of the AI gateway (Management App `aiGatewayTierFor`). */
export const aiGatewayTierFor = (spec, gateway = spec.foundry?.gateway) => {
  if (gateway?.mode === 'existing') return gateway.tier ?? 'standard-v2';
  return isPublicGreen(spec) ? 'basic-v2' : 'standard-v2';
};

/** What the AI gateway refuses (Management App `aiGatewayRefusals`); empty without one. */
export const aiGatewayRefusals = (spec) => {
  const gateway = spec.foundry?.gateway;
  if (!gateway) return [];
  const out = [];
  const privateFoundry = !isPublicGreen(spec);
  if (gateway.mode === 'existing') {
    if (!API_MANAGEMENT_ID.test(gateway.existingId?.trim() ?? '')) {
      out.push('Give the resource ID of the existing API Management instance: /subscriptions/<id>/resourceGroups/<group>/providers/Microsoft.ApiManagement/service/<name>.');
    }
    if (gateway.principalId && !GUID.test(gateway.principalId)) {
      out.push('The managed identity of the API Management instance is given as its object ID, a GUID.');
    }
  } else if (gateway.tier && gateway.tier !== aiGatewayTierFor(spec, null)) {
    out.push(privateFoundry
      ? 'A new AI gateway in a landing zone with a network is API Management Standard v2: it needs virtual network integration to reach Foundry behind its private endpoint.'
      : 'A new AI gateway in Green without a network is API Management Basic v2: there is no network to integrate with.');
  }
  if (gateway.mode === 'existing' && gateway.tier === 'basic-v2' && privateFoundry) {
    out.push('API Management Basic v2 has no virtual network integration, so it cannot reach Foundry behind its private endpoint. Use an instance in Standard v2 or Premium v2, or let the package create a new one.');
  }
  return out;
};

const REGISTRY_ID = /^\/subscriptions\/[0-9a-f-]{36}\/resourceGroups\/[^/]+\/providers\/Microsoft\.ContainerRegistry\/registries\/[^/]+$/i;

/** The platform kinds of a solution; absent or empty means Azure apps only (Management App `platformKindsOf`). */
export const platformKindsOf = (spec) => (spec.platformKinds?.length ? spec.platformKinds : ['azure-apps']);

const cidrRange = (cidr) => {
  const match = /^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/.exec(cidr);
  const address = match ? toIPv4Number(match[1]) : null;
  const bits = match ? Number(match[2]) : NaN;
  if (address === null || bits > 32) return null;
  const size = 2 ** (32 - bits);
  const start = Math.floor(address / size) * size;
  return { text: match[1], bits, address, start, end: start + size - 1 };
};
const ipText = (value) => [24, 16, 8, 0].map((shift) => Math.floor(value / 2 ** shift) % 256).join('.');
const overlaps = (a, b) => a.start <= b.end && b.start <= a.end;
const within = (inner, outer) => outer.start <= inner.start && inner.end <= outer.end;

/**
 * Why a landing zone address space cannot be used, or null (Management App `addressSpaceRefusal`):
 * CIDR written from its first address, a /16 to /22, inside one private range, clear of the ranges
 * Container Apps reserves and, where the itm8 VPN is built, of the VPN client pool.
 */
export const addressSpaceRefusal = (cidr, { vpnClients = false } = {}) => {
  const range = cidrRange(cidr.trim());
  if (!range) return 'Give an IPv4 range in CIDR form, e.g. 10.20.0.0/21.';
  if (range.bits > 22 || range.bits < 16) return 'Choose a /16 to /22: every subnet of the landing zone needs a /22.';
  if (range.text !== ipText(range.start)) return `Write the range from its first address: ${ipText(range.start)}/${range.bits}.`;
  if (!['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'].some((outer) => within(range, cidrRange(outer)))) {
    return 'Use a private range: inside 10.0.0.0/8, 172.16.0.0/12 or 192.168.0.0/16.';
  }
  const reserved = ['172.30.0.0/16', '172.31.0.0/16'].find((value) => overlaps(range, cidrRange(value)));
  if (reserved) return `Azure Container Apps reserves ${reserved}: choose another range.`;
  if (vpnClients && overlaps(range, cidrRange('172.16.201.0/24'))) {
    return 'The range overlaps the VPN client pool (172.16.201.0/24): choose another range.';
  }
  return null;
};

const FABRIC_CONTENT_LABEL = { lakehouse: 'a lakehouse', medallion: 'the medallion layers', 'semantic-model': 'a semantic model', 'data-agent': 'a data agent' };
/** What a module needs in the same stage: at least one of the listed modules. */
const FABRIC_CONTENT_NEEDS = { 'semantic-model': ['medallion'], 'data-agent': ['lakehouse', 'medallion', 'semantic-model'] };

/**
 * Why the content modules of one Fabric stage cannot be used (Management App `fabricContentIssues`,
 * 2026-11-17): a module without what it reads, a semantic model in a workspace with private access,
 * or a data agent in Red. Empty when they fit.
 */
export const fabricContentRefusals = (modules, { zone, privateAccess = false } = {}) => {
  const out = [];
  for (const module of modules) {
    const needs = FABRIC_CONTENT_NEEDS[module] ?? [];
    if (needs.length && !needs.some((need) => modules.includes(need))) {
      out.push(`The content module ${module} needs ${needs.map((need) => FABRIC_CONTENT_LABEL[need]).join(' or ')} in the same stage.`);
    }
  }
  if (privateAccess && modules.includes('semantic-model')) {
    out.push('A semantic model cannot be in a workspace with private access: Fabric does not support semantic models with workspace-level private link.');
  }
  if (zone === 'red' && modules.includes('data-agent')) {
    out.push('Red data cannot have a Fabric data agent: it answers through a Microsoft-run model service outside the private network.');
  }
  return out;
};

/**
 * Landing zone choices, shared resources and platform kinds (Management App, 2026-11-11), and the
 * Fabric content modules (2026-11-17). Every rule needs one of the new keys (`landingZone`,
 * `platformKinds`, `fabric`, `powerPlatform`), so a spec without them validates exactly as before.
 */
export const sharedResourceFindings = (spec) => {
  const errors = [];
  const blockers = [];
  const warnings = [];
  const landingZone = spec.landingZone;
  if (landingZone?.addressSpace !== undefined) {
    const itm8Vpn = spec.subZone ? spec.subZone === 'red-isolated' : spec.zone === 'red';
    const why = addressSpaceRefusal(landingZone.addressSpace, { vpnClients: itm8Vpn });
    if (why) errors.push(`landingZone.addressSpace: ${why}`);
  }
  const registry = landingZone?.registry;
  if (registry) {
    if (spec.zone !== 'yellow') {
      errors.push(`landingZone.registry: only Yellow chooses its registry here; ${spec.zone === 'red' ? 'Red is always private (Premium, private endpoint, customer-managed key)' : 'Green keeps network.existingRegistryId'}. Do not change the zone yourself.`);
    }
    const id = registry.existingId?.trim() ?? '';
    if (id && !REGISTRY_ID.test(id)) {
      errors.push('landingZone.registry.existingId: give the resource ID of the shared registry: /subscriptions/<id>/resourceGroups/<group>/providers/Microsoft.ContainerRegistry/registries/<name>.');
    }
    const networkId = spec.network?.existingRegistryId?.trim() ?? '';
    if (id && networkId && id.toLowerCase() !== networkId.toLowerCase()) {
      warnings.push({ code: 'registry-id-differs', message: 'landingZone.registry.existingId and network.existingRegistryId name different registries; the Wizard writes one ID to both. Ask; never pick one.' });
    }
  }
  if (landingZone?.sharedResourceGroup) {
    const named = [
      landingZone.registry?.existingId?.trim(),
      spec.network?.existingRegistryId?.trim(),
      spec.network?.gatewayMode === 'existing' ? spec.network.existingGatewayId?.trim() : '',
      spec.edge?.mode === 'existing' ? spec.edge.existingId?.trim() : '',
      spec.foundry?.gateway?.mode === 'existing' ? spec.foundry.gateway.existingId?.trim() : '',
    ].filter(Boolean);
    if (!named.length) {
      warnings.push({ code: 'shared-resource-group-only', message: 'landingZone.sharedResourceGroup is information only and the spec names no shared resource: it is not evidence that a registry, gateway or API Management exists there, and nothing is planned in it.' });
    }
  }
  const kinds = platformKindsOf(spec);
  if (spec.platformKinds && !kinds.includes('azure-apps')) {
    if ((spec.apps ?? []).length) {
      errors.push(`apps: the solution's platform kinds are ${kinds.join(' and ')}, without azure-apps: it has no app. Write a platform plan, not a rebuild, and leave apps empty.`);
    }
    const ignored = ['edge', 'database'].filter((key) => key in spec);
    if (ignored.length) {
      warnings.push({ code: 'no-app-keys-ignored', message: `${ignored.join(' and ')} apply to Azure apps; a solution without azure-apps has none.` });
    }
  }
  if ('fabric' in spec && !kinds.includes('fabric')) errors.push('fabric: a Fabric platform needs the platform kind fabric.');
  for (const stage of Array.isArray(spec.fabric?.stages) ? spec.fabric.stages : []) {
    const modules = Array.isArray(stage?.content) ? stage.content : [];
    for (const why of fabricContentRefusals(modules, { zone: spec.zone, privateAccess: spec.fabric.privateAccess === true })) {
      errors.push(`fabric.stages (${stage.name}) content: ${why} The Wizard refuses it. Ask; never add or drop a module, or change the zone, yourself.`);
    }
  }
  if ('powerPlatform' in spec && !kinds.includes('power-platform')) {
    errors.push('powerPlatform: a Power Platform offering needs the platform kind power-platform.');
  }
  if ((spec.platformKinds?.includes('power-platform') || 'powerPlatform' in spec) && spec.zone === 'red') {
    blockers.push('platformKinds: Power Platform runs up to Yellow until a sandbox proves Sweden-only generative AI and the licensing (Management App). A person decides; do not change the zone or drop the platform yourself.');
  }
  return { errors, blockers, warnings };
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

  // Zone tiers: the edge and the database (Management App tierRefusals and edgeFor, 2026-11-10).
  // Absent keys refuse nothing: specs written before the tiers stay valid.
  for (const message of tierRefusals(spec)) blockers.push(`${message} The current Wizard refuses this; do not change the zone, level or edge yourself.`);
  const environmentEdges = spec.environments.map((environment) => ({ name: environment.name, edge: edgeFor(spec, environment.level) }));
  const direct = environmentEdges.filter((environment) => environment.edge === 'none').map((environment) => environment.name);
  for (const [index, app] of (spec.apps ?? []).entries()) {
    if (app.kind === 'web' && !app.easyAuth && direct.length > 0) {
      errors.push(`apps[${index}].easyAuth: the web app is reached without a gateway in ${direct.join(', ')}; Entra sign-in (Easy Auth) is the protection there and must be on.`);
    }
  }
  if (spec.database === 'cosmos-nosql') {
    for (const [index, app] of (spec.apps ?? []).entries()) {
      const pg = app.settings.filter((setting) => /^PG[A-Z]*$/.test(setting.name)).map((setting) => setting.name);
      if (pg.length) errors.push(`apps[${index}].settings: ${pg.join(', ')} belong to PostgreSQL; with Cosmos DB the app template sets AZURE_COSMOS_ENDPOINT and AZURE_COSMOS_DATABASE and there is no PostgreSQL.`);
    }
    if ((spec.apps ?? []).some((app) => app.migrationJob)) {
      warn('cosmos-migration-job', 'Cosmos DB has no schema to migrate: the app template creates the containers. Keep the migration job only if it seeds or reshapes data.');
    }
  }

  // Foundry Premium's AI gateway (Management App aiGatewayRefusals, 2026-11-10).
  if (spec.foundry?.gateway) {
    if (!spec.foundry.enabled || (spec.foundry.level ?? 'basic') !== 'premium') {
      warn('ai-gateway-ignored', 'foundry.gateway applies to Foundry Premium only; the Wizard ignores it otherwise.');
    } else {
      for (const message of aiGatewayRefusals(spec)) blockers.push(`foundry.gateway: ${message}`);
    }
  }

  // Landing zone choices, shared resources and platform kinds (Management App, 2026-11-11).
  const shared = sharedResourceFindings(spec);
  errors.push(...shared.errors);
  blockers.push(...shared.blockers);
  warnings.push(...shared.warnings);

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
    for (const [index, app] of (spec.apps ?? []).entries()) {
      const keys = app.settings.filter((setting) => AI_KEY_SETTING.test(setting.name)).map((setting) => setting.name);
      if (keys.length) errors.push(`apps[${index}].settings: ${keys.join(', ')}: Foundry Premium apps call the AI gateway with their managed identity; there is no model or gateway key.`);
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