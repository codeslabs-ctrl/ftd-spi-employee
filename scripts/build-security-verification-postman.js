/**
 * Builds postman/ftd-spi-security-verification.postman_collection.json —
 * colección dedicada a verificar EN VIVO, contra un ambiente real, los fixes
 * aplicados en respuesta al pentest de FarmaGuard (2026-08-06) sobre
 * /catalogs/parishes/list. No repite el resto de la superficie de
 * catalogs/employee (eso ya lo cubren ftd-spi-catalogs y
 * ftd-spi-error-handling) — esta colección solo prueba las correcciones de
 * este ciclo:
 *
 *   1) Orden de middleware (pentest #11/#12/#13/#30): auth debe correr
 *      ANTES que el descifrado de RequestJson. Sin token, con un body
 *      cifrado inválido, debe dar 401 (no 400 "Invalid encrypted payload"),
 *      y esa respuesta 401 nunca debe venir envuelta en ResponseJson.
 *      NOTA: el caso de "token expirado con firma válida" no se puede
 *      forjar desde Postman (requiere la clave privada RSA del servidor,
 *      que solo el backend tiene) — ese caso puntual está cubierto por el
 *      test automatizado test/security.e2e-spec.ts, que sí genera un par
 *      de llaves propio. Aquí se usa un Bearer claramente inválido como
 *      equivalente observable: mismo resultado (401 antes que la capa de
 *      cripto), misma causa (el guard corre primero).
 *   2) Cabeceras de seguridad (pentest #15/#33/#36/#38/#41/#45/#50):
 *      Permissions-Policy y Cache-Control: no-store.
 *   3) Ruta desconocida sin token -> 401 uniforme (pentest #27): al ser el
 *      mismo gate global el que corre para toda ruta bajo
 *      /ftd-spi-employee/rest/**, una ruta inexistente ya no se distingue
 *      de una real por su código de estado cuando no hay token.
 *   4) CORS endurecido (pentest #16/#21/#26/#28/#31/#37/#42): el preflight
 *      solo debe anunciar GET, POST, OPTIONS (nunca PUT/DELETE/PATCH).
 *
 * Fuera de esta colección (no verificables desde Postman contra un
 * ambiente ya desplegado, cubiertos por test/security.e2e-spec.ts):
 *   - trust proxy 1 (evita que express-rate-limit agrupe a todos los
 *     clientes bajo la IP del load balancer, o confíe ciegamente en un
 *     X-Forwarded-For arbitrario) — solo observable inspeccionando el
 *     comportamiento interno del rate limiter, no vía un request suelto.
 *   - Guard de fallo cerrado en payload-crypto.middleware.ts cuando
 *     REQUIRE_ENCRYPTED_PAYLOAD=true pero falta PAYLOAD_ENCRYPTION_KEY —
 *     requiere manipular variables de entorno del servidor, no algo que
 *     Postman pueda forzar contra un ambiente ya desplegado.
 *
 * Requiere REQUIRE_ENCRYPTED_PAYLOAD/PAYLOAD_ENCRYPTION_KEY como en las
 * demás colecciones de este proyecto. Ejecutar "Auth > Get Token" primero.
 */
const fs = require('fs');
const path = require('path');

function test(status, extra = []) {
  return [
    `pm.test('status ${status}', () => pm.response.to.have.status(${status}));`,
    ...extra,
  ];
}

function rawItem(name, method, urlPath, headers, bodyMode, body, status, extraTests = []) {
  return {
    name,
    event: [
      {
        listen: 'test',
        script: { type: 'text/javascript', exec: test(status, extraTests) },
      },
    ],
    request: {
      method,
      header: headers,
      url: `{{baseUrl}}/ftd-spi-employee/rest/${urlPath}`,
      body:
        bodyMode === 'urlencoded'
          ? { mode: 'urlencoded', urlencoded: body }
          : { mode: 'raw', raw: JSON.stringify(body) },
    },
  };
}

const collection = {
  info: {
    name: 'FTD SPI Security Verification (post-pentest)',
    schema:
      'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    description:
      'Verifica en vivo los fixes aplicados tras el pentest de FarmaGuard ' +
      '(06 ago 2026) sobre /catalogs/parishes/list: (1) orden de middleware ' +
      'auth-antes-de-cifrado (401 en vez de 400, respuesta 401 nunca cifrada), ' +
      '(2) cabeceras Permissions-Policy / Cache-Control: no-store, (3) ruta ' +
      'desconocida sin token también da 401 uniforme (cierra la enumeración ' +
      'por respuesta diferencial), (4) CORS sin métodos innecesarios (solo ' +
      'GET/POST/OPTIONS). No repite el resto de la API — para eso ver ' +
      'ftd-spi-catalogs.postman_collection.json y ' +
      'ftd-spi-error-handling.postman_collection.json. Ejecutar Auth > Get ' +
      'Token primero. Dos casos quedan fuera del alcance de Postman y se ' +
      'cubren solo en test/security.e2e-spec.ts: "token expirado con firma ' +
      'válida" (requiere la clave privada del servidor) y el guard de fallo ' +
      'cerrado cuando falta PAYLOAD_ENCRYPTION_KEY (requiere manipular env ' +
      'vars del servidor).',
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
      name: '1. Auth antes de cifrado (pentest #11/#12/#13/#30)',
      description:
        'Antes del fix, un body cifrado inválido daba 400 "Invalid encrypted ' +
        'payload" ANTES de que se revisara el token — un atacante sin ' +
        'credenciales podía distinguir "esta ruta procesa cifrado" sin ' +
        'autenticarse, y una respuesta de error posterior a un cifrado válido ' +
        'salía envuelta en ResponseJson. Ahora el guard de auth corre primero: ' +
        'sin token válido, siempre 401 en texto plano, sin importar el body.',
      item: [
        rawItem(
          'Sin token + RequestJson basura -> 401 (antes: 400)',
          'POST',
          'catalogs/countries/list',
          [
            { key: 'Content-Type', value: 'application/x-www-form-urlencoded' },
            { key: 'X-Country-Code', value: 'CO' },
          ],
          'urlencoded',
          [{ key: 'RequestJson', value: 'no-es-un-cifrado-valido' }],
          401,
          [
            "pm.test('no es el 400 de la capa de cifrado', () => { const b = pm.response.json(); pm.expect(b.message || '').to.not.match(/encrypted payload/i); });",
            "pm.test('respuesta NO viene cifrada (sin ResponseJson)', () => { const b = pm.response.json(); pm.expect(b).to.not.have.property('ResponseJson'); });",
          ],
        ),
        rawItem(
          'Bearer inválido + RequestJson basura -> 401 (equivalente observable a token expirado; ver nota de la colección)',
          'POST',
          'catalogs/countries/list',
          [
            { key: 'Content-Type', value: 'application/x-www-form-urlencoded' },
            { key: 'Authorization', value: 'Bearer esto-no-es-un-jwt-valido' },
            { key: 'X-Country-Code', value: 'CO' },
          ],
          'urlencoded',
          [{ key: 'RequestJson', value: 'no-es-un-cifrado-valido' }],
          401,
          [
            "pm.test('no es el 400 de la capa de cifrado', () => { const b = pm.response.json(); pm.expect(b.message || '').to.not.match(/encrypted payload/i); });",
          ],
        ),
        rawItem(
          'Con token válido, RequestJson basura SÍ da 400 (contrato existente intacto)',
          'POST',
          'catalogs/countries/list',
          [
            { key: 'Content-Type', value: 'application/x-www-form-urlencoded' },
            { key: 'Authorization', value: 'Bearer {{token}}' },
            { key: 'X-Country-Code', value: 'CO' },
          ],
          'urlencoded',
          [{ key: 'RequestJson', value: 'no-es-un-cifrado-valido' }],
          400,
        ),
      ],
    },
    {
      name: '2. Cabeceras de seguridad (pentest #15/#33/#36/#38/#41/#45/#50)',
      item: [
        {
          name: 'Permissions-Policy presente (deniega camera/mic/geo/payment)',
          event: [
            {
              listen: 'test',
              script: {
                type: 'text/javascript',
                exec: [
                  "pm.test('status 200', () => pm.response.to.have.status(200));",
                  "pm.test('Permissions-Policy deniega todo', () => pm.expect(pm.response.headers.get('Permissions-Policy')).to.eql('camera=(), microphone=(), geolocation=(), payment=()'));",
                ],
              },
            },
          ],
          request: {
            method: 'GET',
            header: [],
            url: '{{baseUrl}}/health',
          },
        },
        {
          name: 'Cache-Control: no-store en respuesta de negocio',
          event: [
            {
              listen: 'test',
              script: {
                type: 'text/javascript',
                exec: [
                  "pm.test('status 200', () => pm.response.to.have.status(200));",
                  "pm.test('Cache-Control: no-store', () => pm.expect(pm.response.headers.get('Cache-Control')).to.eql('no-store'));",
                ],
              },
            },
          ],
          request: {
            method: 'POST',
            header: [
              { key: 'Content-Type', value: 'application/json' },
              { key: 'Authorization', value: 'Bearer {{token}}' },
              { key: 'X-Country-Code', value: 'CO' },
            ],
            url: '{{baseUrl}}/ftd-spi-employee/rest/catalogs/countries/list',
            body: { mode: 'raw', raw: '{"page":1,"size":20}' },
          },
        },
        {
          name: 'HSTS / X-Content-Type-Options / X-Frame-Options siguen presentes (helmet, sin cambios)',
          event: [
            {
              listen: 'test',
              script: {
                type: 'text/javascript',
                exec: [
                  "pm.test('status 200', () => pm.response.to.have.status(200));",
                  "pm.test('HSTS presente', () => pm.expect(pm.response.headers.get('Strict-Transport-Security')).to.include('max-age=31536000'));",
                  "pm.test('X-Content-Type-Options: nosniff', () => pm.expect(pm.response.headers.get('X-Content-Type-Options')).to.eql('nosniff'));",
                  "pm.test('X-Frame-Options presente', () => pm.expect(pm.response.headers.get('X-Frame-Options')).to.not.be.null);",
                ],
              },
            },
          ],
          request: {
            method: 'GET',
            header: [],
            url: '{{baseUrl}}/health',
          },
        },
      ],
    },
    {
      name: '3. Ruta desconocida sin token -> 401 uniforme (cierra pentest #27)',
      description:
        'Antes, una ruta que no existía caía directo al 404 sin pasar por ' +
        'ningún guard (el auth vivía solo dentro de cada router de negocio), ' +
        'mientras que una ruta real sin token daba 401 — un atacante podía ' +
        'usar esa diferencia para enumerar qué endpoints existen. Ahora el ' +
        'gate de auth es global sobre /ftd-spi-employee/rest/**, así que ' +
        'CUALQUIER path sin token da 401 primero, exista o no.',
      item: [
        rawItem(
          'Ruta que no existe, sin token -> 401 (antes: 404, revelaba que no existía)',
          'POST',
          'does-not-exist',
          [{ key: 'Content-Type', value: 'application/json' }],
          'raw',
          {},
          401,
        ),
        rawItem(
          'La misma ruta, CON token válido -> sigue dando 404 (comportamiento correcto intacto)',
          'POST',
          'does-not-exist',
          [
            { key: 'Content-Type', value: 'application/json' },
            { key: 'Authorization', value: 'Bearer {{token}}' },
            { key: 'X-Country-Code', value: 'CO' },
          ],
          'raw',
          {},
          404,
        ),
      ],
    },
    {
      name: '4. CORS endurecido (pentest #16/#21/#26/#28/#31/#37/#42)',
      description:
        'Requiere que el ambiente tenga CORS_ORIGINS configurado con el ' +
        'origen usado abajo (ej. https://aplicaciones-vp-finanzas.uc.r.appspot.com) ' +
        'para que el middleware cors responda con headers Access-Control-*. Si ' +
        'CORS_ORIGINS está vacío, estos requests no traerán esos headers (eso ' +
        'es esperado: sin origins configurados, el middleware ni se monta).',
      item: [
        {
          name: 'Preflight OPTIONS: solo GET,POST,OPTIONS (nunca PUT/DELETE/PATCH)',
          event: [
            {
              listen: 'test',
              script: {
                type: 'text/javascript',
                exec: [
                  'const allow = pm.response.headers.get(\'Access-Control-Allow-Methods\') || \'\';',
                  "pm.test('no incluye PUT', () => pm.expect(allow).to.not.include('PUT'));",
                  "pm.test('no incluye DELETE', () => pm.expect(allow).to.not.include('DELETE'));",
                  "pm.test('no incluye PATCH', () => pm.expect(allow).to.not.include('PATCH'));",
                  "pm.test('incluye GET y POST', () => { pm.expect(allow).to.include('GET'); pm.expect(allow).to.include('POST'); });",
                ],
              },
            },
          ],
          request: {
            method: 'OPTIONS',
            header: [
              {
                key: 'Origin',
                value: 'https://aplicaciones-vp-finanzas.uc.r.appspot.com',
              },
              { key: 'Access-Control-Request-Method', value: 'POST' },
            ],
            url: '{{baseUrl}}/ftd-spi-employee/rest/catalogs/parishes/list',
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
  'ftd-spi-security-verification.postman_collection.json',
);
fs.writeFileSync(out, JSON.stringify(collection, null, 2) + '\n');
console.log('Wrote', out);
