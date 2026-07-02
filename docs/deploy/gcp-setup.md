# GCP Setup — employee-api-spi

Prerequisitos de infraestructura para el primer despliegue. Coordinar los valores reales
(proyecto, región, red, connect string del espejo VE) con infra/redes/DBA.

## 1. Artifact Registry

```bash
gcloud artifacts repositories create apis --repository-format=docker --location=us-east1
```

## 2. Secretos (Secret Manager)

```bash
# Llaves RSA para JWT
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem
base64 -w0 private.pem | gcloud secrets create jwt-private-key --data-file=-
base64 -w0 public.pem  | gcloud secrets create jwt-public-key  --data-file=-
rm private.pem public.pem

# Credenciales Oracle VE (espejo)
echo -n "$DB_VE_PASSWORD" | gcloud secrets create db-ve-password --data-file=-

# Clientes del API: JSON [{"clientId":"hr-integration","secretHash":"<sha256hex del secret>","countries":["VE"]}]
gcloud secrets create api-clients --data-file=api-clients.json
```

Generar el `secretHash` de un cliente: `echo -n "<client_secret>" | sha256sum`.

## 3. Serverless VPC Access (prerequisito crítico)

Cloud Run no alcanza la BD SPI espejo sin un connector hacia la red donde vive Oracle.
**Solicitar temprano al equipo de redes** (rango CIDR /28 libre en la VPC):

```bash
gcloud compute networks vpc-access connectors create spi-connector \
  --region=us-east1 --network=default --range=10.8.0.0/28
```

Validar que exista ruta/firewall desde ese rango hacia el host:1521 del espejo VE.

## 4. Primer despliegue

```bash
gcloud builds submit --config cloudbuild.yaml \
  --substitutions=_REGION=us-east1,_VPC_CONNECTOR=spi-connector,_DB_VE_CONNECT_STRING="host:1521/SPI",_DB_VE_USER="corsox"
```

## 5. Verificación post-deploy

1. `GET https://<service-url>/health` → 200 `{"status":"ok"}`.
2. `GET https://<service-url>/health/ready` → 200 con `countries: ["VE"]` (confirma pool Oracle creado).
3. `GET https://<service-url>/docs` → Swagger UI.
4. Correr la colección `postman/employee-api-spi.postman_collection.json` con `baseUrl` apuntando al servicio.

## Notas de dimensionamiento

- `--concurrency=40` con `DB_VE_POOL_MAX=10`: si se observa contención de pool, bajar concurrency o subir pool en acuerdo con el DBA.
- `--min-instances=1` mantiene el pool caliente y evita cold starts con Oracle.

## Habilitar AR / CO (futuro)

1. Crear secretos `db-ar-password` / `db-co-password`.
2. Agregar en el paso de deploy: `DB_AR_CONNECT_STRING`, `DB_AR_USER` y el secret correspondiente.
3. Sin cambios de código: el bootstrap detecta la configuración y crea el pool.
