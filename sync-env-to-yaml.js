#!/usr/bin/env node
/**
 * Archetype sync: .env.production → app.yaml env_variables (strips HOST/PORT).
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const ENV_FILE = process.argv[2] || '.env.production';
const APP_YAML = 'app.yaml';
const TEMPLATE = 'app.template.yaml';

const envPath = path.resolve(process.cwd(), ENV_FILE);
const yamlPath = path.resolve(process.cwd(), APP_YAML);
const templatePath = path.resolve(process.cwd(), TEMPLATE);

if (!fs.existsSync(envPath)) {
  console.error(`No se encontró ${ENV_FILE}`);
  process.exit(1);
}

if (!fs.existsSync(yamlPath)) {
  if (fs.existsSync(templatePath)) {
    fs.copyFileSync(templatePath, yamlPath);
    console.log(`Creado ${APP_YAML} desde ${TEMPLATE}`);
  } else {
    console.error(`No se encontró ${APP_YAML} ni ${TEMPLATE}`);
    process.exit(1);
  }
}

const envVars = dotenv.parse(fs.readFileSync(envPath));
delete envVars.HOST;
delete envVars.PORT;
delete envVars.FAKE_DB;

const envYaml = Object.entries(envVars)
  .map(([k, v]) => {
    const needsQuote =
      v === '' || /[:#\[\]{},&*?|<>=!%@`]/.test(v) || /^\s|\s$/.test(v);
    const rendered = needsQuote ? JSON.stringify(v) : v;
    return `  ${k}: ${rendered}`;
  })
  .join('\n');

let yaml = fs.readFileSync(yamlPath, 'utf8');
if (!/env_variables:\s*\n/.test(yaml)) {
  yaml = yaml.trimEnd() + '\nenv_variables:\n';
}

yaml = yaml.replace(
  /env_variables:\n([\s\S]*?)(?=\n\S|$)/,
  `env_variables:\n${envYaml}\n`,
);

fs.writeFileSync(yamlPath, yaml, 'utf8');
console.log(`${APP_YAML} actualizado desde ${ENV_FILE} (HOST/PORT/FAKE_DB omitidos)`);
