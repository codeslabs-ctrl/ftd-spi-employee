/**
 * Builds postman/ftd-spi-pagination-flag.postman_collection.json —
 * colección dedicada a verificar EN VIVO el flag `paginate` agregado a
 * TODOS los endpoints de listado (pedido de PeopleOne, correo Andros/
 * Raymond 2026-09-23: llenar un comboBox contra un endpoint paginado no es
 * viable porque no saben si hay más datos).
 *
 * Contrato:
 *   - `paginate` es OPCIONAL. Si se omite, o se manda true, el
 *     comportamiento es EXACTAMENTE el de siempre (page/size respetados).
 *   - `paginate: false` ignora page/size y devuelve TODOS los registros en
 *     un solo response. La respuesta siempre trae el campo `paginate`
 *     (true/false) para que el consumidor sepa qué modo se usó.
 *
 * Mismo patrón P2C (cifrado) que ftd-spi-catalogs / ftd-spi-additional-crud:
 * el ambiente real tiene REQUIRE_ENCRYPTED_PAYLOAD=true y rechaza (400)
 * cualquier request sin RequestJson.
 *
 * No repite el resto de la superficie de cada módulo (eso ya lo cubren
 * ftd-spi-catalogs, ftd-spi-additional-crud y ftd-spi-employee) — esta
 * colección solo prueba el flag nuevo. Ejecutar "Auth > Get Token" primero.
 */
const fs = require('fs');
const path = require('path');

const authHeaders = [
  { key: 'Content-Type', value: 'application/x-www-form-urlencoded' },
  { key: 'Authorization', value: 'Bearer {{token}}' },
  { key: 'X-Country-Code', value: 'VE' },
];

function encItem(name, urlPath, payloadSource, status, assertLines) {
  const pre = [
    ...payloadSource,
    "const key = pm.collectionVariables.get('payloadKey');",
    'const cipher = CryptoJS.AES.encrypt(JSON.stringify(payload), key).toString();',
    "pm.collectionVariables.set('encRequest', cipher);",
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

const collection = {
  info: {
    name: 'FTD SPI Pagination Flag (PeopleOne 2026-09-23)',
    schema:
      'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    description:
      'Verifica el flag `paginate` en los endpoints de listado: default ' +
      '(omitido) = paginado de siempre; `paginate:false` = devuelve todo, ' +
      'ignora page/size, y la respuesta trae `paginate:false`. Pedido de ' +
      'PeopleOne para poblar comboBox sin tener que paginar dentro del ' +
      'combo. Mismo patrón P2C (cifrado) que ftd-spi-catalogs: pre-request ' +
      'cifra en RequestJson, el test descifra ResponseJson. {{payloadKey}} ' +
      'debe coincidir con PAYLOAD_ENCRYPTION_KEY del backend. Ejecutar ' +
      'Auth > Get Token primero. No repite el resto de la API — ver ' +
      'ftd-spi-catalogs.postman_collection.json y ' +
      'ftd-spi-additional-crud.postman_collection.json.',
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
      name: '1. Default (sin flag) = comportamiento paginado de siempre',
      item: [
        encItem(
          'catalogs/countries/list sin paginate -> paginado normal',
          'catalogs/countries/list',
          ['const payload = { page: 1, size: 1 };'],
          200,
          [
            "pm.test('paginate:true por defecto', () => pm.expect(clear.paginate).to.eql(true));",
            "pm.test('respeta size', () => pm.expect(clear.items.length).to.be.at.most(1));",
          ],
        ),
      ],
    },
    {
      name: '2. paginate:false devuelve todo, ignora page/size',
      item: [
        encItem(
          'catalogs/countries/list con paginate:false -> todos los países en un response',
          'catalogs/countries/list',
          ['const payload = { page: 1, size: 1, paginate: false };'],
          200,
          [
            "pm.test('paginate:false en la respuesta', () => pm.expect(clear.paginate).to.eql(false));",
            "pm.test('trae más de 1 (ignoró size:1)', () => pm.expect(clear.items.length).to.be.above(1));",
            "pm.test('size refleja el total devuelto', () => pm.expect(clear.size).to.eql(clear.items.length));",
          ],
        ),
        encItem(
          'employee/list con paginate:false -> todos los empleados en un response',
          'employee/list',
          ['const payload = { page: 1, size: 1, paginate: false };'],
          200,
          [
            "pm.test('paginate:false en la respuesta', () => pm.expect(clear.paginate).to.eql(false));",
          ],
        ),
        encItem(
          'company/list con paginate:false -> todas las compañías en un response',
          'company/list',
          ['const payload = { paginate: false };'],
          200,
          [
            "pm.test('paginate:false en la respuesta', () => pm.expect(clear.paginate).to.eql(false));",
          ],
        ),
        encItem(
          'position/list con paginate:false -> respeta companyId, ignora size',
          'position/list',
          ["const payload = { companyId: '1', paginate: false };"],
          200,
          [
            "pm.test('paginate:false en la respuesta', () => pm.expect(clear.paginate).to.eql(false));",
          ],
        ),
        encItem(
          'job-post/list con paginate:false',
          'job-post/list',
          ['const payload = { paginate: false };'],
          200,
          [
            "pm.test('paginate:false en la respuesta', () => pm.expect(clear.paginate).to.eql(false));",
          ],
        ),
        encItem(
          'org-unit/list con paginate:false',
          'org-unit/list',
          ['const payload = { paginate: false };'],
          200,
          [
            "pm.test('paginate:false en la respuesta', () => pm.expect(clear.paginate).to.eql(false));",
          ],
        ),
        encItem(
          'marital-status/list con paginate:false',
          'marital-status/list',
          ['const payload = { paginate: false };'],
          200,
          [
            "pm.test('paginate:false en la respuesta', () => pm.expect(clear.paginate).to.eql(false));",
          ],
        ),
      ],
    },
  ],
};

const out = path.join(
  __dirname,
  '..',
  'postman',
  'ftd-spi-pagination-flag.postman_collection.json',
);
fs.writeFileSync(out, JSON.stringify(collection, null, 2) + '\n');
console.log('Wrote', out);
