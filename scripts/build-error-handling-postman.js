/**
 * Builds postman/ftd-spi-error-handling.postman_collection.json — colección
 * dedicada a validar el manejo de errores en español (PKG_GLOBAL_ERRORS +
 * la capa Node en español de catalogs, src/shared/oracle/catalog-pkg-assert.ts).
 *
 * IMPORTANTE — alcance realista: la mayoría de los códigos Oracle que
 * PKG_GLOBAL_ERRORS traduce (tabla no existe -942, columna inválida -904,
 * usuario/clave -1017, timeout/pérdida de conexión, deadlock/bloqueo,
 * buffer PL/SQL -6502...) son fallas de esquema/infraestructura que NO se
 * pueden forzar de forma determinística mandando un request HTTP bien
 * formado — Node ya valida tipos/campos obligatorios (DTOs) antes de que el
 * request llegue a Oracle, así que esos códigos son una red de seguridad
 * para fallas reales de infraestructura, no algo reproducible en un test
 * end-to-end limpio. Esta colección se enfoca en los caminos de error que
 * SÍ son alcanzables de punta a punta vía la API real:
 *   1) Casos negativos de auth/cifrado (401/400/422) — ya existían en
 *      ftd-spi-catalogs, se repiten aquí para tener todo el manejo de
 *      errores en un solo lugar.
 *   2) "Sin registros" (422, PKG_GLOBAL_CONSTANTS.GC_MENSAJE_SIN_REGISTROS)
 *      — companyId que no existe en catálogos scoped por compañía.
 *   3) Validaciones de negocio de validate-reentry (400, class-validator).
 *   4) Catálogo desconocido (404).
 *
 * Para probar los códigos Oracle de esquema/infraestructura (ej. -942, -904,
 * -1017) hay que forzarlos directo en SQL Developer (ej. revocar el GRANT
 * SELECT de una tabla, o compilar un SELECT con un nombre de columna
 * incorrecto) y confirmar que FN_GET_ERROR_MESSAGE da el mensaje esperado —
 * no vía Postman.
 */
const fs = require('fs');
const path = require('path');

const authHeaders = [
  { key: 'Content-Type', value: 'application/x-www-form-urlencoded' },
  { key: 'Authorization', value: 'Bearer {{token}}' },
  { key: 'X-Country-Code', value: 'CO' },
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

// Variante para casos donde SÍ esperamos que la respuesta descifre bien
// (ej. "sin registros" trae ResponseJson cifrado igual que un 200).
function encItemDecrypt(name, urlPath, payloadSource, status, assertLines) {
  return encItem(name, urlPath, payloadSource, status, [
    'const enc = pm.response.json().ResponseJson;',
    'const clear = JSON.parse(CryptoJS.AES.decrypt(enc, key).toString(CryptoJS.enc.Utf8));',
    "console.log('ResponseJson (descifrado):', clear);",
    ...assertLines,
  ]);
}

function rawJsonItem(name, method, urlPath, headers, body, status, assertLines) {
  return {
    name,
    event: [
      {
        listen: 'test',
        script: {
          type: 'text/javascript',
          exec: [
            `pm.test('status ${status}', () => pm.response.to.have.status(${status}));`,
            ...assertLines,
          ],
        },
      },
    ],
    request: {
      method,
      header: headers,
      url: `{{baseUrl}}/ftd-spi-employee/rest/${urlPath}`,
      body: { mode: 'raw', raw: JSON.stringify(body) },
    },
  };
}

const collection = {
  info: {
    name: 'FTD SPI Error Handling',
    schema:
      'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    description:
      'Valida el manejo de errores en español (PKG_GLOBAL_ERRORS + catalog-pkg-assert.ts) ' +
      'por los caminos alcanzables vía HTTP: negativos de auth/cifrado, "sin registros" ' +
      'con companyId inexistente, catálogo desconocido, y validaciones de negocio de ' +
      'validate-reentry. Los códigos Oracle de esquema/infraestructura (-942, -904, -1017, ' +
      'timeouts, deadlocks...) son una red de seguridad no reproducible con un request HTTP ' +
      'bien formado (Node ya valida tipos/campos antes de llegar a Oracle) — para esos, forzar ' +
      'el error directo en SQL Developer y confirmar el mensaje de FN_GET_ERROR_MESSAGE. ' +
      'Ejecutar Auth > Get Token primero.',
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
      name: '1. Negativos de auth y cifrado',
      item: [
        rawJsonItem(
          'No token (401)',
          'POST',
          'catalogs/countries/list',
          [
            { key: 'Content-Type', value: 'application/json' },
            { key: 'X-Country-Code', value: 'CO' },
          ],
          {},
          401,
          [],
        ),
        rawJsonItem(
          'Missing X-Country-Code (400)',
          'POST',
          'catalogs/countries/list',
          [
            { key: 'Content-Type', value: 'application/json' },
            { key: 'Authorization', value: 'Bearer {{token}}' },
          ],
          {},
          400,
          [],
        ),
        rawJsonItem(
          'Country not enabled AR (422)',
          'POST',
          'catalogs/countries/list',
          [
            { key: 'Content-Type', value: 'application/json' },
            { key: 'Authorization', value: 'Bearer {{token}}' },
            { key: 'X-Country-Code', value: 'AR' },
          ],
          {},
          422,
          [],
        ),
        rawJsonItem(
          'Unknown catalog key (404)',
          'POST',
          'catalogs/does-not-exist/list',
          [
            { key: 'Content-Type', value: 'application/json' },
            { key: 'Authorization', value: 'Bearer {{token}}' },
            { key: 'X-Country-Code', value: 'CO' },
          ],
          {},
          404,
          [],
        ),
        {
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
            url: '{{baseUrl}}/ftd-spi-employee/rest/catalogs/countries/list',
            body: {
              mode: 'urlencoded',
              urlencoded: [{ key: 'RequestJson', value: 'not-a-valid-cipher' }],
            },
          },
        },
      ],
    },
    {
      name: '2. Sin registros (422, mensaje en español)',
      description:
        'companyId que no existe -> el PKG devuelve GC_CODIGO_SIN_REGISTROS / ' +
        'GC_MENSAJE_SIN_REGISTROS ("No se encontraron registros para el criterio de ' +
        'consulta.") y catalog-pkg-assert.ts lo traduce a 422.',
      item: [
        encItemDecrypt(
          'Branches — companyId inexistente (422)',
          'catalogs/branches/list',
          ["const payload = { page: 1, size: 20, companyId: '9999' };"],
          422,
          [],
        ),
        encItemDecrypt(
          'Groups — companyId inexistente (422)',
          'catalogs/groups/list',
          ["const payload = { page: 1, size: 20, companyId: '9999' };"],
          422,
          [],
        ),
        encItemDecrypt(
          'Payroll types — companyId inexistente (422)',
          'catalogs/payroll-types/list',
          ["const payload = { page: 1, size: 20, companyId: '9999' };"],
          422,
          [],
        ),
      ],
    },
    {
      name: '3. Validar reingreso — validaciones de negocio (400)',
      item: [
        encItem(
          'reingreso inválido (400)',
          'catalogs/validate-reentry',
          ["const payload = { numIden: '1234567890', reingreso: 'MAYBE' };"],
          400,
          [
            "pm.test('mensaje de validacion', () => { const b = pm.response.json(); pm.expect(b.errors.join(' ')).to.include('reingreso'); });",
          ],
        ),
        encItem(
          'numIden vacío (400)',
          'catalogs/validate-reentry',
          ["const payload = { numIden: '', reingreso: 'SI' };"],
          400,
          [
            "pm.test('mensaje de validacion', () => { const b = pm.response.json(); pm.expect(b.errors.join(' ')).to.include('numIden'); });",
          ],
        ),
        encItem(
          'body vacío — faltan ambos campos (400)',
          'catalogs/validate-reentry',
          ['const payload = {};'],
          400,
          [],
        ),
      ],
    },
  ],
};

const out = path.join(
  __dirname,
  '..',
  'postman',
  'ftd-spi-error-handling.postman_collection.json',
);
fs.writeFileSync(out, JSON.stringify(collection, null, 2) + '\n');
console.log('Wrote', out);
