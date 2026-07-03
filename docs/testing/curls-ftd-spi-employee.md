# FTD SPI Employee API — cURLs de prueba

Equivalentes a la colección `postman/ftd-spi-employee.postman_collection.json`.
Sintaxis bash (Git Bash / Linux / macOS). En PowerShell usar `curl.exe` en lugar de `curl`.

## Variables

> ⚠️ Credenciales SOLO para pruebas locales / demo (modo `FAKE_DB`). No usar en producción; los secretos reales viven en GCP Secret Manager.

```bash
export BASE_URL="http://localhost:8080"        # local
# export BASE_URL="https://ftd-spi-employee-<hash>-ue.a.run.app"   # Cloud Run
export CLIENT_ID="hr-integration"
export CLIENT_SECRET="local-secret-2026"       # secreto de prueba local
export PAYLOAD_KEY="portal-shared-key-2026"    # passphrase de cifrado (= PAYLOAD_ENCRYPTION_KEY del backend)
```

---

## 1. Autenticación

### 1.1 Obtener token (200)

```bash
curl -s -X POST "$BASE_URL/api/v1/auth/token" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "'"$CLIENT_ID"'",
    "client_secret": "'"$CLIENT_SECRET"'"
  }'
```

Respuesta esperada — `200`, `expires_in: 43200` (12 h):

```json
{ "access_token": "eyJhbGciOiJSUzI1NiIs...", "token_type": "Bearer", "expires_in": 43200 }
```

Guardar el token para el resto de las pruebas:

```bash
export TOKEN=$(curl -s -X POST "$BASE_URL/api/v1/auth/token" \
  -H "Content-Type: application/json" \
  -d '{"client_id":"'"$CLIENT_ID"'","client_secret":"'"$CLIENT_SECRET"'"}' | jq -r .access_token)
```

### 1.2 Credenciales inválidas (401)

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$BASE_URL/api/v1/auth/token" \
  -H "Content-Type: application/json" \
  -d '{"client_id":"'"$CLIENT_ID"'","client_secret":"wrong"}'
```

Esperado: `401`.

---

## 2. CRUD de empleados (VE)

### 2.1 Crear empleado (201)

```bash
curl -s -X POST "$BASE_URL/api/v1/employees" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Country-Code: VE" \
  -d '{
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
  }'
```

Esperado — `201`:

```json
{ "idNumber": "12345678", "message": "TRANSACCION EXITOSA" }
```

### 2.2 Consultar por identificación (POST search, 200)

La cédula va en el body (no en la URL) — estilo Farmatodo P2C.

```bash
curl -s -X POST "$BASE_URL/api/v1/employees/search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Country-Code: VE" \
  -d '{ "idNumber": "12345678" }'
```

Esperado — `200` con el empleado en claves inglesas (`idNumber`, `firstName`, `gender: "F"`, ...).

### 2.3 Listado paginado (POST list, 200)

```bash
curl -s -X POST "$BASE_URL/api/v1/employees/list" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Country-Code: VE" \
  -d '{ "page": 1, "size": 20 }'
```

Esperado — `200`: `{ "page": 1, "size": 20, "items": [...] }`.

### 2.4 Actualizar (POST update, 200)

```bash
curl -s -X POST "$BASE_URL/api/v1/employees/update" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Country-Code: VE" \
  -d '{ "idNumber": "12345678", "firstName": "MARIA ALEJANDRA", "city": "VALENCIA" }'
```

Esperado — `200` con el empleado actualizado.

### 2.5 Eliminar — borrado lógico (POST delete, 204)

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$BASE_URL/api/v1/employees/delete" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Country-Code: VE" \
  -d '{ "idNumber": "12345678" }'
```

Esperado: `204` (marca `IN_REL_TRAB='N'`, no borra el registro).

---

## 3. Casos negativos

### 3.1 Sin token (401)

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$BASE_URL/api/v1/employees/search" \
  -H "Content-Type: application/json" -H "X-Country-Code: VE" \
  -d '{ "idNumber": "12345678" }'
```

### 3.2 Sin header X-Country-Code (400)

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$BASE_URL/api/v1/employees/search" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{ "idNumber": "12345678" }'
```

### 3.3 País válido pero no habilitado (422)

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$BASE_URL/api/v1/employees/search" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -H "X-Country-Code: AR" -d '{ "idNumber": "12345678" }'
```

### 3.4 Header de país mal formado (400)

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$BASE_URL/api/v1/employees/search" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -H "X-Country-Code: VEN" -d '{ "idNumber": "12345678" }'
```

### 3.5 Body inválido (400 con errores por campo)

```bash
curl -s -X POST "$BASE_URL/api/v1/employees" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Country-Code: VE" \
  -d '{ "idNumber": "" }'
```

Esperado — `400`:

```json
{ "statusCode": 400, "message": "Bad Request", "errors": ["idNumber must match ..."], "timestamp": "...", "path": "/api/v1/employees" }
```

### 3.6 Empleado inexistente (404)

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$BASE_URL/api/v1/employees/search" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -H "X-Country-Code: VE" -d '{ "idNumber": "00000000" }'
```

### 3.7 Token vencido o firma inválida (401)

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$BASE_URL/api/v1/employees/search" \
  -H "Content-Type: application/json" -H "Authorization: Bearer eyJinvalido" \
  -H "X-Country-Code: VE" -d '{ "idNumber": "12345678" }'
```

---

## 4. Health (públicos, sin token ni header)

```bash
curl -s "$BASE_URL/health"          # {"status":"ok"}
curl -s "$BASE_URL/health/ready"    # {"status":"ok","countries":["VE"]}
```

---

## 5. Payload cifrado (P2C) — librería `crypto-js`

Cuando `PAYLOAD_ENCRYPTION_KEY` está configurada en el backend, el body viaja cifrado con **CryptoJS.AES** (librería **`crypto-js`**, la misma del front): el cliente envía el campo `RequestJson` cifrado y recibe `ResponseJson` cifrado.

```bash
export PAYLOAD_KEY="portal-shared-key-2026"   # = PAYLOAD_ENCRYPTION_KEY del backend
```

### 5.1 Crear empleado cifrado (201)

```bash
CIPHER=$(node -e '
const CryptoJS = require("crypto-js");
const data = { idNumber:"12345678", nationality:"VENEZOLANO", firstName:"MARIA", lastName:"PEREZ", birthDate:"1990-05-14", gender:"F" };
process.stdout.write(CryptoJS.AES.encrypt(JSON.stringify(data), process.env.PAYLOAD_KEY).toString());
')

curl -s -X POST "$BASE_URL/api/v1/employees" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Country-Code: VE" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "RequestJson=$CIPHER"
```

Respuesta — `201`, cifrada: `{ "ResponseJson": "U2FsdGVkX1+..." }`. Descifrarla:

```bash
echo '<ResponseJson>' | node -e '
const CryptoJS = require("crypto-js");
let d=""; process.stdin.on("data",c=>d+=c).on("end",()=>
  console.log(CryptoJS.AES.decrypt(d.trim(), process.env.PAYLOAD_KEY).toString(CryptoJS.enc.Utf8)));'
# -> {"idNumber":"12345678","message":"TRANSACCION EXITOSA"}
```

### 5.2 Cipher inválido (400)

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$BASE_URL/api/v1/employees" \
  -H "Authorization: Bearer $TOKEN" -H "X-Country-Code: VE" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "RequestJson=not-a-valid-cipher"
```

Esperado: `400` ("Invalid encrypted payload").

> En **Postman**, el folder *Encrypted (P2C)* trae los scripts que cifran/descifran automáticamente con la variable `{{payloadKey}}` (CryptoJS viene integrado en Postman).

---

## Matriz de resultados esperados

| # | Caso | Método | Código |
|---|------|--------|--------|
| 1.1 | Token válido | POST /auth/token | 200 |
| 1.2 | Credenciales inválidas | POST /auth/token | 401 |
| 2.1 | Crear empleado | POST /employees | 201 |
| 2.2 | Consultar por id | POST /employees/search | 200 |
| 2.3 | Listado paginado | POST /employees/list | 200 |
| 2.4 | Actualizar | PUT /employees/{id} | 200 |
| 2.5 | Borrado lógico | DELETE /employees/{id} | 204 |
| 3.1 | Sin token | POST /employees/search | 401 |
| 3.2 | Sin X-Country-Code | POST /employees/search | 400 |
| 3.3 | País no habilitado (AR) | POST /employees/search | 422 |
| 3.4 | País mal formado (VEN) | POST /employees/search | 400 |
| 3.5 | Body inválido | POST /employees | 400 |
| 3.6 | Empleado inexistente | POST /employees/search | 404 |
| 3.7 | Token inválido | POST /employees/search | 401 |
| 4 | Health / readiness | GET /health, /health/ready | 200 |
| 5.1 | Crear cifrado (RequestJson→ResponseJson) | POST /employees | 201 |
| 5.2 | Cipher inválido | POST /employees | 400 |
