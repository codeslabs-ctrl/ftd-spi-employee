/**
 * Builds postman/ftd-spi-catalogs.postman_collection.json — un request P2C
 * (cifrado) por catálogo (12), mismo patrón que
 * build-additional-crud-postman.js (RequestJson urlencoded + ResponseJson
 * descifrado en el test). Se cambió de JSON plano a cifrado porque el
 * ambiente real donde se está probando tiene REQUIRE_ENCRYPTED_PAYLOAD=true
 * y rechaza (400) cualquier request sin RequestJson — el middleware de
 * cifrado es global, aplica igual a /catalogs que al resto de rutas de
 * negocio, así que no hace falta nada especial del lado Node para esto.
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
  { key: 'termination-reasons', label: 'Termination reasons (causales de retiro)' },
  { key: 'change-reasons', label: 'Change reasons (motivos de cambio)' },
  { key: 'pension-funds', label: 'Pension funds / AFP (solo Colombia)' },
  { key: 'health-providers', label: 'Health providers / EPS (solo Colombia)' },
  { key: 'compensation-funds', label: 'Compensation funds / Caja de Compensación (solo Colombia)' },
  { key: 'severance-funds', label: 'Severance funds / Fondo de Cesantías (solo Colombia)' },
  { key: 'contract-types', label: 'Contract types (Contrato)' },
];

const authHeaders = [
  { key: 'Content-Type', value: 'application/x-www-form-urlencoded' },
  { key: 'Authorization', value: 'Bearer {{token}}' },
  { key: 'X-Country-Code', value: 'CO' },
];

const jsonHeaders = [
  { key: 'Content-Type', value: 'application/json' },
  { key: 'Authorization', value: 'Bearer {{token}}' },
  { key: 'X-Country-Code', value: 'CO' },
];

function encItem(name, urlPath, payloadSource, status, assertLines) {
  const pre = [
    ...payloadSource,
    "const key = pm.collectionVariables.get('payloadKey');",
    '// Igual que el front: CryptoJS.AES.encrypt(JSON.stringify(data), KEY).toString()',
    'const cipher = CryptoJS.AES.encrypt(JSON.stringify(payload), key).toString();',
    "pm.collectionVariables.set('encRequest', cipher);",
    "console.log('RequestJson (cifrado):', cipher.slice(0, 24) + '...');",
  ];

  const tests = [
    `pm.test('status ${status}', () => pm.response.to.have.status(${status}));`,
    "const key = pm.collectionVariables.get('payloadKey');",
    'const enc = pm.response.json().ResponseJson;',
    "pm.test('respuesta viene cifrada (ResponseJson)', () => pm.expect(enc).to.be.a('string'));",
    'const clear = JSON.parse(CryptoJS.AES.decrypt(enc, key).toString(CryptoJS.enc.Utf8));',
    "console.log('ResponseJson (descifrado):', clear);",
    ...assertLines,
  ];

  return {
    name,
    event: [
      { listen: 'prerequest', script: { type: 'text/javascript', exec: pre } },
      { listen: 'test', script: { type: 'text/javascript', exec: tests } },
    ],
    request: {
      method: 'POST',
      header: authHeaders,
      url: `{{baseUrl}}/ftd-spi-employee/rest/${urlPath}`,
      body: {
        mode: 'urlencoded',
        urlencoded: [{ key: 'RequestJson', value: '{{encRequest}}' }],
      },
    },
  };
}

function invalidCipher(urlPath) {
  return {
    name: 'Invalid cipher (400)',
    event: [
      {
        listen: 'test',
        script: {
          type: 'text/javascript',
          exec: ["pm.test('status 400', () => pm.response.to.have.status(400));"],
        },
      },
    ],
    request: {
      method: 'POST',
      header: authHeaders,
      url: `{{baseUrl}}/ftd-spi-employee/rest/${urlPath}`,
      body: {
        mode: 'urlencoded',
        urlencoded: [{ key: 'RequestJson', value: 'not-a-valid-cipher' }],
      },
    },
  };
}

function listItem(def) {
  return encItem(
    `List ${def.label} (encrypted 200)`,
    `catalogs/${def.key}/list`,
    ['const payload = { page: 1, size: 20 };'],
    200,
    [
      "pm.test('trae paginacion', () => pm.expect(clear.page).to.eql(1));",
      "pm.test('items es array', () => pm.expect(clear.items).to.be.an('array'));",
    ],
  );
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
      'Mismo patrón P2C que Employee/Additional CRUD: el folder Catalogs cifra ' +
      'el body en RequestJson (urlencoded) y descifra ResponseJson en el test. ' +
      'Variables: {{baseUrl}}, {{clientId}}, {{clientSecret}}, {{payloadKey}}. ' +
      'Ejecutar Auth > Get Token primero.\n\n' +
      '{{payloadKey}} debe coincidir con PAYLOAD_ENCRYPTION_KEY del backend. ' +
      'Si el ambiente tiene REQUIRE_ENCRYPTED_PAYLOAD=true, un request sin ' +
      'RequestJson responde 400 "Encrypted payload required" — por eso esta ' +
      'colección va cifrada por defecto (antes iba en JSON plano).',
  },
  variable: [
    { key: 'baseUrl', value: 'http://localhost:8080' },
    { key: 'clientId', value: 'hr-integration' },
    { key: 'clientSecret', value: 'local-secret-2026' },
    { key: 'payloadKey', value: 'portal-shared-key-2026' },
    { key: 'token', value: '' },
    { key: 'encRequest', value: '' },
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
      name: 'Catalogs (P2C, cifrado)',
      description:
        'Cifrado de payload con CryptoJS.AES. Pre-request cifra en RequestJson; test descifra ResponseJson.',
      item: [...CATALOGS.map(listItem), invalidCipher('catalogs/countries/list')],
    },
    {
      name: 'Validate reentry (P2C, cifrado)',
      description:
        'PRC_VALIDATE_REENTRY — único endpoint de catalogs que escribe (corrige FTD_INGRESOS si hace falta).',
      item: [
        encItem(
          'Validate reentry — declared SI, no exists -> corrige a NO (200)',
          'catalogs/validate-reentry',
          ["const payload = { numIden: '1234567890', reingreso: 'SI' };"],
          200,
          [
            "pm.test('respuesta trae reingreso final', () => pm.expect(clear.reingreso).to.be.oneOf(['SI', 'NO']));",
            "pm.test('respuesta trae flag corrected', () => pm.expect(clear.corrected).to.be.a('boolean'));",
          ],
        ),
        invalidCipher('catalogs/validate-reentry'),
      ],
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
              { key: 'X-Country-Code', value: 'CO' },
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
