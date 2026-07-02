# Employee API SPI — cURLs de prueba

Equivalentes a la colección `postman/employee-api-spi.postman_collection.json`.
Sintaxis bash (Git Bash / Linux / macOS). En PowerShell usar `curl.exe` en lugar de `curl`.

## Variables

```bash
export BASE_URL="http://localhost:8080"        # local
# export BASE_URL="https://employee-api-spi-<hash>-ue.a.run.app"   # Cloud Run
export CLIENT_ID="hr-integration"
export CLIENT_SECRET="<secret>"
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

### 2.2 Consultar por identificación (200)

```bash
curl -s "$BASE_URL/api/v1/employees/12345678" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Country-Code: VE"
```

Esperado — `200` con el empleado en claves inglesas (`idNumber`, `firstName`, `gender: "F"`, ...).

### 2.3 Listado paginado (200)

```bash
curl -s "$BASE_URL/api/v1/employees?page=1&size=20" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Country-Code: VE"
```

Esperado — `200`: `{ "page": 1, "size": 20, "items": [...] }`.

### 2.4 Actualizar (200)

```bash
curl -s -X PUT "$BASE_URL/api/v1/employees/12345678" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Country-Code: VE" \
  -d '{ "firstName": "MARIA ALEJANDRA", "city": "VALENCIA" }'
```

Esperado — `200` con el empleado actualizado.

### 2.5 Eliminar — borrado lógico (204)

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE "$BASE_URL/api/v1/employees/12345678" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Country-Code: VE"
```

Esperado: `204` (marca `IN_REL_TRAB='N'`, no borra el registro).

---

## 3. Casos negativos

### 3.1 Sin token (401)

```bash
curl -s -o /dev/null -w "%{http_code}\n" "$BASE_URL/api/v1/employees/12345678" \
  -H "X-Country-Code: VE"
```

### 3.2 Sin header X-Country-Code (400)

```bash
curl -s -o /dev/null -w "%{http_code}\n" "$BASE_URL/api/v1/employees/12345678" \
  -H "Authorization: Bearer $TOKEN"
```

### 3.3 País válido pero no habilitado (422)

```bash
curl -s -o /dev/null -w "%{http_code}\n" "$BASE_URL/api/v1/employees/12345678" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Country-Code: AR"
```

### 3.4 Header de país mal formado (400)

```bash
curl -s -o /dev/null -w "%{http_code}\n" "$BASE_URL/api/v1/employees/12345678" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Country-Code: VEN"
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
curl -s -o /dev/null -w "%{http_code}\n" "$BASE_URL/api/v1/employees/00000000" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Country-Code: VE"
```

### 3.7 Token vencido o firma inválida (401)

```bash
curl -s -o /dev/null -w "%{http_code}\n" "$BASE_URL/api/v1/employees/12345678" \
  -H "Authorization: Bearer eyJinvalido" \
  -H "X-Country-Code: VE"
```

---

## 4. Health (públicos, sin token ni header)

```bash
curl -s "$BASE_URL/health"          # {"status":"ok"}
curl -s "$BASE_URL/health/ready"    # {"status":"ok","countries":["VE"]}
```

---

## Matriz de resultados esperados

| # | Caso | Método | Código |
|---|------|--------|--------|
| 1.1 | Token válido | POST /auth/token | 200 |
| 1.2 | Credenciales inválidas | POST /auth/token | 401 |
| 2.1 | Crear empleado | POST /employees | 201 |
| 2.2 | Consultar por id | GET /employees/{id} | 200 |
| 2.3 | Listado paginado | GET /employees | 200 |
| 2.4 | Actualizar | PUT /employees/{id} | 200 |
| 2.5 | Borrado lógico | DELETE /employees/{id} | 204 |
| 3.1 | Sin token | GET /employees/{id} | 401 |
| 3.2 | Sin X-Country-Code | GET /employees/{id} | 400 |
| 3.3 | País no habilitado (AR) | GET /employees/{id} | 422 |
| 3.4 | País mal formado (VEN) | GET /employees/{id} | 400 |
| 3.5 | Body inválido | POST /employees | 400 |
| 3.6 | Empleado inexistente | GET /employees/{id} | 404 |
| 3.7 | Token inválido | GET /employees/{id} | 401 |
| 4 | Health / readiness | GET /health, /health/ready | 200 |
