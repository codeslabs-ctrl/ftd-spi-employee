/**
 * Builds postman/ftd-spi-catalogs.postman_collection.json — un request por
 * catálogo (12), en JSON plano (sin P2C: son catálogos de solo lectura, sin
 * PII). El cifrado P2C sigue funcionando igual si se manda RequestJson,
 * porque payload-crypto.middleware aplica global a todas las rutas de
 * negocio — no hace falta nada especial para soportarlo, solo no se ejercita
 * en esta colección.
 */
const fs = require('fs');
const path = require('path');

const CATALOGS = [
  { key: 'municipalities', label: 'Municipalities (Municipios)' },
  { key: 'countries', label: 'Countries (Países)' },
  { key: 'parishes', label: 'Parishes (Parroquias)' },
  { key: 'localities', label: 'Localities (Localidades)' },
  { key: 'cities', label: 'Cities (validación de ciudad)' },
  { key: 'states', label: 'States (entidades federales)' },
  { key: 'payroll-types', label: 'Payroll types (tipos de nómina)' },
  { key: 'groups', label: 'Groups (grupos)' },
  { key: 'branches', label: 'Branches (sucursales)' },
  { key: 'banks', label: 'Banks (validación de banco)' },
  { key: 'account-types', label: 'Account types (tipos de cuenta)' },
  { key: 'id-types', label: 'ID types (tipos de identificación)' },
];

const jsonHeaders = [
  { key: 'Content-Type', value: 'application/json' },
  { key: 'Authorization', value: 'Bearer {{token}}' },
  { key: 'X-Country-Code', value: 'VE' },
];

function listItem(def) {
  return {
    name: `List ${def.label} (200)`,
    event: [
      {
        listen: 'test',
        script: {
          type: 'text/javascript',
          exec: [
            "pm.test('status 200', () => pm.response.to.have.status(200));",
            "pm.test('trae paginacion', () => pm.expect(pm.response.json().page).to.eql(1));",
            "pm.test('items es array', () => pm.expect(pm.response.json().items).to.be.an('array'));",
          ],
        },
      },
    ],
    request: {
      method: 'POST',
      header: jsonHeaders,
      url: `{{baseUrl}}/ftd-spi-employee/rest/catalogs/${def.key}/list`,
      body: { mode: 'raw', raw: '{\n  "page": 1,\n  "size": 20\n}' },
    },
  };
}

const collection = {
  info: {
    name: 'FTD SPI Catalogs',
    schema:
      'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    description:
      '12 catálogos de solo lectura, un solo paquete Oracle compartido ' +
      '(pkg_management_catalogs). Todos con el mismo contrato: ' +
      'POST /catalogs/<key>/list con { page, size } -> { page, size, items }.\n\n' +
      'Variables: {{baseUrl}}, {{clientId}}, {{clientSecret}}. Ejecutar ' +
      'Auth > Get Token primero. Soporta cifrado P2C igual que el resto del ' +
      'API (no ejercitado aquí, ver colección Employee para el patrón).',
  },
  variable: [
    { key: 'baseUrl', value: 'http://localhost:8080' },
    { key: 'clientId', value: 'hr-integration' },
    { key: 'clientSecret', value: 'local-secret-2026' },
    { key: 'token', value: '' },
  ],
  item: [
    {
      name: 'Auth',
      item: [
        {
          name: 'Get Token (200)',
          event: [
            {
              listen: 'test',
              script: {
                type: 'text/javascript',
                exec: [
                  "pm.test('status 200', () => pm.response.to.have.status(200));",
                  "pm.collectionVariables.set('token', pm.response.json().access_token);",
                ],
              },
            },
          ],
          request: {
            method: 'POST',
            header: [{ key: 'Content-Type', value: 'application/json' }],
            url: '{{baseUrl}}/ftd-spi-employee/rest/security/token',
            body: {
              mode: 'raw',
              raw: '{\n  "client_id": "{{clientId}}",\n  "client_secret": "{{clientSecret}}"\n}',
            },
          },
        },
      ],
    },
    {
      name: 'Catalogs',
      item: CATALOGS.map(listItem),
    },
    {
      name: 'Negative cases',
      item: [
        {
          name: 'No token (401)',
          event: [
            {
              listen: 'test',
              script: {
                type: 'text/javascript',
                exec: [
                  "pm.test('status 401', () => pm.response.to.have.status(401));",
                ],
              },
            },
          ],
          request: {
            method: 'POST',
            header: [
              { key: 'Content-Type', value: 'application/json' },
              { key: 'X-Country-Code', value: 'VE' },
            ],
            url: '{{baseUrl}}/ftd-spi-employee/rest/catalogs/countries/list',
            body: { mode: 'raw', raw: '{}' },
          },
        },
        {
          name: 'Missing X-Country-Code (400)',
          event: [
            {
              listen: 'test',
              script: {
                type: 'text/javascript',
                exec: [
                  "pm.test('status 400', () => pm.response.to.have.status(400));",
                ],
              },
            },
          ],
          request: {
            method: 'POST',
            header: [
              { key: 'Content-Type', value: 'application/json' },
              { key: 'Authorization', value: 'Bearer {{token}}' },
            ],
            url: '{{baseUrl}}/ftd-spi-employee/rest/catalogs/countries/list',
            body: { mode: 'raw', raw: '{}' },
          },
        },
        {
          name: 'Country not enabled AR (422)',
          event: [
            {
              listen: 'test',
              script: {
                type: 'text/javascript',
                exec: [
                  "pm.test('status 422', () => pm.response.to.have.status(422));",
                ],
              },
            },
          ],
          request: {
            method: 'POST',
            header: [
              { key: 'Content-Type', value: 'application/json' },
              { key: 'Authorization', value: 'Bearer {{token}}' },
              { key: 'X-Country-Code', value: 'AR' },
            ],
            url: '{{baseUrl}}/ftd-spi-employee/rest/catalogs/countries/list',
            body: { mode: 'raw', raw: '{}' },
          },
        },
        {
          name: 'Unknown catalog key (404)',
          event: [
            {
              listen: 'test',
              script: {
                type: 'text/javascript',
                exec: [
                  "pm.test('status 404', () => pm.response.to.have.status(404));",
                ],
              },
            },
          ],
          request: {
            method: 'POST',
            header: jsonHeaders,
            url: '{{baseUrl}}/ftd-spi-employee/rest/catalogs/does-not-exist/list',
            body: { mode: 'raw', raw: '{}' },
          },
        },
      ],
    },
  ],
};

const out = path.join(
  __dirname,
  '..',
  'postman',
  'ftd-spi-catalogs.postman_collection.json',
);
fs.writeFileSync(out, JSON.stringify(collection, null, 2) + '\n');
console.log('Wrote', out);
