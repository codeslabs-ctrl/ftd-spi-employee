# FTD SPI Employee API — cURLs de prueba (v2.0)

Equivalentes a las colecciones `postman/ftd-spi-employee.postman_collection.json` (Employee) y
`postman/ftd-spi-additional-crud.postman_collection.json` (position, company, marital-status, job-post, org-unit).
Todas las operaciones de negocio van cifradas (estándar **P2C** con `crypto-js`), como las llama el front.
Sintaxis bash (Git Bash / Linux / macOS). En PowerShell usar `curl.exe`.

> **v2.0:** runtime Express + App Engine; se agregan los 5 recursos nuevos. Contratos HTTP sin cambios respecto a v1.0.

## Variables y helpers

> ⚠️ Credenciales SOLO para pruebas locales / demo (modo `FAKE_DB`). No usar en producción; los secretos reales viven en GCP (`app.yaml` / Secret Manager).

```bash
export BASE_URL="http://localhost:8080"        # local (App Engine: https://<GAE-URL>)
export CLIENT_ID="hr-integration"
export CLIENT_SECRET="local-secret-2026"
export PAYLOAD_KEY="portal-shared-key-2026"    # = PAYLOAD_ENCRYPTION_KEY del backend
export CC="VE"                                  # país: VE o CO

# cifra el JSON de stdin y lo devuelve como texto (CryptoJS.AES)
enc() { node -e 'const C=require("crypto-js");let d="";process.stdin.on("data",c=>d+=c).on("end",()=>process.stdout.write(C.AES.encrypt(d,process.env.PAYLOAD_KEY).toString()))'; }
# descifra el ResponseJson de la respuesta (o la deja igual si no viene cifrada)
dec() { node -e 'const C=require("crypto-js");let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const r=JSON.parse(d);process.stdout.write(r.ResponseJson?C.AES.decrypt(r.ResponseJson,process.env.PAYLOAD_KEY).toString(C.enc.Utf8):d)})'; }
# POST cifrado: post <ruta> '<json>'
post() { curl -s -X POST "$BASE_URL/ftd-spi-employee/rest/$1" -H "Authorization: Bearer $TOKEN" -H "X-Country-Code: $CC" -H "Content-Type: application/x-www-form-urlencoded" --data-urlencode "RequestJson=$(printf '%s' "$2" | enc)"; }
```

---

## 1. Autenticación

### 1.1 Obtener token (200)

```bash
export TOKEN=$(curl -s -X POST "$BASE_URL/ftd-spi-employee/rest/security/token" \
  -H "Content-Type: application/json" \
  -d '{"client_id":"'"$CLIENT_ID"'","client_secret":"'"$CLIENT_SECRET"'"}' | jq -r .access_token)
echo "$TOKEN"
```

Respuesta — `200`, `expires_in: 43200` (12 h).

### 1.2 Credenciales inválidas (401)

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$BASE_URL/ftd-spi-employee/rest/security/token" \
  -H "Content-Type: application/json" \
  -d '{"client_id":"'"$CLIENT_ID"'","client_secret":"wrong"}'
```

### 1.3 Rate limit del token (429)

```bash
# > 10 req/min al endpoint de token → 429
for i in $(seq 1 12); do
  curl -s -o /dev/null -w "%{http_code} " -X POST "$BASE_URL/ftd-spi-employee/rest/security/token" \
    -H "Content-Type: application/json" -d '{"client_id":"x","client_secret":"y"}'
done; echo
```

---

## 2. Employee — CRUD (cifrado P2C)

### 2.1 Crear (201)

```bash
post employee/create '{"idNumber":"12345678","idType":"V","nationality":"VENEZOLANO","firstName":"MARIA","middleName":"ALEJANDRA","lastName":"PEREZ","secondLastName":"GOMEZ","birthDate":"1990-05-14","gender":"F","maritalStatus":"SOLTERA","city":"CARACAS","mobile":"04141234567","email":"maria.perez@mail.com"}' | dec
# -> {"idNumber":"12345678","message":"TRANSACCION EXITOSA"}
```

### 2.2 Consultar por identificación (200)

```bash
post employee/get '{"idNumber":"12345678"}' | dec
```

### 2.3 Listado paginado (200)

```bash
post employee/list '{"page":1,"size":20}' | dec
```

### 2.4 Actualizar (200)

```bash
post employee/update '{"idNumber":"12345678","firstName":"MARIA ALEJANDRA","city":"VALENCIA"}' | dec
```

### 2.5 Eliminar — borrado lógico (204)

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$BASE_URL/ftd-spi-employee/rest/employee/delete" \
  -H "Authorization: Bearer $TOKEN" -H "X-Country-Code: $CC" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "RequestJson=$(printf '%s' '{"idNumber":"12345678"}' | enc)"
# -> 204 (baja lógica; sin body)
```

---

## 3. Position — create/get/list/update (cifrado P2C)

Clave compuesta `companyId` + `id`. Único recurso nuevo con escritura.

### 3.1 Crear (201)

```bash
post position/create '{"companyId":"0001","id":"CARGO001","name":"ANALISTA DE NOMINA","classificationId":"CL01","description":"Procesa la nomina","functions":"Calcular, validar, reportar","purpose":"Garantizar pagos","risk":"BAJO"}' | dec
# -> {"companyId":"0001","id":"CARGO001","message":"TRANSACCION EXITOSA"}
```

### 3.2 Consultar (200)

```bash
post position/get '{"companyId":"0001","id":"CARGO001"}' | dec
```

### 3.3 Listado paginado (200)

```bash
post position/list '{"page":1,"size":20}' | dec
```

### 3.4 Actualizar (200)

```bash
post position/update '{"companyId":"0001","id":"CARGO001","name":"ANALISTA SR DE NOMINA","risk":"MEDIO"}' | dec
```

---

## 4. Company — get/list (solo consulta)

```bash
post company/get  '{"id":"0001"}'        | dec
post company/list '{"page":1,"size":20}' | dec
```

---

## 5. Marital-status — list (solo consulta)

```bash
post marital-status/list '{"page":1,"size":50}' | dec
```

---

## 6. Job-post — get/list (solo consulta)

Clave compuesta `companyId` + `unitId` + `id`.

```bash
post job-post/get  '{"companyId":"0001","unitId":"U001","id":"P001"}' | dec
post job-post/list '{"page":1,"size":20}'                             | dec
```

---

## 7. Org-unit — get/list (solo consulta)

Clave compuesta `companyId` + `id`.

```bash
post org-unit/get  '{"companyId":"0001","id":"U001"}' | dec
post org-unit/list '{"page":1,"size":20}'             | dec
```

---

## 8. Casos negativos

Prueban auth/tenancy antes de tocar el body, por eso van en claro (salvo el cipher inválido).

### 8.1 Sin token (401)

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$BASE_URL/ftd-spi-employee/rest/employee/get" \
  -H "Content-Type: application/json" -H "X-Country-Code: $CC" -d '{"idNumber":"12345678"}'
```

### 8.2 Sin header X-Country-Code (400)

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$BASE_URL/ftd-spi-employee/rest/employee/get" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"idNumber":"12345678"}'
```

### 8.3 País no habilitado — AR (422)

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$BASE_URL/ftd-spi-employee/rest/employee/get" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -H "X-Country-Code: AR" -d '{"idNumber":"12345678"}'
```

### 8.4 Body inválido (400 con errores por campo)

```bash
post employee/create '{"idNumber":""}' | dec
# -> {"statusCode":400,"message":"Bad Request","errors":[...]}
```

### 8.5 Position — obligatorios faltantes (400)

```bash
post position/create '{"companyId":"0001"}' | dec
# -> 400 (id y name son obligatorios)
```

### 8.6 Duplicado — employee (409)

```bash
post employee/create '{"idNumber":"12345678","nationality":"VENEZOLANO","firstName":"MARIA","lastName":"PEREZ","birthDate":"1990-05-14","gender":"F"}' | dec
# -> 409 "Employee already exists"
```

### 8.7 get sin registros (404)

```bash
post company/get '{"id":"NOEXISTE"}' | dec
# -> 404 formato de error estándar
```

### 8.8 Cipher inválido (400)

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$BASE_URL/ftd-spi-employee/rest/employee/get" \
  -H "Authorization: Bearer $TOKEN" -H "X-Country-Code: $CC" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "RequestJson=not-a-valid-cipher"
# -> 400 "Invalid encrypted payload"
```

### 8.9 Endpoint inexistente (404)

```bash
curl -s -o /dev/null -w "%{http_code}\n" "$BASE_URL/ftd-spi-employee/rest/nope/get"
# -> 404 "Endpoint not found"
```

---

## 9. Health (públicos, sin token ni header)

```bash
curl -s "$BASE_URL/health"          # {"status":"ok"}
curl -s "$BASE_URL/health/ready"    # {"status":"ok","countries":["VE","CO"]}
```

---

## Matriz de resultados esperados

| # | Caso | Ruta | Código |
|---|------|------|--------|
| 1.1 | Token válido | POST /security/token | 200 |
| 1.2 | Credenciales inválidas | POST /security/token | 401 |
| 1.3 | Rate limit token | POST /security/token | 429 |
| 2.1 | Employee crear | POST /employee/create | 201 |
| 2.2 | Employee consultar | POST /employee/get | 200 |
| 2.3 | Employee listar | POST /employee/list | 200 |
| 2.4 | Employee actualizar | POST /employee/update | 200 |
| 2.5 | Employee baja lógica | POST /employee/delete | 204 |
| 3.1 | Position crear | POST /position/create | 201 |
| 3.2 | Position consultar | POST /position/get | 200 |
| 3.3 | Position listar | POST /position/list | 200 |
| 3.4 | Position actualizar | POST /position/update | 200 |
| 4 | Company get / list | POST /company/get, /company/list | 200 |
| 5 | Marital-status list | POST /marital-status/list | 200 |
| 6 | Job-post get / list | POST /job-post/get, /job-post/list | 200 |
| 7 | Org-unit get / list | POST /org-unit/get, /org-unit/list | 200 |
| 8.1 | Sin token | POST /employee/get | 401 |
| 8.2 | Sin X-Country-Code | POST /employee/get | 400 |
| 8.3 | País no habilitado (AR) | POST /employee/get | 422 |
| 8.4 | Body inválido | POST /employee/create | 400 |
| 8.5 | Position obligatorios faltantes | POST /position/create | 400 |
| 8.6 | Duplicado | POST /employee/create | 409 |
| 8.7 | get sin registros | POST /company/get | 404 |
| 8.8 | Cipher inválido | POST /employee/get | 400 |
| 8.9 | Endpoint inexistente | (cualquiera) | 404 |
| 9 | Health / readiness | GET /health, /health/ready | 200 |

> La ruta base completa es `$BASE_URL/ftd-spi-employee/rest/...`. El caso 403 (token de un país no autorizado) está cubierto en las pruebas e2e automatizadas.
