# GCP Setup — ftd-spi-employee (App Engine)

> **PPAP paso a paso:** [PPAP-ftd-spi-employee.md](./PPAP-ftd-spi-employee.md)

Despliegue alineado al arquetipo FTD: **App Engine Standard** + `app.yaml` + `sync-env-to-yaml.js`.

El runtime Express lee `process.env` vía [`src/config/configuration.ts`](../../src/config/configuration.ts).  
Contratos HTTP SPI (Nest originales) se mantienen, incluido cifrado `RequestJson` / `ResponseJson`.

## 1. VPC connector

Requerido para Oracle on-prem / espejo. Coordinar con redes el nombre:

```yaml
vpc_access_connector:
  name: "projects/{PROJECT}/locations/{REGION}/connectors/{CONNECTOR}"
```

## 2. Variables / secretos

Usar `app.template.yaml` como base. Valores sensibles van en `env_variables` de `app.yaml` (gitignore) o se sincronizan:

```bash
npm run sync-env   # .env.production → app.yaml
```

Variables clave: `JWT_*_BASE64`, `API_CLIENTS_JSON`, `PAYLOAD_ENCRYPTION_KEY`, `DB_VE_*`, `DB_CO_*`, `EMPLOYEE_PKG`, `PKG_*`, `REQUEST_TIMEOUT_MS`, `ORACLE_*`, `CORS_ORIGINS`.

## 3. Deploy

```bash
npm ci
npm run build-gcp
gcloud app deploy app.yaml
```

## 4. Verificación

1. `GET /health` → `{"status":"ok"}`  
2. `GET /health/ready` → países con config completa  
3. Token + CRUD Postman  

## 5. Legado Cloud Run

`cloudbuild.yaml` / `Dockerfile` pueden existir como referencia histórica; el camino soportado es **App Engine** (`npm run deploy`).

## 6. Runbook sin tocar código

| Cambio | Acción |
|---|---|
| Credenciales / clients / payload | Actualizar `app.yaml` o sync-env + redeploy |
| País nuevo | `DB_<CC>_*` + claim `countries` |
| Timeouts / CORS / PKG | `env_variables` + redeploy |
| Lógica de negocio | Nuevo build + deploy |
