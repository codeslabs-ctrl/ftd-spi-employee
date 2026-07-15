# ftd-spi-employee

API RESTful multi-tenant para la gestión de empleados del sistema SPI (Farmatodo Digital).

- **Stack:** NestJS 10 · Node 20 · oracledb (thin) · JWT RS256 (TTL 12h) · Cloud Run (GCP)
- **Multi-tenancy:** header `X-Country-Code` (ISO 3166-1 alfa-2) enruta al pool Oracle del país. **VE y CO activos**; AR se habilita solo con variables `DB_AR_*`.
- **PKG-first:** toda la operación pasa por `corsox.pkg_management_employee` con el contrato FTD `I_JSON CLOB → O_JSON / O_COD / O_MESSAGE`. Script del paquete en [db/pkg_management_employee_api.sql](db/pkg_management_employee_api.sql).
- **Seguridad:** cifrado de payload front↔back con **CryptoJS.AES** (`crypto-js`, campos `RequestJson`/`ResponseJson`), autorización por país (claim `countries` → 403), rate limiting (`@nestjs/throttler`), `helmet`+HSTS, CORS por origen y comparación de secreto en tiempo constante.

## Seguridad y cifrado de payload

El body puede viajar cifrado (estándar P2C de Farmatodo), usando la librería **`crypto-js`** — la misma del front:

- El cliente envía el campo **`RequestJson`** = `CryptoJS.AES.encrypt(JSON.stringify(data), KEY).toString()`.
- El servicio descifra antes de validar y responde **`ResponseJson`** cifrado con la misma passphrase.
- Passphrase compartida en `PAYLOAD_ENCRYPTION_KEY` (Secret Manager). Vacía = cifrado deshabilitado; los requests en claro siguen funcionando.
- Orígenes de navegador permitidos en `CORS_ORIGINS`.
- **Sin cédula en la URL:** todas las operaciones (search/list/update/delete) usan POST con el identificador en el body (cifrable), para que la cédula nunca viaje en la URL ni quede en logs.

Detalle completo en el SDD ([docs/sdd/](docs/sdd/), sección 7-bis) y ejemplos en [docs/testing/](docs/testing/) y la colección Postman (folder *Encrypted (P2C)*).

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/ftd-spi-employee/rest/security/token` | Emite JWT RS256 (client_id/client_secret) |
| POST | `/ftd-spi-employee/rest/employee/create` | Crea empleado (`prc_merge_employee`) |
| POST | `/ftd-spi-employee/rest/employee/get` | Consulta por identificación (idNumber en el body, no en la URL) |
| POST | `/ftd-spi-employee/rest/employee/list` | Listado paginado (page/size en el body) |
| POST | `/ftd-spi-employee/rest/employee/update` | Actualización parcial (idNumber en el body) |
| POST | `/ftd-spi-employee/rest/employee/delete` | Borrado lógico `IN_REL_TRAB='N'` (idNumber en el body) |
| GET | `/health` · `/health/ready` | Liveness / readiness (públicos) |

Swagger: `/docs`.

## Desarrollo

```bash
npm ci
cp .env.example .env   # completar llaves JWT y credenciales por país
npm run start:dev
```

Tests y quality gate (SonarQube ≥80%):

```bash
npm run lint && npm test -- --coverage && npm run test:e2e
```

## Multi-tenant (países)

Un solo despliegue atiende varios países. El header `X-Country-Code` enruta cada request al pool Oracle correspondiente. Habilitar un país = **solo configuración**, sin cambios de código:

1. Agregar su bloque `DB_<CC>_*` al `.env` (connect string + user + password).
2. Incluir el código de país en `API_CLIENTS_JSON` → `countries` del cliente (si no, el guard responde `403`).

Ambientes QA probados:

| País | Header | BD (QA) | Esquema |
|---|---|---|---|
| Venezuela | `X-Country-Code: VE` | `dlved347:1521/NOMQAVE` | `people_one` |
| Colombia | `X-Country-Code: CO` | `dlcod321.farmatodo.com:1521/NOMQACO` | `people_one` |
| Argentina | `X-Country-Code: AR` | *(pendiente de BD)* | — |

`GET /health/ready` reporta los países con pool activo, ej. `{"status":"ok","countries":["CO","VE"]}`.

## Pruebas locales (modo sin Oracle)

Levanta el servicio con un repositorio en memoria (`FAKE_DB`) y el cifrado de payload activo, sin necesidad de Oracle:

```bash
# PowerShell
$env:FAKE_DB="true"; $env:PAYLOAD_ENCRYPTION_KEY="portal-shared-key-2026"; node dist/main.js
# bash
FAKE_DB=true PAYLOAD_ENCRYPTION_KEY="portal-shared-key-2026" node dist/main.js
```

> ⚠️ **Credenciales SOLO para pruebas locales / demo.** No usar en producción. Los secretos reales viven en GCP Secret Manager y nunca se commitean.

| Variable | Valor de prueba | Uso |
|---|---|---|
| `clientId` | `hr-integration` | Cliente registrado en el `.env` local |
| `clientSecret` | `local-secret-2026` | Secreto del cliente para `POST /security/token` |
| `PAYLOAD_ENCRYPTION_KEY` / `payloadKey` (Postman) | `portal-shared-key-2026` | Passphrase compartida del cifrado de payload (CryptoJS.AES) |
| `X-Country-Code` | `VE` | Único país habilitado en la fase 1 |

En Postman, la colección viene pre-cargada con `clientSecret` y `payloadKey` en estos valores (pestaña **Variables** de la colección). El `.env.example` mantiene los campos vacíos a propósito — se completan localmente.

## Documentación

- SDD: [docs/sdd/](docs/sdd/)
- Diseño y plan: [docs/superpowers/](docs/superpowers/)
- Setup GCP y despliegue: [docs/deploy/gcp-setup.md](docs/deploy/gcp-setup.md)
- Pruebas (Postman/cURL): [postman/](postman/) · [docs/testing/](docs/testing/)
