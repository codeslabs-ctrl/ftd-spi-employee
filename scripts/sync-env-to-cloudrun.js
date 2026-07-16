#!/usr/bin/env node
/**
 * Cloud Run analog of the archetype sync-env-to-yaml.js.
 *
 * Reads a local env file (default .env.production), splits secrets vs plain env,
 * ignores HOST/PORT/FAKE_DB, and prints (or applies) a gcloud run services update
 * so ops can change config without rebuilding the image / Nest code.
 *
 * Usage:
 *   node scripts/sync-env-to-cloudrun.js                 # dry-run (default)
 *   node scripts/sync-env-to-cloudrun.js --apply          # execute gcloud
 *   node scripts/sync-env-to-cloudrun.js --env=.env.gcp
 *   node scripts/sync-env-to-cloudrun.js --region=us-east1 --service=ftd-spi-employee
 *
 * Never logs secret values (dry-run redacts them).
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const SECRET_KEYS = new Set([
  'JWT_PRIVATE_KEY_BASE64',
  'JWT_PUBLIC_KEY_BASE64',
  'DB_VE_PASSWORD',
  'DB_CO_PASSWORD',
  'DB_AR_PASSWORD',
  'API_CLIENTS_JSON',
  'PAYLOAD_ENCRYPTION_KEY',
]);

/** Secret Manager resource names (must already exist / be versioned by ops). */
const SECRET_RESOURCE = {
  JWT_PRIVATE_KEY_BASE64: 'jwt-private-key',
  JWT_PUBLIC_KEY_BASE64: 'jwt-public-key',
  DB_VE_PASSWORD: 'db-ve-password',
  DB_CO_PASSWORD: 'db-co-password',
  DB_AR_PASSWORD: 'db-ar-password',
  API_CLIENTS_JSON: 'api-clients',
  PAYLOAD_ENCRYPTION_KEY: 'payload-encryption-key',
};

const IGNORE_KEYS = new Set(['HOST', 'PORT', 'FAKE_DB']);

function parseArgs(argv) {
  const out = {
    apply: false,
    envFile: '.env.production',
    region: process.env.CLOUD_RUN_REGION || 'us-east1',
    service: process.env.CLOUD_RUN_SERVICE || 'ftd-spi-employee',
  };
  for (const arg of argv) {
    if (arg === '--apply') out.apply = true;
    else if (arg.startsWith('--env=')) out.envFile = arg.slice('--env='.length);
    else if (arg.startsWith('--region=')) out.region = arg.slice('--region='.length);
    else if (arg.startsWith('--service='))
      out.service = arg.slice('--service='.length);
  }
  return out;
}

function parseEnvFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const vars = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return vars;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const envPath = path.resolve(process.cwd(), opts.envFile);

  if (!fs.existsSync(envPath)) {
    console.error(
      `No se encontró ${opts.envFile}. Crea el archivo (gitignore) o usa --env=<path>.`,
    );
    process.exit(1);
  }

  const all = parseEnvFile(envPath);
  const plain = {};
  const secretKeysPresent = [];

  for (const [key, value] of Object.entries(all)) {
    if (IGNORE_KEYS.has(key)) continue;
    if (value === undefined || value === '') continue;
    if (SECRET_KEYS.has(key)) {
      if (!SECRET_RESOURCE[key]) {
        console.error(`No hay mapeo Secret Manager para ${key}`);
        process.exit(1);
      }
      secretKeysPresent.push(key);
      continue;
    }
    plain[key] = value;
  }

  // Force production semantics on Cloud Run
  plain.NODE_ENV = plain.NODE_ENV || 'production';

  const secretPairs = secretKeysPresent.map(
    (k) => `${k}=${SECRET_RESOURCE[k]}:latest`,
  );

  // ^@^ delimiter so CORS_ORIGINS (and similar) may contain commas
  const envPairs = Object.entries(plain).map(([k, v]) => `${k}=${v}`);
  const setEnvVars =
    envPairs.length > 0 ? `^@^${envPairs.join('@')}` : undefined;
  const setSecrets =
    secretPairs.length > 0 ? secretPairs.join(',') : undefined;

  const args = [
    'run',
    'services',
    'update',
    opts.service,
    `--region=${opts.region}`,
    '--platform=managed',
  ];
  if (setEnvVars) args.push(`--update-env-vars=${setEnvVars}`);
  if (setSecrets) args.push(`--update-secrets=${setSecrets}`);

  if (!setEnvVars && !setSecrets) {
    console.error('Nada que actualizar (archivo vacío o solo HOST/PORT/FAKE_DB).');
    process.exit(1);
  }

  console.log('# Dry-run / comando (secret values nunca se imprimen):\n');
  console.log(`gcloud ${args.join(' \\\n  ')}\n`);
  console.log('# Plain env keys:', Object.keys(plain).join(', ') || '(none)');
  console.log(
    '# Secret mounts (names only):',
    secretKeysPresent.map((k) => `${k}→${SECRET_RESOURCE[k]}`).join(', ') ||
      '(none)',
  );
  console.log(
    '\n# Nota: --update-secrets solo re-monta :latest. Sube una nueva versión del',
  );
  console.log('# secreto en Secret Manager antes de aplicar si cambió el valor.\n');

  if (!opts.apply) {
    console.log('Dry-run OK. Pasa --apply para ejecutar gcloud.');
    return;
  }

  const result = spawnSync('gcloud', args, { stdio: 'inherit', shell: false });
  process.exit(result.status ?? 1);
}

main();
