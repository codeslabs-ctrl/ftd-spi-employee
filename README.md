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
| GET | `/health` · `/health/ready` | públicos |

**Cifrado P2C:** si el body trae `RequestJson` (CryptoJS.AES) → se desencripta → respuesta `{ ResponseJson }`. Requests en claro siguen funcionando. Errores: `{ statusCode, message, errors, timestamp, path }`.

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
