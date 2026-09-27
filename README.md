# ftd-spi-employee

API RESTful multi-tenant para gestión de empleados SPI (Farmatodo Digital).

**Runtime:** Express + TypeScript · arquitectura tipo arquetipo FTD (Clean/DDD folders) · **App Engine**  
**Contratos HTTP:** los mismos del servicio Nest original (paths, JSON, cifrado P2C). No se usa el envelope `cod`/`sizeObject` en el wire SPI.

## Contratos HTTP (congelados)

| Método | Ruta | Notas |
|---|---|---|
| POST | `/ftd-spi-employee/rest/security/token` | `{ access_token, token_type, expires_in }` |
| POST | `/ftd-spi-employee/rest/employee/create` | `201` `{ idNumber, message }` |
| POST | `/ftd-spi-employee/rest/employee/get` | employee |
| POST | `/ftd-spi-employee/rest/employee/list` | `{ page, size, items }` |
| POST | `/ftd-spi-employee/rest/employee/update` | employee |
| POST | `/ftd-spi-employee/rest/employee/delete` | `204` |
| POST | `/ftd-spi-employee/rest/position/create` | `201` `{ companyId, id, message }` |
| POST | `/ftd-spi-employee/rest/position/update` | position |
| POST | `/ftd-spi-employee/rest/position/get` | position |
| POST | `/ftd-spi-employee/rest/position/list` | `{ page, size, items }` |
| POST | `/ftd-spi-employee/rest/company/get` | company |
| POST | `/ftd-spi-employee/rest/company/list` | `{ page, size, items }` |
| POST | `/ftd-spi-employee/rest/marital-status/list` | `{ page, size, items }` |
| POST | `/ftd-spi-employee/rest/job-post/get` | job-post |
| POST | `/ftd-spi-employee/rest/job-post/list` | `{ page, size, items }` |
| POST | `/ftd-spi-employee/rest/org-unit/get` | org-unit |
| POST | `/ftd-spi-employee/rest/org-unit/list` | `{ page, size, items }` |
| POST | `/ftd-spi-employee/rest/catalogs/<catálogo>/list` | `{ page, size, items }` — ver tabla de catálogos abajo |
| POST | `/ftd-spi-employee/rest/catalogs/validate-reentry` | `{ numIden, declaredReingreso, reingreso, corrected, value }` — único endpoint de catalogs que escribe |
| GET | `/health` · `/health/ready` | públicos |

## Catálogos (`/catalogs/<clave>/list`)

Un solo paquete Oracle (`CATALOGS_PKG`, ver `db/pkg_management_catalogs_api.sql`) para todos los catálogos de solo lectura. Mensajes de error en español (capa aparte, `src/shared/oracle/catalog-pkg-assert.ts`, no afecta los demás módulos).

| Clave (`key`) | Catálogo |
|---|---|
| `municipalities` | Municipios |
| `countries` | Países |
| `parishes` | Parroquias |
| `localities` | Localidades |
| `cities` | Ciudades (validación de ciudad) |
| `states` | Entidades federales (siglas de estados) |
| `payroll-types` | Tipos de nómina |
| `groups` | Descripción de grupos |
| `branches` | Sucursales |
| `banks` | Bancos (validación de banco) |
| `account-types` | Tipos de cuenta para depósito |
| `id-types` | Tipos de identificación |
| `termination-reasons` | Causales de retiro/terminación |
| `change-reasons` | Motivos de cambio/movimiento |
| `pension-funds` | Fondos de pensión (AFP) — solo Colombia |
| `health-providers` | Entidades promotoras de salud (EPS) — solo Colombia |
| `compensation-funds` | Cajas de compensación — solo Colombia |
| `severance-funds` | Fondos de cesantías — solo Colombia |
| `contract-types` | Tipos de contrato de trabajo ("Contrato") |

Filtros opcionales (`companyId`, `countryCode`, `stateCode`, `municipalityId`, `payrollTypeCode`, según el catálogo) van en el mismo body junto a `page`/`size` — ver `ListCatalogDto`. Antes de 2026-07-29 estos filtros estaban implementados en Oracle pero bloqueados por el DTO de Node (`property X should not exist`, 400) — ya está corregido.

`POST /catalogs/validate-reentry` — `{ numIden, reingreso }` → `{ numIden, declaredReingreso, reingreso, corrected, value }`. Único endpoint de catalogs que escribe: si `reingreso` no coincide con lo que hay en `EO_PERSONA`/`TA_RELACION_LABORAL`, el PKG corrige `FTD_INGRESOS.REINGRESO`. Ver `PRC_VALIDATE_REENTRY` en `db/pkg_management_catalogs_api.sql`.

**Cifrado P2C:** si el body trae `RequestJson` (CryptoJS.AES) → se desencripta → respuesta `{ ResponseJson }`. Por defecto, requests en claro siguen funcionando (compatibilidad). Con `REQUIRE_ENCRYPTED_PAYLOAD=true`, los endpoints de negocio (todo excepto `/health` y `/security/token`) rechazan con `400` cualquier request sin `RequestJson`. Errores: `{ statusCode, message, errors, timestamp, path }`.

Headers: `Authorization: Bearer`, `X-Country-Code`.

## Estructura (arquetipo)

```
src/
  application/          # (reservado)
  config/               # env, configuration, Oracle pools
  domain/               # models
  infrastructure/log/   # Winston + GCP Logging
  interfaces/           # middlewares, routes
  modules/              # auth, employee, position, company, marital-status, job-post, org-unit, health
  shared/               # errors, utils
```

## Desarrollo

```bash
npm ci
cp .env.example .env   # completar JWT y DB_*
npm run dev
```

Sin Oracle:

```bash
# PowerShell
$env:FAKE_DB="true"; npm run dev
```

Tests:

```bash
npm test
npm run test:e2e
```

## Deploy App Engine (patrón arquetipo)

```bash
cp app.template.yaml app.yaml
# o: npm run sync-env   # desde .env.production → app.yaml
npm run build-gcp
gcloud app deploy
# o: npm run deploy
```

PPAP paso a paso: [docs/deploy/PPAP-ftd-spi-employee.md](docs/deploy/PPAP-ftd-spi-employee.md)

## Documentación

Documentación vigente **v2.0** (Express + App Engine + 6 recursos). Los `v1.0` se conservan como histórico.

- SDD: [docs/sdd/2026-07-16-SDD-ftd-spi-employee-v2.0.md](docs/sdd/2026-07-16-SDD-ftd-spi-employee-v2.0.md) · [.docx](docs/sdd/SDD-ftd-spi-employee-v2.0.docx)
- Revisión de Seguridad: [docs/security/Revision-Seguridad-ftd-spi-employee-v2.0.docx](docs/security/Revision-Seguridad-ftd-spi-employee-v2.0.docx)
- Self-QA: [docs/selfqa/SelfQA_ftd-spi-employee_v2.0.docx](docs/selfqa/SelfQA_ftd-spi-employee_v2.0.docx) · [.pdf](docs/selfqa/SelfQA_ftd-spi-employee_v2.0.pdf)
- cURLs de prueba: [docs/testing/curls-ftd-spi-employee-v2.0.md](docs/testing/curls-ftd-spi-employee-v2.0.md) · [.docx](docs/testing/Curls-ftd-spi-employee-v2.0.docx)
- Setup GCP / runbook: [docs/deploy/gcp-setup.md](docs/deploy/gcp-setup.md) · PPAP: [docs/deploy/PPAP-ftd-spi-employee.md](docs/deploy/PPAP-ftd-spi-employee.md)
- Postman Employee (P2C): [postman/ftd-spi-employee.postman_collection.json](postman/ftd-spi-employee.postman_collection.json)
- Postman CRUD adicionales (P2C): [postman/ftd-spi-additional-crud.postman_collection.json](postman/ftd-spi-additional-crud.postman_collection.json)
- Postman Catalogs (P2C): [postman/ftd-spi-catalogs.postman_collection.json](postman/ftd-spi-catalogs.postman_collection.json) — generada con `node scripts/build-catalogs-postman.js` (20 catálogos + validate-reentry)
- Postman Error Handling (P2C): [postman/ftd-spi-error-handling.postman_collection.json](postman/ftd-spi-error-handling.postman_collection.json) — generada con `node scripts/build-error-handling-postman.js`, enfocada en validar el manejo de errores en español (PKG_GLOBAL_ERRORS) por los caminos alcanzables vía HTTP
- Postman Security Verification: [postman/ftd-spi-security-verification.postman_collection.json](postman/ftd-spi-security-verification.postman_collection.json) — generada con `node scripts/build-security-verification-postman.js`, verifica en vivo los 3 fixes del pentest 2026-08-06 (orden auth-antes-de-cifrado, cabeceras Permissions-Policy/Cache-Control, CORS sin métodos innecesarios). Ver `docs/security/Remediacion-Pentest-ftd-spi-employee-backend-2026-08-07.docx`.
- Postman Pagination Flag (P2C): [postman/ftd-spi-pagination-flag.postman_collection.json](postman/ftd-spi-pagination-flag.postman_collection.json) — generada con `node scripts/build-pagination-flag-postman.js`, verifica el flag `paginate` (pedido de PeopleOne 2026-09-23) en los 7 grupos de endpoints de listado: default = paginado de siempre, `paginate:false` = devuelve todo en un solo response.
