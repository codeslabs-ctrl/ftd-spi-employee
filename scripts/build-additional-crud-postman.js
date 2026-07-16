/**
 * Builds postman/ftd-spi-additional-crud.postman_collection.json
 * mirroring Employee (P2C): urlencoded RequestJson + decrypt ResponseJson.
 */
const fs = require('fs');
const path = require('path');

const authHeaders = [
  { key: 'Content-Type', value: 'application/x-www-form-urlencoded' },
  { key: 'Authorization', value: 'Bearer {{token}}' },
  { key: 'X-Country-Code', value: 'VE' },
];

const jsonHeaders = [
  { key: 'Content-Type', value: 'application/json' },
  { key: 'Authorization', value: 'Bearer {{token}}' },
  { key: 'X-Country-Code', value: 'VE' },
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

  const tests =
    status === 204
      ? [
          `pm.test('status ${status}', () => pm.response.to.have.status(${status}));`,
        ]
      : [
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
      {
        listen: 'prerequest',
        script: { type: 'text/javascript', exec: pre },
      },
      {
        listen: 'test',
        script: { type: 'text/javascript', exec: tests },
      },
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

function plainNeg(name, urlPath, body, status, extraTests = []) {
  return {
    name,
    event: [
      {
        listen: 'test',
        script: {
          type: 'text/javascript',
          exec: [
            `pm.test('status ${status}', () => pm.response.to.have.status(${status}));`,
            ...extraTests,
          ],
        },
      },
    ],
    request: {
      method: 'POST',
      header: jsonHeaders,
      url: `{{baseUrl}}/ftd-spi-employee/rest/${urlPath}`,
      body: { mode: 'raw', raw: JSON.stringify(body, null, 2) },
    },
  };
}

const collection = {
  info: {
    name: 'FTD SPI Additional CRUD',
    schema:
      'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    description:
      'CRUD adicionales SPI (position, company, marital-status, job-post, org-unit).\n\n' +
      'Misma estructura P2C que Employee: folders *(P2C, cifrado)* cifran el body en RequestJson ' +
      '(urlencoded) y descifran ResponseJson en el test. Variables: {{baseUrl}}, {{clientId}}, ' +
      '{{clientSecret}}, {{payloadKey}}. Ejecutar Auth > Get Token primero.\n\n' +
      '{{payloadKey}} debe coincidir con PAYLOAD_ENCRYPTION_KEY del backend.',
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
                  "pm.test('expires_in is 12h', () => pm.expect(pm.response.json().expires_in).to.eql(43200));",
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
        {
          name: 'Get Token wrong secret (401)',
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
            header: [{ key: 'Content-Type', value: 'application/json' }],
            url: '{{baseUrl}}/ftd-spi-employee/rest/security/token',
            body: {
              mode: 'raw',
              raw: '{\n  "client_id": "{{clientId}}",\n  "client_secret": "wrong"\n}',
            },
          },
        },
      ],
    },
    {
      name: 'Position (P2C, cifrado)',
      description:
        'Cifrado de payload con CryptoJS.AES igual que Employee. Pre-request cifra en RequestJson; test descifra ResponseJson.',
      item: [
        encItem(
          'Create position (encrypted 201)',
          'position/create',
          [
            'const payload = {',
            "  companyId: '1', id: '88', name: 'Cargo P2C',",
            "  description: 'Creado cifrado', risk: 'Bajo'",
            '};',
          ],
          201,
          [
            "pm.test('companyId/id correctos tras descifrar', () => {",
            "  pm.expect(clear.companyId).to.eql('1');",
            "  pm.expect(clear.id).to.eql('88');",
            '});',
          ],
        ),
        encItem(
          'Get position (encrypted 200)',
          'position/get',
          ["const payload = { companyId: '1', id: '88' };"],
          200,
          [
            "pm.test('name correcto', () => pm.expect(clear.name).to.eql('Cargo P2C'));",
          ],
        ),
        encItem(
          'List positions (encrypted 200)',
          'position/list',
          ['const payload = { page: 1, size: 20, companyId: \'1\' };'],
          200,
          [
            "pm.test('trae paginacion', () => pm.expect(clear.page).to.eql(1));",
            "pm.test('items es array', () => pm.expect(clear.items).to.be.an('array'));",
          ],
        ),
        encItem(
          'Update position (encrypted 200)',
          'position/update',
          [
            'const payload = {',
            "  companyId: '1', id: '88', name: 'Cargo P2C Actualizado'",
            '};',
          ],
          200,
          [
            "pm.test('name actualizado', () => pm.expect(clear.name).to.eql('Cargo P2C Actualizado'));",
          ],
        ),
        invalidCipher('position/create'),
      ],
    },
    {
      name: 'Company (P2C, cifrado)',
      description:
        'Cifrado de payload con CryptoJS.AES. Pre-request cifra en RequestJson; test descifra ResponseJson.',
      item: [
        encItem(
          'List companies (encrypted 200)',
          'company/list',
          ['const payload = { page: 1, size: 20 };'],
          200,
          [
            "pm.test('trae paginacion', () => pm.expect(clear.page).to.eql(1));",
            "pm.test('items es array', () => pm.expect(clear.items).to.be.an('array'));",
          ],
        ),
        encItem(
          'Get company (encrypted 200)',
          'company/get',
          ["const payload = { id: '1' };"],
          200,
          ["pm.test('id correcto', () => pm.expect(clear.id).to.eql('1'));"],
        ),
        invalidCipher('company/get'),
      ],
    },
    {
      name: 'Marital Status (P2C, cifrado)',
      description:
        'Cifrado de payload con CryptoJS.AES. Pre-request cifra en RequestJson; test descifra ResponseJson.',
      item: [
        encItem(
          'List marital statuses (encrypted 200)',
          'marital-status/list',
          ['const payload = { page: 1, size: 20 };'],
          200,
          [
            "pm.test('trae paginacion', () => pm.expect(clear.page).to.eql(1));",
            "pm.test('items es array', () => pm.expect(clear.items).to.be.an('array'));",
          ],
        ),
        invalidCipher('marital-status/list'),
      ],
    },
    {
      name: 'Job Post (P2C, cifrado)',
      description:
        'Cifrado de payload con CryptoJS.AES. Pre-request cifra en RequestJson; test descifra ResponseJson.',
      item: [
        encItem(
          'List job posts (encrypted 200)',
          'job-post/list',
          ["const payload = { page: 1, size: 20, companyId: '1' };"],
          200,
          [
            "pm.test('trae paginacion', () => pm.expect(clear.page).to.eql(1));",
            "pm.test('items es array', () => pm.expect(clear.items).to.be.an('array'));",
          ],
        ),
        encItem(
          'Get job post (encrypted 200)',
          'job-post/get',
          ["const payload = { companyId: '1', unitId: '10', id: '100' };"],
          200,
          [
            "pm.test('id correcto', () => pm.expect(clear.id).to.eql('100'));",
          ],
        ),
        invalidCipher('job-post/get'),
      ],
    },
    {
      name: 'Org Unit (P2C, cifrado)',
      description:
        'Cifrado de payload con CryptoJS.AES. Pre-request cifra en RequestJson; test descifra ResponseJson.',
      item: [
        encItem(
          'List org units (encrypted 200)',
          'org-unit/list',
          ["const payload = { page: 1, size: 20, companyId: '1' };"],
          200,
          [
            "pm.test('trae paginacion', () => pm.expect(clear.page).to.eql(1));",
            "pm.test('items es array', () => pm.expect(clear.items).to.be.an('array'));",
          ],
        ),
        encItem(
          'Get org unit (encrypted 200)',
          'org-unit/get',
          ["const payload = { companyId: '1', id: '10' };"],
          200,
          ["pm.test('id correcto', () => pm.expect(clear.id).to.eql('10'));"],
        ),
        invalidCipher('org-unit/get'),
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
              { key: 'X-Country-Code', value: 'VE' },
            ],
            url: '{{baseUrl}}/ftd-spi-employee/rest/position/get',
            body: {
              mode: 'raw',
              raw: '{\n  "companyId": "1",\n  "id": "88"\n}',
            },
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
            url: '{{baseUrl}}/ftd-spi-employee/rest/company/list',
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
            url: '{{baseUrl}}/ftd-spi-employee/rest/marital-status/list',
            body: { mode: 'raw', raw: '{}' },
          },
        },
        plainNeg(
          'Invalid body position (400)',
          'position/create',
          { companyId: '' },
          400,
          [
            "pm.test('per-field errors', () => pm.expect(pm.response.json().errors.length).to.be.above(0));",
          ],
        ),
        plainNeg(
          'Duplicate position create (409)',
          'position/create',
          { companyId: '1', id: '88', name: 'Dup' },
          409,
        ),
      ],
    },
  ],
};

const out = path.join(
  __dirname,
  '..',
  'postman',
  'ftd-spi-additional-crud.postman_collection.json',
);
fs.writeFileSync(out, JSON.stringify(collection, null, 2) + '\n');
console.log('Wrote', out);
