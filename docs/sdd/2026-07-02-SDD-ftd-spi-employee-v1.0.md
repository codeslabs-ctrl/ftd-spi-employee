# Software Design Document
## FTD SPI Employee API — API RESTful multi-tenant de empleados
### Versión 1.0

**Estado:** Análisis y Diseño (aprobado — inicia desarrollo)
**Autor(es):** carlos.rodriguez@farmatodo.com
**Fecha:** 2026-07-02

| Aprobador | Comentario |
|-----------|------------|
|           |            |

| Campo | Valor |
|---|---|
| Estado | Análisis y Diseño |
| Objetivo | Exponer un API RESTful para la gestión de empleados del sistema SPI, multi-tenant por país |
| Ámbito | Backend — nuevo servicio `ftd-spi-employee` en GCP Cloud Run |
| Fecha | 2026-07-02 |

---

## 2. Resumen ejecutivo

`ftd-spi-employee` es un servicio NestJS que expone la gestión de empleados del sistema SPI como API RESTful, iniciando con Venezuela y preparado para Argentina y Colombia sin cambios de código. La V1 prioriza: creación de empleados envolviendo el paquete Oracle existente `corsox.pkg_management_employee` (estándar FTD: PKG-first), consulta sobre `INFOCENT.EO_PERSONA`, seguridad con JWT RS256 (TTL 12h) y aislamiento de datos por región mediante el header `X-Country-Code`. El principio arquitectónico central es un único despliegue multi-tenant en Cloud Run con un connection pool Oracle por país, donde el header de país determina dinámicamente el enrutamiento a la base de datos correspondiente.

## 3. Objetivo y alcance

| | |
|---|---|
| **Objetivo** | API RESTful de empleados SPI con CRUD completo, seguridad JWT y enrutamiento multi-tenant por país |
| **Incluye** | `POST /auth/token` (emisión JWT RS256 TTL 12h); CRUD `/api/v1/employees` — todas las operaciones por POST (create, search, list, update, delete lógico) con el identificador en el body; middleware `X-Country-Code` (ISO 3166-1 alfa-2); pools Oracle por país (VE activo); despliegue Cloud Run + Cloud Build; Swagger; quality gate SonarQube ≥80% |
| **Fuera de alcance** | Habilitación efectiva de AR/CO (queda por configuración); consulta a `corsox.ftd_ingresos` (sus datos llegan como parámetros obligatorios del request); UI de gestión de clientes del API; sincronización con otros sistemas (SIM, RMS) |
| **Principio rector** | Un solo servicio multi-tenant, PKG-first contra Oracle, contrato del API en inglés desacoplado del esquema legado mediante diccionario de mapeo |

## 4. Drivers de diseño y decisiones clave

- **PKG-first (estándar FTD):** toda la operación pasa por procedimientos de `corsox.pkg_management_employee` con el contrato estándar FTD `I_JSON CLOB → O_JSON CLOB / O_COD / O_MESSAGE`: los GET devuelven JSON con `JSON_ARRAYAGG/JSON_OBJECT` y las escrituras hacen `MERGE` parseando `I_JSON` con `JSON_TABLE`. Los códigos de respuesta usan `UTILITY.PKG_GLOBAL_CONSTANTS`. La lógica de negocio permanece en la BD.
- **Multi-tenant en un solo despliegue:** un pool `oracledb` por país creado al bootstrap; `X-Country-Code` resuelve el pool por request. Habilitar un país nuevo = agregar variables `DB_<CC>_*`, sin código.
- **Contrato en inglés, esquema en español:** el diccionario `EMPLOYEE_FIELD_MAP` (campo API → bind PKG → columna) es la única fuente de verdad; de él se generan binds, PL/SQL, UPDATE y mapeo de respuesta. Agregar un atributo = 1 campo DTO + 1 entrada del mapa.
- **Seguridad autocontenida:** el propio servicio emite JWT RS256 (llaves en Secret Manager) con TTL de 12 horas y claim `countries` que un guard valida contra `X-Country-Code` (403 si el cliente no está autorizado para el país).
- **Cifrado de payload front↔back (P2C):** el body viaja cifrado con **CryptoJS.AES** (librería `crypto-js`, formato OpenSSL "Salted__"). El front envía el campo `RequestJson` cifrado y recibe `ResponseJson` cifrado, con una passphrase compartida en Secret Manager (`PAYLOAD_ENCRYPTION_KEY`). Un interceptor descifra antes de la validación y cifra la respuesta.
- **Defensa en profundidad:** `helmet` + HSTS, rate limiting (`@nestjs/throttler`: 60/min global, 10/min en `/auth/token`), CORS restringido por origen (`CORS_ORIGINS`), comparación de secreto en tiempo constante, y Swagger deshabilitado en producción.
- **Serverless nativo GCP:** Cloud Run con escalado automático; conectividad a la BD SPI vía Serverless VPC Access; secretos en Secret Manager; CI/CD en Cloud Build.
- **DELETE lógico:** nunca borrado físico sobre `EO_PERSONA` (BD espejo de producción); se marca `IN_REL_TRAB='N'`.
- **Calidad verificable:** TDD, cobertura ≥80% (lcov) como quality gate de SonarQube antes del build de imagen.

## 5. Arquitectura objetivo y responsabilidades

| Componente | Responsabilidad principal | Notas |
|---|---|---|
| `ftd-spi-employee` (Cloud Run) | Exponer el API REST, validar, autenticar y enrutar por país | NestJS 10, Node 20, contenedor `node:20-slim` |
| Módulo `auth` | Emitir y validar JWT RS256 TTL 12h; guard global | `passport-jwt`; algoritmo fijado a RS256 |
| Módulo `tenancy` | Validar `X-Country-Code` y resolver el tenant | 400 header inválido; 422 país no habilitado; 403 país no autorizado para el cliente |
| Módulo `database` | Pools `oracledb` por país (thin mode) | `TenantConnectionService.getPool(cc)`; cierre limpio en shutdown |
| Módulo `employees` | CRUD: controller → service → repository | Repository arma `I_JSON` y consume `O_JSON/O_COD/O_MESSAGE` |
| Módulo `crypto` | Descifrar `RequestJson` / cifrar `ResponseJson` (CryptoJS.AES) | `CryptoService` + `PayloadCryptoInterceptor` (librería `crypto-js`) |
| BD SPI VE (espejo) | Lógica de negocio de creación (`pkg_management_employee`) y datos (`INFOCENT.EO_PERSONA`) | Esquema `corsox`; acceso vía VPC connector |
| Secret Manager | Llaves RSA, credenciales Oracle por país, clientes del API | Montados como env vars en Cloud Run |
| Cloud Build | Pipeline: lint → tests+cobertura → build → push → deploy | Gate SonarQube en el paso de tests |

## 6. Flujo funcional de inicio a fin

1. El sistema cliente solicita token: `POST /auth/token` con `client_id`/`client_secret`.
2. `ftd-spi-employee` valida credenciales contra los clientes registrados (Secret Manager) y responde JWT RS256 con `exp = iat + 12h` y claim `countries`.
3. El cliente invoca un endpoint CRUD con `Authorization: Bearer <jwt>` y `X-Country-Code: VE`.
4. El guard JWT valida firma RS256, emisor y vigencia (401 si falla).
5. El middleware de tenancy valida el header (400/422/403 según el caso) y resuelve el pool Oracle de VE.
6. Para creación: el repositorio construye el bloque PL/SQL desde `EMPLOYEE_FIELD_MAP` y ejecuta `corsox.pkg_management_employee.prc_crear_datos_basicos` con los datos del request (los parámetros que en origen provienen de `corsox.ftd_ingresos` — el servicio no consulta esa tabla).
7. El PKG responde código/mensaje OUT; código ≠ 0 se mapea a 422 con el mensaje del PKG; éxito responde 201.
8. Para consultas: SELECT sobre `INFOCENT.EO_PERSONA`, la fila se traduce a campos en inglés vía el mismo diccionario; 404 si no existe.
9. Errores Oracle se mapean: ORA-00001 → 409; ORA-20xxx → 422; resto → 500 sin filtrar detalles internos.
10. Todo request queda en Cloud Logging con `country`, `requestId` y `sub` del token (sin datos sensibles).

## 7. Endpoints de la V1

### POST /api/v1/auth/token
Emite el token de acceso del API. Único endpoint público junto a health y docs.

**Request**
```json
{
  "client_id": "hr-integration",
  "client_secret": "********"
}
```

**Response sugerida** (200)
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 43200
}
```

**Notas**
- Credenciales inválidas → 401. Body incompleto → 400.
- `expires_in` fijo en 43200 s (12 h) por premisa de seguridad.

### POST /api/v1/employees
Crea los datos básicos del empleado envolviendo `prc_crear_datos_basicos`.

**Request**
```json
{
  "idNumber": "12345678",
  "idType": "V",
  "nationality": "VENEZOLANO",
  "firstName": "MARIA",
  "middleName": "ALEJANDRA",
  "lastName": "PEREZ",
  "secondLastName": "GOMEZ",
  "birthDate": "1990-05-14",
  "gender": "F",
  "maritalStatus": "SOLTERA",
  "address": "AV LIBERTADOR",
  "city": "CARACAS",
  "phone": "02121234567",
  "mobile": "04141234567",
  "email": "maria.perez@mail.com"
}
```

Obligatorios: `idNumber`, `nationality`, `firstName`, `lastName`, `birthDate`, `gender` (los NOT NULL de `EO_PERSONA`). El resto opcional.

**Response sugerida** (201)
```json
{
  "idNumber": "12345678",
  "message": "TRANSACCION EXITOSA"
}
```

**Notas**
- El API arma `I_JSON = {"employees":[{...}]}` y llama `prc_merge_employee(I_JSON, O_COD, O_MESSAGE)`; el procedimiento hace `MERGE` sobre `EO_PERSONA` usando `JSON_TABLE` (patrón FTD), casando por `NUM_IDEN`.
- `gender` viaja como `M`/`F` en el API; el PKG lo traduce a `SEXO` `'1'`/`'2'` con `DECODE`.
- Validación por campo con class-validator (longitudes reales de columna: `firstName` ≤17, `middleName` ≤15, etc.) → 400 con detalle. Duplicado → 409. `O_COD` distinto de éxito → 422 con `O_MESSAGE`.

### POST /api/v1/employees/search
Consulta un empleado por identificación sobre `INFOCENT.EO_PERSONA`. **Lectura por POST (estándar Farmatodo P2C):** el `idNumber` viaja en el body (cifrable como `RequestJson`), nunca en la URL, para no filtrar la cédula en logs/proxies. Request: `{ "idNumber": "12345678" }`.

**Response sugerida** (200)
```json
{
  "idNumber": "12345678",
  "nationality": "V",
  "firstName": "MARIA",
  "lastName": "PEREZ",
  "birthDate": "1990-05-14T00:00:00.000Z",
  "gender": "F"
}
```

**Notas**
- No existe → 404 con formato de error estándar.

### POST /api/v1/employees/list
Listado paginado. `page`/`size` van en el body. Request: `{ "page": 1, "size": 20 }`.

**Response sugerida** (200)
```json
{
  "page": 1,
  "size": 20,
  "items": [ { "idNumber": "12345678", "firstName": "MARIA" } ]
}
```

**Notas**
- `size` máximo 100. Paginación con `OFFSET/FETCH`.

### POST /api/v1/employees/update
Actualización parcial de datos básicos. `idNumber` (requerido) + campos a actualizar, todo en el body. Request: `{ "idNumber": "12345678", "firstName": "MARIA ALEJANDRA" }`.

**Request**
```json
{
  "firstName": "MARIA ALEJANDRA"
}
```

**Response sugerida** (200): el empleado actualizado (mismo shape del GET).

**Notas**
- PKG-first: si `pkg_management_employee` expone procedimiento de actualización, se envuelve; fallback: UPDATE controlado. [PENDIENTE: resultado Task 0]
- Body vacío → 422 "Nothing to update".

### POST /api/v1/employees/delete
Borrado lógico (`IN_REL_TRAB='N'`). `idNumber` en el body. Request: `{ "idNumber": "12345678" }`. Responde 204 sin body. No existe → 404.

### GET /health · GET /health/ready
Liveness y readiness (incluye países con pool activo). Públicos, para Cloud Run.

## 7-bis. Seguridad y cifrado de payload

**Controles aplicados (defensa en profundidad):**

| Control | Implementación |
|---|---|
| Autenticación | JWT **RS256**, algoritmo fijado, TTL 12h; llaves en Secret Manager |
| Autorización por país | Guard valida el claim `countries` del token vs `X-Country-Code` → **403** si no autorizado |
| Cifrado en tránsito | TLS terminado en Cloud Run + **HSTS** (`helmet`). El servicio siempre va detrás de TLS |
| Cifrado de payload (P2C) | **CryptoJS.AES** (`crypto-js`) — ver detalle abajo |
| Rate limiting | `@nestjs/throttler`: 60 req/min global, **10 req/min** en `/auth/token` (429) |
| CORS | Allowlist por `CORS_ORIGINS` (ej. `https://mi-portal.farmatodo.com`), `credentials: true` |
| Cabeceras | `helmet` (HSTS, `X-Content-Type-Options`, `X-Frame-Options`, etc.) |
| Credenciales de cliente | Hash SHA-256, comparación en **tiempo constante** (`crypto.timingSafeEqual`) |
| Superficie | Swagger `/docs` deshabilitado en producción (salvo `SWAGGER_ENABLED=true`) |
| Validación | `class-validator` con `whitelist`/`forbidNonWhitelisted` (sin mass-assignment) |
| SQL injection | El PKG parametriza con `JSON_TABLE`; el API nunca concatena SQL |

**Cifrado de payload (compatible con el front Farmatodo):**

- Librería: **`crypto-js`** (misma que usa el portal), esquema `CryptoJS.AES.encrypt(JSON.stringify(data), KEY)` → base64 con prefijo `Salted__` (formato OpenSSL, AES-CBC + KDF por passphrase).
- **Request:** el front envía el campo **`RequestJson`** (form-urlencoded o JSON) con el body cifrado. El `PayloadCryptoInterceptor` lo descifra **antes** de la validación, así los DTOs operan sobre el JSON en claro.
- **Response:** cuando el request llegó cifrado, la respuesta se devuelve como **`ResponseJson`** cifrado con la misma passphrase.
- **Llave:** passphrase compartida en `PAYLOAD_ENCRYPTION_KEY` (Secret Manager). Vacía = cifrado deshabilitado.
- **Compatibilidad:** el cifrado se activa por presencia de `RequestJson`; los requests en claro siguen funcionando (útil para pruebas internas). Payload cifrado inválido → **400**.

```
Front (crypto-js)                 ftd-spi-employee
  data → CryptoJS.AES.encrypt ──► RequestJson (cifrado)
                                   └► interceptor descifra → DTO valida → PKG
  CryptoJS.AES.decrypt ◄────────── ResponseJson (cifrado) ◄── interceptor cifra
```

## 8. Contratos propuestos

| Flujo | Quién llama | Quién responde | Contrato clave |
|---|---|---|---|
| Emisión de token | Sistema cliente (RRHH/integraciones) | `ftd-spi-employee` | `client_id`/`client_secret` → JWT RS256, `expires_in: 43200` |
| CRUD empleados | Sistema cliente | `ftd-spi-employee` | JSON en inglés + headers `Authorization` y `X-Country-Code` |
| Creación en SPI | `ftd-spi-employee` (repository) | BD Oracle SPI (`corsox.pkg_management_employee`) | Binds nombrados desde `EMPLOYEE_FIELD_MAP`; OUT: código + mensaje |
| Consulta en SPI | `ftd-spi-employee` (repository) | BD Oracle SPI (`INFOCENT.EO_PERSONA`) | SELECT parametrizado; fila → JSON inglés vía diccionario |

## 9. Modelo de datos mínimo

El servicio **no crea tablas propias**: opera sobre `INFOCENT.EO_PERSONA` (estructura real confirmada) a través de `corsox.pkg_management_employee` con el contrato JSON estándar FTD.

**Mapeo campo API → columna `EO_PERSONA`:**

| Campo API | Columna | Tipo / Regla |
|---|---|---|
| `idNumber` | `NUM_IDEN` | VARCHAR2(20), indexado (IDXEO_PER01) — identificador de negocio del API |
| `idType` | `ID_TIPO_IDEN` | VARCHAR2(2), FK a `EO_TIPO_IDENTIFICACION` |
| `nationality` | `NACIONAL` | VARCHAR2(50) NOT NULL |
| `passport` | `PASAPORTE` | VARCHAR2(10) |
| `firstName` / `middleName` | `NOMBRE1` / `NOMBRE2` | VARCHAR2(17) NOT NULL / VARCHAR2(15) |
| `lastName` / `secondLastName` | `APELLIDO1` / `APELLIDO2` | VARCHAR2(17) NOT NULL / VARCHAR2(15) |
| `birthDate` | `FECHA_NA` | DATE NOT NULL (API: `YYYY-MM-DD`) |
| `gender` | `SEXO` | VARCHAR2(1) NOT NULL — API `M`/`F` ↔ tabla `'1'`/`'2'` (DECODE en el PKG) |
| `maritalStatus` | `EDO_CIVIL` | VARCHAR2(30) |
| `address` / `city` | `DIRECCION` / `CIUDAD` | VARCHAR2(120) / VARCHAR2(30) |
| `phone` / `mobile` | `TELEFONO1` / `CELULAR` | VARCHAR2(15) |
| `email` | `E_MAIL1` | VARCHAR2(60) |

Notas del modelo:
- El PK `ID` (NUMBER(20)) es **interno**; el API identifica por `NUM_IDEN`. El MERGE del PKG casa por `NUM_IDEN` e inserta con secuencia para `ID`.
- `EO_PERSONA` **no tiene columna de status**: el borrado lógico usa `IN_REL_TRAB = 'N'` (indicador de relación laboral) y la auditoría usa `USRCRE/FECCRE/USRACT/FECACT`.
- `corsox.ftd_ingresos` **no se consulta**: es el origen funcional de los datos que el cliente envía en el request.
- Idempotencia: el MERGE es naturalmente idempotente por `NUM_IDEN`; validaciones del PKG → `O_COD` ≠ éxito → 422.

**Procedimientos del PKG (contrato FTD `I_JSON/O_JSON/O_COD/O_MESSAGE`):**

| Procedimiento | Entrada (I_JSON) | Salida | Uso en el API |
|---|---|---|---|
| `PRC_GET_EMPLOYEE` | `{"idNumber":"..."} ` o `{"page":n,"size":n}` | `O_JSON {"employees":[...]}` | GET by id / GET paginado |
| `PRC_MERGE_EMPLOYEE` | `{"employees":[{...}]}` | `O_COD/O_MESSAGE` | create y update vía MERGE (POST /employees y /employees/update) |
| `PRC_DELETE_EMPLOYEE` | `{"idNumber":"..."}` | `O_COD/O_MESSAGE` | borrado lógico `IN_REL_TRAB='N'` (POST /employees/delete) |

El script completo del paquete (spec + body, estilo FTD) se entrega en `db/pkg_management_employee_api.sql`.

## 10. Flujos asíncronos / continuidad

No aplica en V1: todos los flujos son síncronos request/response. Los pools de conexión se crean al bootstrap y se cierran en shutdown limpio (`onModuleDestroy`). Si a futuro la creación masiva de empleados lo requiere, la evolución natural es una carga por lotes con Cloud Tasks + outbox, fuera del alcance de esta versión.

## 11. Plan por sprints (propuesta)

| Sprint | Tiempo | Objetivo | Entregables principales |
|---|---|---|---|
| 1 | 1 semana | Fundaciones del servicio | Scaffold NestJS, config multi-país, filtro de errores estándar, middleware `X-Country-Code`, pools Oracle, auth JWT RS256 completa (Tasks 1–6 del plan) |
| 2 | 1 semana | CRUD de empleados | DTOs en inglés, `EMPLOYEE_FIELD_MAP`, repository PKG-first, controller/service, e2e, health, Swagger, cobertura ≥80% (Tasks 7–10) |
| 3 | 1 semana | Verificación BD + despliegue | Firma real del PKG (Task 0) y ajuste de binds, Docker, Cloud Build, setup GCP (secretos, VPC connector), deploy Cloud Run, integración contra espejo VE, colección Postman y Self QA (Tasks 8-ajuste, 11–12) |

## 12. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| La firma real de `prc_crear_datos_basicos` difiere de la asumida | Retrabajo en DTOs/binds; bloqueo del POST | Task 0 obligatoria antes de integrar; el diccionario `EMPLOYEE_FIELD_MAP` concentra el cambio en un solo archivo |
| El PKG no expone procedimientos de update/delete | PUT/DELETE requieren SQL directo sobre BD espejo | Fallback documentado (UPDATE controlado + borrado lógico); validar con el DBA dueño del PKG |
| Conectividad Cloud Run → BD SPI (VPC connector) no disponible a tiempo | Bloquea despliegue e integración (Sprint 3) | Solicitar el connector al equipo de redes desde el Sprint 1; desarrollo y tests no dependen de la BD |
| Agotamiento de conexiones Oracle por escalado de Cloud Run | Errores 500 intermitentes bajo carga | Alinear `concurrency` de Cloud Run con `POOL_MAX`; `min-instances=1`; monitoreo de pool en `/health/ready` |
| Fuga de secretos (llaves RSA, credenciales Oracle) | Acceso indebido a datos de empleados | Secret Manager exclusivamente; nunca en repo ni logs; rotación de llaves documentada |
| TTL de 12 h del token comprometido | Ventana amplia de uso indebido | Claim `countries` limita alcance por cliente; revocación por rotación de llaves; logging con `sub` para auditoría |

## 13. Stack y librerías

| Propósito | Librería / Tecnología |
|---|---|
| Runtime / framework | Node 20 LTS · NestJS 10 · TypeScript |
| Oracle | `oracledb` (thin mode) |
| Autenticación JWT | `@nestjs/passport` · `passport-jwt` · `jsonwebtoken` (RS256) |
| **Cifrado de payload** | **`crypto-js`** (CryptoJS.AES, compatible con el front) |
| Rate limiting | `@nestjs/throttler` |
| Cabeceras de seguridad | `helmet` |
| Validación | `class-validator` · `class-transformer` |
| Documentación API | `@nestjs/swagger` (OpenAPI) |
| Configuración | `@nestjs/config` |
| Pruebas | `jest` · `supertest` (cobertura lcov ≥80% → SonarQube) |
| Contenedor / CI-CD | Docker (`node:20-slim`) · Cloud Build · Cloud Run · Artifact Registry · Secret Manager |

## 14. Conclusión

La V1 construye un servicio NestJS multi-tenant que expone el CRUD de empleados del SPI cumpliendo las cinco premisas: nube nativa GCP (Cloud Run), JWT RS256 con TTL de 12 horas, aislamiento por país vía `X-Country-Code`, diseño REST estricto y operación vía el paquete estándar del esquema `corsox`. Además incorpora el estándar de seguridad de Farmatodo: **cifrado de payload front↔back con `crypto-js` (CryptoJS.AES)**, rate limiting, HSTS, CORS restringido y autorización por país. La separación de responsabilidades clave es: la lógica de negocio permanece en los paquetes Oracle (PKG-first), el servicio aporta el contrato REST en inglés, la seguridad, el cifrado y el enrutamiento multi-tenant. La evolución recomendada es habilitar AR/CO por configuración una vez existan sus BD espejo, y evaluar carga por lotes asíncrona si el volumen de ingresos lo demanda.
