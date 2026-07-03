# ftd-spi-employee

API RESTful multi-tenant para la gestión de empleados del sistema SPI (Farmatodo Digital).

- **Stack:** NestJS 10 · Node 20 · oracledb (thin) · JWT RS256 (TTL 12h) · Cloud Run (GCP)
- **Multi-tenancy:** header `X-Country-Code` (ISO 3166-1 alfa-2) enruta al pool Oracle del país. VE activo; AR/CO se habilitan solo con variables `DB_<CC>_*`.
- **PKG-first:** toda la operación pasa por `corsox.pkg_management_employee` con el contrato FTD `I_JSON CLOB → O_JSON / O_COD / O_MESSAGE`. Script del paquete en [db/pkg_management_employee_api.sql](db/pkg_management_employee_api.sql).
- **Seguridad:** cifrado de payload front↔back con **CryptoJS.AES** (`crypto-js`, campos `RequestJson`/`ResponseJson`), autorización por país (claim `countries` → 403), rate limiting (`@nestjs/throttler`), `helmet`+HSTS, CORS por origen y comparación de secreto en tiempo constante.

## Seguridad y cifrado de payload

El body puede viajar cifrado (estándar P2C de Farmatodo), usando la librería **`crypto-js`** — la misma del front:

- El cliente envía el campo **`RequestJson`** = `CryptoJS.AES.encrypt(JSON.stringify(data), KEY).toString()`.
- El servicio descifra antes de validar y responde **`ResponseJson`** cifrado con la misma passphrase.
- Passphrase compartida en `PAYLOAD_ENCRYPTION_KEY` (Secret Manager). Vacía = cifrado deshabilitado; los requests en claro siguen funcionando.
- Orígenes de navegador permitidos en `CORS_ORIGINS`.

Detalle completo en el SDD ([docs/sdd/](docs/sdd/), sección 7-bis) y ejemplos en [docs/testing/](docs/testing/) y la colección Postman (folder *Encrypted (P2C)*).

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/v1/auth/token` | Emite JWT RS256 (client_id/client_secret) |
| POST | `/api/v1/employees` | Crea empleado (`prc_merge_employee`) |
| GET | `/api/v1/employees/:id` | Consulta por identificación |
| GET | `/api/v1/employees?page=&size=` | Listado paginado |
| PUT | `/api/v1/employees/:id` | Actualización parcial |
| DELETE | `/api/v1/employees/:id` | Borrado lógico (`IN_REL_TRAB='N'`) |
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

## Documentación

- SDD: [docs/sdd/](docs/sdd/)
- Diseño y plan: [docs/superpowers/](docs/superpowers/)
- Setup GCP y despliegue: [docs/deploy/gcp-setup.md](docs/deploy/gcp-setup.md)
- Pruebas (Postman/cURL): [postman/](postman/) · [docs/testing/](docs/testing/)
