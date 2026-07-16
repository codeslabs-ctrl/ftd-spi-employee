# PPAP — Puesta en producción: ftd-spi-employee (App Engine)

Guía para plataforma / GCP. Servicio Express alineado al **arquetipo FTD** (`app.yaml` + `gcloud app deploy`).  
Los contratos HTTP SPI (incluido cifrado `RequestJson`/`ResponseJson`) **no cambian**.

---

## 0. Resumen

| Ítem | Valor |
|---|---|
| Plataforma | App Engine Standard (`nodejs22`) |
| Service | `ftd-spi-employee` |
| Entry | `node dist/index.js` |
| Prefijo API | `/ftd-spi-employee/rest` |
| Health | `GET /health` · `GET /health/ready` |

Config fuera de código: variables en `app.yaml` / sync desde `.env.production`.

---

## 1. Prerrequisitos

1. Proyecto GCP + App Engine habilitado  
2. VPC Access connector hacia Oracle (mismo patrón del arquetipo)  
3. `gcloud` autenticado y proyecto seleccionado  
4. Node 22 local para build  

---

## 2. Preparar `app.yaml`

```bash
cp app.template.yaml app.yaml
# Completar env_variables (JWT_*, DB_VE_*, DB_CO_*, API_CLIENTS_JSON, PAYLOAD_ENCRYPTION_KEY, VPC connector)

# O sincronizar desde archivo local (no commitear):
# cp .env .env.production
npm run sync-env
```

`sync-env-to-yaml.js` omite `HOST`, `PORT` y `FAKE_DB`.

---

## 3. Build y deploy

```bash
npm ci
npm run build-gcp
gcloud app deploy app.yaml
# equivalente: npm run deploy
```

---

## 4. Verificación

```bash
curl -sS https://<GAE-URL>/health
curl -sS https://<GAE-URL>/health/ready

curl -sS -X POST https://<GAE-URL>/ftd-spi-employee/rest/security/token \
  -H "Content-Type: application/json" \
  -d '{"client_id":"<id>","client_secret":"<secret>"}'
```

Validar CRUD (Bearer + `X-Country-Code`) y carpeta *Encrypted (P2C)* en Postman.

---

## 5. Cambios solo-config (sin código)

1. Editar `.env.production` o `app.yaml` `env_variables`  
2. `npm run sync-env` (si usas .env)  
3. `gcloud app deploy` (nueva versión con misma imagen de código o solo yaml)

| Cambio | ¿Código? |
|---|---|
| Passwords / JWT / clients / payload key | No |
| Connect strings / pools / PKG / timeouts / CORS | No |
| Habilitar AR (`DB_AR_*` + countries en clients) | No |
| Nueva lógica de negocio | Sí |

---

## 6. Checklist go-live

- [ ] VPC connector en `app.yaml`  
- [ ] `env_variables` completas (VE/CO)  
- [ ] `gcloud app deploy` OK  
- [ ] `/health` y `/health/ready` OK  
- [ ] Token + employee smoke VE/CO  
- [ ] Cifrado P2C OK si el portal lo usa  

Detalle técnico: [gcp-setup.md](./gcp-setup.md)
