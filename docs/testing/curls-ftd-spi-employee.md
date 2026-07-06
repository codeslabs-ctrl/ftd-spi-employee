# FTD SPI Employee API — cURLs de prueba

Equivalentes a la colección `postman/ftd-spi-employee.postman_collection.json`.
Todas las operaciones van cifradas (estándar P2C con `crypto-js`), como las llama el front.
Sintaxis bash (Git Bash / Linux / macOS). En PowerShell usar `curl.exe`.

## Variables y helpers

> ⚠️ Credenciales SOLO para pruebas locales / demo (modo `FAKE_DB`). No usar en producción; los secretos reales viven en GCP Secret Manager.

```bash
export BASE_URL="http://localhost:8080"        # local (Cloud Run: https://<host>)
export CLIENT_ID="hr-integration"
export CLIENT_SECRET="local-secret-2026"
export PAYLOAD_KEY="portal-shared-key-2026"    # = PAYLOAD_ENCRYPTION_KEY del backend

# cifra el JSON de stdin y lo devuelve como texto (CryptoJS.AES)
enc() { node -e 'const C=require("crypto-js");let d="";process.stdin.on("data",c=>d+=c).on("end",()=>process.stdout.write(C.AES.encrypt(d,process.env.PAYLOAD_KEY).toString()))'; }
# descifra el ResponseJson de la respuesta (o la deja igual si no viene cifrada)
dec() { node -e 'const C=require("crypto-js");let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const r=JSON.parse(d);process.stdout.write(r.ResponseJson?C.AES.decrypt(r.ResponseJson,process.env.PAYLOAD_KEY).toString(C.enc.Utf8):d)})'; }
# POST cifrado: post <ruta> '<json>'
post() { curl -s -X POST "$BASE_URL/ftd-spi-employee/rest/$1" -H "Authorization: Bearer $TOKEN" -H "X-Country-Code: VE" -H "Content-Type: application/x-www-form-urlencoded" --data-urlencode "RequestJson=$(printf '%s' "$2" | enc)"; }
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

---

## 2. CRUD de empleados (cifrado P2C)

Todas usan el helper `post` (cifra el body) y `dec` (descifra la respuesta).

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
  -H "Authorization: Bearer $TOKEN" -H "X-Country-Code: VE" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "RequestJson=$(printf '%s' '{"idNumber":"12345678"}' | enc)"
# -> 204 (marca IN_REL_TRAB='N'; sin body)
```

---

## 3. Casos negativos

Prueban auth/tenancy antes de tocar el body, por eso van en claro.

### 3.1 Sin token (401)

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$BASE_URL/ftd-spi-employee/rest/employee/get" \
  -H "Content-Type: application/json" -H "X-Country-Code: VE" -d '{"idNumber":"12345678"}'
```

### 3.2 Sin header X-Country-Code (400)

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$BASE_URL/ftd-spi-employee/rest/employee/get" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"idNumber":"12345678"}'
```

### 3.3 País no habilitado — AR (422)

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$BASE_URL/ftd-spi-employee/rest/employee/get" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -H "X-Country-Code: AR" -d '{"idNumber":"12345678"}'
```

### 3.4 Body inválido (400 con errores por campo)

```bash
post employee/create '{"idNumber":""}' | dec
# -> {"statusCode":400,"message":"Bad Request","errors":[...]}
```

### 3.5 Duplicado (409)

```bash
# repetir 2.1 con la misma cédula ya creada
post employee/create '{"idNumber":"12345678","nationality":"VENEZOLANO","firstName":"MARIA","lastName":"PEREZ","birthDate":"1990-05-14","gender":"F"}' | dec
# -> 409 "Employee already exists"
```

### 3.6 Cipher inválido (400)

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$BASE_URL/ftd-spi-employee/rest/employee/get" \
  -H "Authorization: Bearer $TOKEN" -H "X-Country-Code: VE" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "RequestJson=not-a-valid-cipher"
# -> 400 "Invalid encrypted payload"
```

---

## 4. Health (públicos, sin token ni header)

```bash
curl -s "$BASE_URL/health"          # {"status":"ok"}
curl -s "$BASE_URL/health/ready"    # {"status":"ok","countries":["VE"]}
```

---

## Matriz de resultados esperados

| # | Caso | Ruta | Código |
|---|------|------|--------|
| 1.1 | Token válido | POST /security/token | 200 |
| 1.2 | Credenciales inválidas | POST /security/token | 401 |
| 2.1 | Crear (cifrado) | POST /employee/create | 201 |
| 2.2 | Consultar por id (cifrado) | POST /employee/get | 200 |
| 2.3 | Listado paginado (cifrado) | POST /employee/list | 200 |
| 2.4 | Actualizar (cifrado) | POST /employee/update | 200 |
| 2.5 | Borrado lógico (cifrado) | POST /employee/delete | 204 |
| 3.1 | Sin token | POST /employee/get | 401 |
| 3.2 | Sin X-Country-Code | POST /employee/get | 400 |
| 3.3 | País no habilitado (AR) | POST /employee/get | 422 |
| 3.4 | Body inválido | POST /employee/create | 400 |
| 3.5 | Duplicado | POST /employee/create | 409 |
| 3.6 | Cipher inválido | POST /employee/get | 400 |
| 4 | Health / readiness | GET /health, /health/ready | 200 |

> La ruta base completa es `$BASE_URL/ftd-spi-employee/rest/...`. El caso 403 (token de un país no autorizado) está cubierto en las pruebas e2e automatizadas.
