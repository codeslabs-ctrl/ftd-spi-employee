# Software Design Document
## FTD SPI Employee API — API RESTful multi-tenant de RRHH (SPI)
### Versión 2.0

**Estado:** Implementado — refleja el código actual (rama `migrate/express-archetype`)
**Fecha:** 2026-07-16
**Reemplaza a:** v1.0 (2026-07-02) — ver nota de cambios abajo.

| Aprobador | Comentario |
|-----------|------------|
|           |            |

| Campo | Valor |
|---|---|
| Estado | Implementado / en verificación |
| Objetivo | Exponer un API RESTful para la gestión de datos maestros de RRHH del sistema SPI, multi-tenant por país |
| Ámbito | Backend — servicio `ftd-spi-employee` en GCP **App Engine Standard** (arquetipo FTD Express) |
| Fecha | 2026-07-16 |

---

## 1. Nota de cambios v1.0 → v2.0

Esta versión reemplaza al SDD v1.0 tras dos cambios mayores respecto al diseño original:

1. **Migración de runtime NestJS → Express + TypeScript (arquetipo FTD).** Se sustituye NestJS 10 por Express sobre el arquetipo del equipo (carpetas Clean/DDD: `config`/`domain`/`application`/`infrastructure`/`interfaces`/`modules`/`shared`). Guards e interceptors pasan a **middlewares**; `@nestjs/config` a `process.env` + `dotenv`; `@nestjs/throttler` a `express-rate-limit`; `@nestjs/swagger` se retira. **Los contratos HTTP (rutas, JSON, cifrado P2C) no cambian.**
2. **Despliegue Cloud Run → App Engine Standard (`nodejs22`).** Se despliega con `app.yaml` + `gcloud app deploy` (patrón del arquetipo). Docker/Cloud Build quedan como referencia histórica.
3. **Cinco recursos nuevos** además de Employee: `position`, `company`, `marital-status`, `job-post`, `org-unit` (ver §7). Solo `position` tiene escritura; el resto son de consulta.

El contrato de negocio (PKG-first sobre Oracle, contrato JSON en inglés, seguridad JWT RS256, cifrado P2C, multi-tenant por `X-Country-Code`) se conserva íntegro.

## 2. Resumen ejecutivo

`ftd-spi-employee` es un servicio **Express + TypeScript** que expone la gestión de datos maestros de RRHH del sistema SPI como API RESTful, con Venezuela y Colombia habilitados y Argentina preparada por configuración. Envuelve los paquetes Oracle existentes (estándar FTD: **PKG-first**) con el contrato `I_JSON CLOB → O_JSON CLOB / O_COD / O_MESSAGE`, aplica seguridad con JWT RS256 (TTL 12 h) y aísla los datos por región mediante el header `X-Country-Code`. El principio arquitectónico central es un **único despliegue multi-tenant en App Engine** con un connection pool `oracledb` por país, donde el header de país determina dinámicamente el enrutamiento a la base de datos correspondiente. Incorpora el estándar de seguridad de Farmatodo: **cifrado de payload front↔back con `crypto-js` (CryptoJS.AES, esquema P2C)**, rate limiting, HSTS y CORS restringido.

## 3. Objetivo y alcance

| | |
|---|---|
| **Objetivo** | API RESTful de datos maestros de RRHH (SPI) con seguridad JWT, cifrado P2C y enrutamiento multi-tenant por país |
| **Incluye** | `POST /security/token` (JWT RS256 TTL 12 h); CRUD de `employee` (create/get/list/update/delete); CRUD parcial de `position` (create/get/list/update); consulta de `company`, `job-post`, `org-unit` (get/list) y `marital-status` (list); middleware `X-Country-Code` (ISO 3166-1 alfa-2); pools Oracle por país (VE y CO activos); despliegue App Engine + `app.yaml`; quality gate SonarQube ≥80% |
| **Fuera de alcance** | `delete` en los recursos nuevos (el spec no lo pide); habilitación efectiva de AR (queda por configuración); UI de gestión de clientes del API; sincronización con otros sistemas (SIM, RMS); documentación OpenAPI/Swagger embebida (se retiró en la migración) |
| **Principio rector** | Un solo servicio multi-tenant, PKG-first contra Oracle, contrato del API en inglés desacoplado del esquema legado mediante diccionario de mapeo declarativo |

## 4. Drivers de diseño y decisiones clave

- **PKG-first (estándar FTD):** toda la operación pasa por procedimientos de los paquetes `pkg_management_*` con el contrato estándar FTD `I_JSON CLOB → O_JSON CLOB / O_COD / O_MESSAGE`. Sobre **Oracle 12.1.0.2**: la entrada se parsea con `JSON_TABLE`; el JSON de salida se arma **a mano** (`FN_JSON_ESCAPE`/`FN_JSON_PAIR` + `DBMS_LOB`, porque `JSON_OBJECT/JSON_ARRAYAGG RETURNING CLOB` llegó en 12.2); las escrituras hacen `UPDATE` y, si no existe, `INSERT` (empleado: `ID` desde `INFOCENT.SPI_KEY`). Los códigos de respuesta usan `PKG_GLOBAL_CONSTANTS` (`FTD-200` éxito / `FTD-201` sin registros). La lógica de negocio permanece en la BD.
- **Runtime Express sobre arquetipo FTD:** `src/index.ts` compone la app Express (helmet → parsers → P2C → CORS → logger → timeout → rate limit → router → errorHandler). Sin framework de DI; los módulos exponen `router`/`controller`/`service`/`repository` como funciones y objetos. Node 22 en App Engine.
- **Multi-tenant en un solo despliegue:** un pool `oracledb` por país creado al bootstrap (`initializeDatabases`); `X-Country-Code` resuelve el pool por request. Habilitar un país nuevo = agregar variables `DB_<CC>_*`, sin código.
- **Contrato en inglés, esquema en español:** el API intercambia JSON con campos en inglés (`idNumber`, `firstName`…); el PKG traduce hacia las columnas legadas (`NUM_IDEN`, `NOMBRE1`…) y convierte `gender` M/F ↔ `SEXO` 1/2 con `DECODE`. En Node, cada módulo declara su lista `*_JSON_FIELDS` (`toXxxPayload`) que define qué campos se envían; agregar un atributo = 1 campo DTO + 1 entrada en la lista + su columna en el PKG.
- **Seguridad autocontenida:** el propio servicio emite JWT **RS256** (llaves en Secret Manager) con TTL de 12 h y claim `countries` que el `country.middleware` valida contra `X-Country-Code` (403 si el cliente no está autorizado para el país).
- **Cifrado de payload front↔back (P2C):** el body viaja cifrado con **CryptoJS.AES** (`crypto-js`, formato OpenSSL "Salted__"). El front envía `RequestJson` cifrado y recibe `ResponseJson` cifrado, con passphrase compartida en Secret Manager (`PAYLOAD_ENCRYPTION_KEY`). El `payload-crypto.middleware` descifra antes de la validación y cifra la respuesta. Requests en claro siguen funcionando.
- **Defensa en profundidad:** `helmet` + HSTS, rate limiting (`express-rate-limit`: 60/min global en `/ftd-spi-employee/rest`, 10/min en `/security/token`), CORS restringido por origen (`CORS_ORIGINS`), comparación de secreto en tiempo constante (`crypto.timingSafeEqual` sobre hash SHA-256), límite de body (`BODY_PARSER_LIMIT`) y timeout de request.
- **Serverless nativo GCP:** App Engine Standard con escalado automático; conectividad a la BD SPI vía Serverless VPC Access; secretos en `app.yaml`/`env_variables` (sincronizados desde `.env.production` con `sync-env-to-yaml.js`) — en su defecto Secret Manager.
- **DELETE lógico (solo employee):** nunca borrado físico sobre `EO_PERSONA`; se marca la baja según el PKG. Los recursos nuevos no exponen `delete`.
- **Calidad verificable:** cobertura ≥80% (lcov) como quality gate de SonarQube; repo en memoria por módulo (`FAKE_DB=true`) para probar el contrato HTTP completo sin Oracle.

## 5. Arquitectura objetivo y responsabilidades

| Componente | Responsabilidad principal | Notas |
|---|---|---|
| `ftd-spi-employee` (App Engine) | Exponer el API REST, validar, autenticar y enrutar por país | Express + TypeScript, Node 22, arquetipo FTD |
| `src/index.ts` | Composición de la app y cadena de middlewares; bootstrap/shutdown de pools | `initializeDatabases()` al arranque; `closeDatabases()` en SIGTERM/SIGINT |
| Módulo `auth` (`/security`) | Emitir JWT RS256 TTL 12 h validando `client_id`/`client_secret` | `jsonwebtoken`; algoritmo fijado a RS256; secreto por SHA-256 + `timingSafeEqual` |
| `auth.middleware` | Validar el Bearer JWT (firma RS256, issuer, vigencia) | 401 si falta/está vencido/es inválido; publica `req.user` |
| `country.middleware` | Validar `X-Country-Code` y resolver el tenant | 400 header inválido; 422 país no habilitado; 403 país no autorizado para el cliente |
| `payload-crypto.middleware` | Descifrar `RequestJson` / cifrar `ResponseJson` (CryptoJS.AES) | Global; se activa por presencia de `RequestJson` y `PAYLOAD_ENCRYPTION_KEY` |
| `config/db/oracle` (`tenant-pools`) | Pools `oracledb` por país (thin mode) + helper `callOraclePkg` | Bind `i_json`/`o_json`/`o_cod`/`o_message`; `autoCommit`; lectura de LOB |
| Módulos de recurso | CRUD por recurso: controller → service → repository | Repository arma `I_JSON` y consume `O_JSON/O_COD/O_MESSAGE`; repo en memoria para `FAKE_DB` |
| BD SPI (espejo VE/CO) | Lógica de negocio y datos (`pkg_management_*` sobre `INFOCENT.*`) | Esquema de conexión `people_one`; acceso vía VPC connector |
| `app.yaml` / Secret Manager | Llaves RSA, credenciales Oracle por país, clientes del API, passphrase P2C | Montados como `env_variables` en App Engine |

## 6. Flujo funcional de inicio a fin

1. El sistema cliente solicita token: `POST /ftd-spi-employee/rest/security/token` con `client_id`/`client_secret`.
2. El servicio valida credenciales contra `API_CLIENTS_JSON` (hash SHA-256, comparación en tiempo constante) y responde JWT RS256 con `exp = iat + 12h` y claim `countries`.
3. El cliente invoca un endpoint con `Authorization: Bearer <jwt>` y `X-Country-Code: VE` (o `CO`).
4. `payload-crypto.middleware`: si el body trae `RequestJson`, lo descifra a `req.body` y marca la respuesta para cifrar.
5. `auth.middleware` valida firma RS256, issuer y vigencia (401 si falla).
6. `country.middleware` valida el header (400/422/403 según el caso) y fija `req.countryCode` → pool Oracle del país.
7. El controller valida el DTO con `class-validator` (400 con detalle por campo) y llama al service.
8. Para escritura (`employee`/`position`): el repository arma `I_JSON` y llama `PRC_MERGE_*`; el PKG hace `UPDATE` por la clave de negocio y, si no existe, `INSERT`. Éxito (`FTD-200`) → 201 (create) / 200 (update).
9. Para consulta: `PRC_GET_*` arma el JSON de salida (claves en inglés); el repository lo devuelve tal cual. `get` sin registros → 404; `list` sin registros → 200 con lista vacía.
10. Errores Oracle se mapean: `ORA-00001` → 409; `ORA-20000..-20999` y errores de integridad (`-1400/-2290/-2291/-2292/-12899`) → 422 con el mensaje del PKG; resto → 500 sin filtrar detalles internos.
11. Todo request queda en Cloud Logging (Winston + `@google-cloud/logging-winston`) con `country`, `requestId` y `sub` del token (sin datos sensibles).

## 7. Recursos y endpoints de la V2

Estilo de ruta Farmatodo: `POST /ftd-spi-employee/rest/{recurso}/{verbo}`, verbo al final, identificador en el **body** (nunca en la URL, para que viaje cifrado y no quede en logs). Todas las rutas de negocio pasan por `auth.middleware` + `country.middleware`.

| Recurso | Tabla origen (`INFOCENT.`) | PKG | Operaciones | Escritura |
|---|---|---|---|---|
| **auth** (`/security`) | — | — | `token` | — |
| **employee** (Personas) | `EO_PERSONA` | `PKG_MANAGEMENT_EMPLOYEE` | `create`, `get`, `list`, `update`, `delete` | Sí |
| **position** (Cargos) | `EO_CARGO` | `PKG_MANAGEMENT_POSITION` | `create`, `get`, `list`, `update` | Sí |
| **company** (Empresas) | `EO_EMPRESA` | `PKG_MANAGEMENT_COMPANY` | `get`, `list` | No |
| **marital-status** (Estado civil) | `EO_ESTADO_CIVIL` | `PKG_MANAGEMENT_MARITAL_STATUS` | `list` | No |
| **job-post** (Puestos) | `EO_PUESTO` | `PKG_MANAGEMENT_JOB_POST` | `get`, `list` | No |
| **org-unit** (Unidades) | `EO_UNIDAD` | `PKG_MANAGEMENT_ORG_UNIT` | `get`, `list` | No |
| **health** | — | — | `GET /health`, `GET /health/ready` | Público |

Los nombres de PKG son configurables por entorno (`EMPLOYEE_PKG`, `POSITION_PKG`, `COMPANY_PKG`, `MARITAL_STATUS_PKG`, `JOB_POST_PKG`, `ORG_UNIT_PKG`); los defaults van sin prefijo de esquema y se resuelven en el esquema de conexión (`people_one`).

### 7.1 POST /security/token
Emite el token de acceso. Único endpoint de negocio público (junto a health).

**Request** `{ "client_id": "hr-integration", "client_secret": "********" }`

**Response (200)**
```json
{ "access_token": "eyJhbGciOiJSUzI1NiIs...", "token_type": "Bearer", "expires_in": 43200 }
```
Notas: credenciales inválidas → 401; body incompleto → 400; `expires_in` = `JWT_TTL_SECONDS` (12 h). Rate limit: 10 req/min (429).

### 7.2 employee — CRUD completo
`create` (201 `{ idNumber, message }`), `get`, `list` (`{ page, size, items }`), `update`, `delete` (204). `get`/`update`/`delete` reciben `idNumber` en el body; `list` recibe `{ page, size }` (`size` máx. 100, default 20; `page` default 1). Ejemplo `create`:
```json
{ "idNumber": "12345678", "idType": "V", "nationality": "VENEZOLANO", "firstName": "MARIA",
  "lastName": "PEREZ", "birthDate": "1990-05-14", "gender": "F", "email": "maria.perez@mail.com" }
```
Obligatorios: `idNumber`, `nationality`, `firstName`, `lastName`, `birthDate`, `gender` (los NOT NULL de `EO_PERSONA`). `gender` viaja `M`/`F` y el PKG lo traduce a `SEXO` `'1'`/`'2'`. Duplicado → 409; validación por campo → 400; `O_COD` ≠ éxito → 422.

### 7.3 position — create/get/list/update
Clave compuesta `companyId` + `id`. `create` (201 `{ companyId, id, message }`) y `update` envuelven `PRC_MERGE_POSITION`; `get`/`list` usan `PRC_GET_POSITION`. Obligatorios en `create`: `companyId` (≤4), `id` (≤10), `name` (≤50). `update` requiere `companyId` + `id`. Ejemplo `create`:
```json
{ "companyId": "0001", "id": "CARGO001", "name": "ANALISTA", "description": "...", "risk": "BAJO" }
```

### 7.4 company / job-post / org-unit — get + list; marital-status — list
Solo consulta. `get` recibe la clave en el body y devuelve el recurso (404 si no existe); `list` recibe `{ page, size }` y devuelve `{ page, size, items }` (200, lista vacía si no hay registros). Claves: `company` → `id`; `org-unit` → `companyId` + `id`; `job-post` → `companyId` + `unitId` + `id`; `marital-status` no tiene `get` (solo `list`).

### 7.5 GET /health · GET /health/ready
Liveness (`{ "status": "ok" }`) y readiness (`{ "status": "ok", "countries": [...] }`, países con pool activo). Públicos, sin token ni header.

## 7-bis. Seguridad y cifrado de payload

**Controles aplicados (defensa en profundidad, implementación real Express):**

| Control | Implementación |
|---|---|
| Autenticación | JWT **RS256** (`jsonwebtoken`), algoritmo fijado, issuer validado, TTL 12 h; llaves en Secret Manager (base64) → `auth.middleware` |
| Autorización por país | `country.middleware` valida el claim `countries` del token vs `X-Country-Code` → **403** si no autorizado |
| Cifrado en tránsito | TLS terminado en App Engine + **HSTS** (`helmet`, maxAge 1 año, includeSubDomains, preload) |
| Cifrado de payload (P2C) | **CryptoJS.AES** (`crypto-js`) vía `payload-crypto.middleware` — ver detalle abajo |
| Rate limiting | `express-rate-limit`: **60 req/min** global en `/ftd-spi-employee/rest`, **10 req/min** en `/security/token` (429) |
| CORS | Allowlist por `CORS_ORIGINS`, `credentials: true`, métodos y headers explícitos; deshabilitado si la lista está vacía |
| Cabeceras | `helmet` (HSTS, `X-Content-Type-Options`, `X-Frame-Options`, etc.) |
| Credenciales de cliente | Hash **SHA-256**, comparación en **tiempo constante** (`crypto.timingSafeEqual`) |
| Validación | `class-validator` + `class-transformer` (DTOs por operación; longitudes reales de columna) → 400 |
| Límite de payload | `express.json`/`urlencoded` con `BODY_PARSER_LIMIT` (default `1mb`) |
| Timeout | `REQUEST_TIMEOUT_MS` (default 30 s) por request |
| SQL injection | El PKG parametriza con `JSON_TABLE`; el API nunca concatena SQL |
| Superficie | Sin Swagger embebido; `/` responde un texto de salud simple |

**Cifrado de payload (compatible con el front Farmatodo):**

- Librería **`crypto-js`**, esquema `CryptoJS.AES.encrypt(JSON.stringify(data), KEY)` → base64 con prefijo `Salted__` (OpenSSL, AES-CBC + KDF por passphrase).
- **Request:** el front envía `RequestJson` (form-urlencoded o JSON). El `payload-crypto.middleware` lo descifra **antes** de la validación; los DTOs operan sobre el JSON en claro.
- **Response:** si el request llegó cifrado, la respuesta se envuelve como `ResponseJson` cifrado con la misma passphrase.
- **Llave:** `PAYLOAD_ENCRYPTION_KEY` (Secret Manager). Vacía = cifrado deshabilitado.
- **Compatibilidad:** se activa por presencia de `RequestJson`; los requests en claro siguen funcionando. Payload cifrado inválido → **400**.

```
Front (crypto-js)                 ftd-spi-employee
  data → CryptoJS.AES.encrypt ──► RequestJson (cifrado)
                                   └► middleware descifra → DTO valida → PKG
  CryptoJS.AES.decrypt ◄────────── ResponseJson (cifrado) ◄── middleware cifra
```

## 8. Contratos propuestos

| Flujo | Quién llama | Quién responde | Contrato clave |
|---|---|---|---|
| Emisión de token | Sistema cliente (RRHH/integraciones) | `ftd-spi-employee` | `client_id`/`client_secret` → JWT RS256, `expires_in: 43200` |
| CRUD / consulta | Sistema cliente | `ftd-spi-employee` | JSON en inglés + headers `Authorization` y `X-Country-Code` (+ `RequestJson` si cifrado) |
| Escritura en SPI | `ftd-spi-employee` (repository) | BD Oracle SPI (`PRC_MERGE_*`) | `I_JSON` → UPDATE/INSERT por clave de negocio; OUT `O_COD`/`O_MESSAGE` |
| Consulta en SPI | `ftd-spi-employee` (repository) | BD Oracle SPI (`PRC_GET_*`) | `I_JSON` (id o page/size) → `O_JSON` `{ "<recurso>": [...] }` |

Contrato PL/SQL (todas las operaciones): `pkg.procedure(i_json => :i_json, o_json => :o_json, o_cod => :o_cod, o_message => :o_message)` (el `o_json` se omite en operaciones sin salida de datos como `delete`).

## 9. Modelo de datos y mapeo de campos

El servicio **no crea tablas propias**: opera sobre tablas `INFOCENT.*` (espejo de producción) a través de los `pkg_management_*` con el contrato JSON estándar FTD. Los campos de auditoría (`USRCRE/FECCRE/USRACT/FECACT`) los asigna el PKG, no el API.

**employee → `EO_PERSONA`** (clave de negocio `idNumber`):

| Campo API | Columna | Regla |
|---|---|---|
| `idNumber` | `NUM_IDEN` | VARCHAR2(20), identificador de negocio |
| `idType` | `ID_TIPO_IDEN` | VARCHAR2(2), FK |
| `nationality` | `NACIONAL` | VARCHAR2(50) NOT NULL |
| `passport` | `PASAPORTE` | VARCHAR2(10) |
| `firstName` / `middleName` | `NOMBRE1` / `NOMBRE2` | VARCHAR2(17) NOT NULL / VARCHAR2(15) |
| `lastName` / `secondLastName` | `APELLIDO1` / `APELLIDO2` | VARCHAR2(17) NOT NULL / VARCHAR2(15) |
| `birthDate` | `FECHA_NA` | DATE NOT NULL (`YYYY-MM-DD`) |
| `gender` | `SEXO` | VARCHAR2(1) NOT NULL — `M`/`F` ↔ `'1'`/`'2'` (DECODE) |
| `maritalStatus` | `EDO_CIVIL` | VARCHAR2(30) |
| `address` / `city` | `DIRECCION` / `CIUDAD` | VARCHAR2(120) / VARCHAR2(30) |
| `phone` / `mobile` | `TELEFONO1` / `CELULAR` | VARCHAR2(15) |
| `email` | `E_MAIL1` | VARCHAR2(60) |

El PK `ID` (NUMBER) es interno; el upsert casa por `NUM_IDEN` y genera el `ID` desde `INFOCENT.SPI_KEY` (`name_key='EOPERSONA'`). Idempotente por `NUM_IDEN`.

**position → `EO_CARGO`** (clave `companyId`+`id`): `companyId`→`ID_EMPRESA`, `id`→`ID`, `name`→`NOMBRE`, `classificationId`→`ID_CLASIFICA`, `parentPositionId`→`ID_CARGO_SUP`, `description`→`DESCRIP`, `functions`→`FUNCION`, `purpose`→`PROPOSITO`, `risk`→`RIESGO`.

**company → `EO_EMPRESA`** (clave `id`): `id`→`ID`, `name`→`NOMBRE`, `shortName`→`NOMBRE_ABREV`, `sector`→`SECTOR_EMP`, `isPublic`→`PUBLICA`, `taxId1`→`RIF1`, `taxId2`→`RIF2`, `address`→`DIRECCION`, `city`→`CIUDAD`, `postalCode`→`COD_POSTAL`, `phone1`→`TELEFONO1`, `phone2`→`TELEFONO2`, `webPage`→`PAGINA_WEB`, `email`→`E_MAIL`.

**marital-status → `EO_ESTADO_CIVIL`** (clave `id`): `id`→`ID`, `name`→`NOMBRE`, `legalCode`→`CODIGO_LEY`.

**job-post → `EO_PUESTO`** (clave `companyId`+`unitId`+`id`): `companyId`→`ID_EMPRESA`, `unitId`→`ID_UNIDAD`, `id`→`ID`, `name`→`NOMBRE`, `positionId`→`ID_CARGO`, `description`→`DESCRIP`, `functions`→`FUNCION`, `startDate`→`FECHA_INI`, `endDate`→`FECHA_FIN`, `risk`→`RIESGO`.

**org-unit → `EO_UNIDAD`** (clave `companyId`+`id`): `companyId`→`ID_EMPRESA`, `id`→`ID`, `name`→`NOMBRE`, `functions`→`FUNCIONES`, `adminLocation`→`UBICA_ADMIN`, `startDate`→`FECHA_INI`, `endDate`→`FECHA_FIN`, `parentUnitId`→`ID_UNIDAD_SUP`, `maxPosts`→`MAX_PUESTO`.

**Procedimientos por PKG** (contrato `I_JSON/O_JSON/O_COD/O_MESSAGE`):

| PKG | Procedimientos | Uso |
|---|---|---|
| `PKG_MANAGEMENT_EMPLOYEE` | `PRC_GET_EMPLOYEE`, `PRC_MERGE_EMPLOYEE`, `PRC_DELETE_EMPLOYEE` | get/list, create/update, delete lógico |
| `PKG_MANAGEMENT_POSITION` | `PRC_GET_POSITION`, `PRC_MERGE_POSITION` | get/list, create/update |
| `PKG_MANAGEMENT_COMPANY` | `PRC_GET_COMPANY` | get/list |
| `PKG_MANAGEMENT_MARITAL_STATUS` | `PRC_GET_MARITAL_STATUS` | list |
| `PKG_MANAGEMENT_JOB_POST` | `PRC_GET_JOB_POST` | get/list |
| `PKG_MANAGEMENT_ORG_UNIT` | `PRC_GET_ORG_UNIT` | get/list |

Los scripts completos (spec + body, estilo FTD, Oracle 12.1) se entregan en `db/pkg_management_*_api.sql`. Los nombres reales de procedimiento se confirman con el DBA.

## 10. Flujos asíncronos / continuidad

No aplica en V2: todos los flujos son síncronos request/response. Los pools se crean al bootstrap (`initializeDatabases`) y se cierran en shutdown limpio (`closeDatabases` en `SIGTERM`/`SIGINT`). Si a futuro la creación masiva lo requiere, la evolución natural es carga por lotes con Cloud Tasks + outbox, fuera del alcance de esta versión.

## 11. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Oracle **12.1.0.2**: `JSON_OBJECT`/`JSON_ARRAYAGG` sin `RETURNING CLOB` | El GET no arma el JSON con funciones nativas | **Resuelto:** el PKG arma el CLOB a mano (`FN_JSON_*` + `DBMS_LOB`); `JSON_TABLE` y `OFFSET/FETCH` sí están en 12.1 |
| Firma real de los PKG (nombres de procedimiento/binds) distinta de la asumida | Errores en runtime al invocar | Confirmar con el DBA al compilar (Task 0/12); PKG y códigos son configurables por env |
| Valores reales de `PKG_GLOBAL_CONSTANTS` distintos a `FTD-200`/`FTD-201` | Mapeo HTTP incorrecto | Configurables (`PKG_SUCCESS_CODE`/`PKG_NORECORDS_CODE`); confirmar por entorno |
| Conectividad App Engine → BD SPI (VPC connector) no disponible a tiempo | Bloquea despliegue e integración | Solicitar el connector a redes; desarrollo y tests con `FAKE_DB` no dependen de la BD |
| Agotamiento de conexiones Oracle por escalado | 500 intermitentes bajo carga | Alinear escalado de App Engine con `POOL_MAX`; timeouts de pool/queue/call; monitoreo en `/health/ready` |
| Fuga de secretos (llaves RSA, credenciales Oracle, passphrase P2C) | Acceso indebido a datos | Secret Manager / `app.yaml` fuera de repo; nunca en logs; rotación documentada |
| TTL de 12 h del token comprometido | Ventana amplia de uso indebido | Claim `countries` limita alcance; revocación por rotación de llaves; logging con `sub` |

## 12. Stack y librerías

| Propósito | Librería / Tecnología |
|---|---|
| Runtime / framework | Node 22 · **Express** · TypeScript |
| Oracle | `oracledb` (thin mode) |
| Autenticación JWT | `jsonwebtoken` (RS256) |
| Cifrado de payload | **`crypto-js`** (CryptoJS.AES, compatible con el front) |
| Rate limiting | `express-rate-limit` |
| Cabeceras de seguridad | `helmet` |
| CORS | `cors` |
| Validación | `class-validator` · `class-transformer` |
| Logging | `winston` · `@google-cloud/logging-winston` |
| Configuración | `dotenv` + `process.env` |
| Pruebas | `jest` · `supertest` (cobertura lcov ≥80% → SonarQube) |
| Despliegue / CI-CD | **App Engine Standard `nodejs22`** · `app.yaml` · `sync-env-to-yaml.js` · Serverless VPC Access · Secret Manager |

## 13. Despliegue

App Engine Standard (`nodejs22`), entry `node dist/index.js`. Flujo: `cp app.template.yaml app.yaml` (o `npm run sync-env` desde `.env.production`) → `npm run build-gcp` → `gcloud app deploy`. VPC connector hacia Oracle en `app.yaml`. Cambios solo-config (credenciales, clients, PKG, timeouts, CORS, país nuevo) no requieren cambios de código. Detalle en [docs/deploy/gcp-setup.md](../deploy/gcp-setup.md) y PPAP en [docs/deploy/PPAP-ftd-spi-employee.md](../deploy/PPAP-ftd-spi-employee.md). Cloud Run / Docker quedan como referencia histórica.

## 14. Conclusión

La V2 mantiene el servicio multi-tenant que expone la gestión de datos maestros de RRHH del SPI cumpliendo las premisas de diseño (nube nativa GCP, JWT RS256 TTL 12 h, aislamiento por país vía `X-Country-Code`, REST estricto y operación PKG-first sobre `INFOCENT.*`), ahora sobre el **arquetipo Express de Farmatodo** y desplegado en **App Engine**, con **seis recursos** (employee + position + company + marital-status + job-post + org-unit) y el estándar de seguridad de Farmatodo (cifrado P2C con `crypto-js`, rate limiting, HSTS, CORS restringido, autorización por país). La lógica de negocio permanece en los paquetes Oracle; el servicio aporta el contrato REST en inglés, la seguridad, el cifrado y el enrutamiento multi-tenant. La evolución recomendada es habilitar AR por configuración cuando exista su BD espejo y evaluar carga por lotes asíncrona si el volumen lo demanda.
