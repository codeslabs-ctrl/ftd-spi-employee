# Diseño — API de Empleado SPI (ftd-spi-employee)

**Fecha:** 2026-07-02
**Autor:** Carlos Rodríguez / Claude
**Estado:** Aprobado (diseño validado en sesión de brainstorming)

## 1. Objetivo

Exponer un API RESTful para la gestión de empleados del sistema SPI, iniciando con Venezuela (VE), con arquitectura multi-tenant preparada para Argentina (AR) y Colombia (CO). El API envuelve la lógica existente en la base de datos Oracle SPI (paquete `corsox.pkg_management_employee`) y la tabla `INFOCENT.EO_PERSONA`.

## 2. Alcance

**Incluido (fase 1):**
- CRUD completo de empleados: POST (crear datos básicos), GET por id, GET listado paginado, PUT, DELETE (borrado lógico).
- Autenticación propia: endpoint `POST /auth/token` que emite JWT RS256 con TTL de 12 horas.
- Multi-tenancy por header `X-Country-Code` (ISO 3166-1 alfa-2). Solo VE habilitado; AR/CO se habilitan por configuración sin cambios de código.
- Despliegue en GCP Cloud Run con CI/CD en Cloud Build.
- Documentación OpenAPI/Swagger en `/docs`.

**Excluido (fase 1):**
- Implementación de las bases de datos AR y CO (solo queda lista la configuración).
- Consulta directa a `corsox.ftd_ingresos` — los datos que en origen provienen de esa tabla llegan como **parámetros obligatorios del request**; el servicio no la consulta.
- Gestión de usuarios/clientes del API con UI (los clientes se registran por configuración/Secret Manager).

## 3. Decisiones de arquitectura

| Decisión | Elección | Alternativas descartadas |
|---|---|---|
| Framework | NestJS 10 + Node 20 LTS + TypeScript | Express puro (más armado manual de guards/validación) |
| Multi-tenancy | Un solo servicio con connection pool Oracle por país, resuelto por header | Un Cloud Run por país (triplica infra); conexión por request (latencia) |
| Driver BD | `oracledb` en thin mode (sin Instant Client) | Thick mode (complica imagen Docker) |
| Auth | Emisor propio `/auth/token` (client_id/client_secret) firmando RS256, llaves en Secret Manager | IdP externo (no existe uno definido para este caso) |
| DELETE | Borrado lógico por status | DELETE físico sobre EO_PERSONA (riesgoso en espejo de producción) |
| Acceso a BD | **PKG-first (estándar FTD):** toda escritura vía procedimientos de `corsox.pkg_management_employee` cuando existan; SQL directo solo como fallback documentado. Lecturas por SELECT a `INFOCENT.EO_PERSONA` | Lógica de negocio duplicada en el API |
| Idioma | Código, contrato del API, mensajes, commits y Swagger **en inglés**; el mapeo hacia los objetos Oracle en español se hace vía diccionario | Campos del API en español (acopla el contrato al esquema legado) |
| Mapeo de campos | Diccionario único `EMPLOYEE_FIELD_MAP` (campo API → bind PKG → columna) del que se derivan binds, PL/SQL, UPDATE y mapeo de respuesta. Agregar un atributo = 1 campo DTO + 1 entrada del mapa | Mapeo manual repetido en cada método (propenso a inconsistencias) |
| Despliegue | Cloud Run + Artifact Registry + Cloud Build + Serverless VPC Access | GKE (sobredimensionado) |

## 4. Estructura de módulos

```
src/
├── auth/          # POST /auth/token, JwtStrategy RS256, guard JWT global
├── tenancy/       # Middleware X-Country-Code + TenantConnectionService
├── employees/     # Controller CRUD + Service + Repository (PKG/SQL)
├── database/      # Bootstrap de pools oracledb por país desde config
├── common/        # Filtros de excepción, interceptor de logging, respuesta de error estándar
└── config/        # Config tipada por env: países habilitados, credenciales, llaves
```

## 5. Seguridad (JWT RS256, TTL 12h)

- `POST /auth/token` recibe `client_id` + `client_secret`; valida contra clientes registrados en configuración (secretos en GCP Secret Manager); responde `{ access_token, token_type: "Bearer", expires_in: 43200 }`.
- Claims del token: `sub` (client_id), `iss` (ftd-spi-employee), `iat`, `exp` (= iat + 12h), `countries` (países autorizados para ese cliente).
- Par de llaves RSA en Secret Manager: privada solo para el servicio emisor; pública para validación.
- Guard JWT global (`passport-jwt`, algoritmo fijado a RS256 — se rechaza cualquier otro `alg`). Rutas públicas: `/auth/token`, `/health`, `/health/ready`, `/docs`.
- Token ausente/inválido/vencido → `401` con cuerpo de error estándar.

## 6. Multi-tenancy (header X-Country-Code)

- Middleware global (excepto rutas públicas):
  - Header ausente o no ISO 3166-1 alfa-2 → `400`.
  - País con formato válido pero no habilitado (AR, CO en fase 1) → `422` "Country not enabled".
  - Si el JWT trae claim `countries` y no incluye el país solicitado → `403`.
- `TenantConnectionService.getPool(country)` devuelve el pool `oracledb` correspondiente. Pools creados al bootstrap solo para países con configuración presente:
  - `DB_VE_CONNECT_STRING`, `DB_VE_USER`, `DB_VE_PASSWORD` (Secret Manager), `DB_VE_POOL_MIN/MAX`.
  - Habilitar AR/CO = agregar `DB_AR_*` / `DB_CO_*`. Sin cambios de código.

## 7. Endpoints

Base path: `/api/v1`. Todos los cuerpos en JSON. Todos excepto los públicos exigen `Authorization: Bearer <jwt>` y `X-Country-Code`.

| Método | Ruta | Implementación (VE) | Éxito | Errores |
|---|---|---|---|---|
| POST | `/auth/token` | Validación de credenciales de cliente, firma RS256 | 200 | 400, 401 |
| POST | `/employees` | `corsox.pkg_management_employee.prc_crear_datos_basicos` — body con todos los parámetros obligatorios (datos que en origen vienen de `ftd_ingresos`) | 201 | 400, 401, 409 (ya existe), 422, 500 |
| GET | `/employees/:id` | SELECT sobre `INFOCENT.EO_PERSONA` por identificación | 200 | 401, 404, 422, 500 |
| GET | `/employees` | SELECT paginado sobre `INFOCENT.EO_PERSONA` (`page`, `size`, filtros básicos) | 200 | 400, 401, 422, 500 |
| PUT | `/employees/:id` | Procedimiento de actualización del PKG si existe; si no, UPDATE controlado sobre `EO_PERSONA` (ver punto abierto) | 200 | 400, 401, 404, 422, 500 |
| DELETE | `/employees/:id` | Borrado lógico (procedimiento del PKG si existe; si no, UPDATE de status) | 204 | 401, 404, 422, 500 |
| GET | `/health`, `/health/ready` | Liveness / chequeo de pools | 200 | 503 |

**Formato de error estándar:**
```json
{ "statusCode": 400, "message": "Validation failed", "errors": ["cedula must not be empty"], "timestamp": "...", "path": "/api/v1/employees" }
```

**Punto abierto (tarea de verificación en el plan):** inspeccionar en la BD espejo la especificación de `corsox.pkg_management_employee` para: (a) firma exacta y parámetros obligatorios de `prc_crear_datos_basicos`, (b) existencia de procedimientos de actualización/eliminación. El contrato de los DTOs se cierra con ese resultado antes de implementar `employees/`.

## 8. Validación

- DTOs con `class-validator` / `class-transformer`, `ValidationPipe` global con `whitelist: true` y `forbidNonWhitelisted: true`.
- Errores de validación → `400` con detalle por campo.
- Errores Oracle mapeados en el repositorio: violación de unicidad → `409`; `NO_DATA_FOUND` / 0 filas → `404`; errores de aplicación del PKG (RAISE_APPLICATION_ERROR -20xxx) → `422` con el mensaje del PKG; resto → `500` sin filtrar detalles internos.

## 9. Despliegue GCP

- **Dockerfile** multi-stage sobre `node:20-slim`; usuario no root; `NODE_ENV=production`.
- **Artifact Registry** para la imagen; **Cloud Run** con: concurrencia alineada al `POOL_MAX` de Oracle, min instances 1 (mantener pools calientes), CPU always allocated si el costo lo permite.
- **Serverless VPC Access connector** para alcanzar la BD SPI espejo (prerequisito de infraestructura — coordinar con el equipo de redes/DBA).
- **Secret Manager**: llaves RSA, credenciales Oracle por país, client_secrets.
- **Cloud Build** (`cloudbuild.yaml`): lint → tests → build → push → deploy.

## 10. Pruebas

- **Unitarias (Jest):** services y mapeo de errores con repositorio mockeado; emisión/validación JWT; middleware de tenancy (todos los casos: ausente, inválido, no habilitado, no autorizado).
- **E2E (supertest):** flujo auth → CRUD con repositorio Oracle simulado; códigos de estado y formato de error.
- **Integración manual/Postman contra BD espejo VE:** colección Postman incluida en el repo; base para el Self QA.

## 11. Contrato del API en inglés y diccionario de mapeo

Campos del recurso Employee (API) y su correspondencia con los objetos Oracle:

| Campo API | Bind PKG (asumido, cierra Task 0) | Columna EO_PERSONA |
|---|---|---|
| `idNumber` | `p_cedula` | `CEDULA` |
| `nationality` | `p_nacionalidad` | `NACIONALIDAD` |
| `firstName` | `p_primer_nombre` | `PRIMER_NOMBRE` |
| `middleName` | `p_segundo_nombre` | `SEGUNDO_NOMBRE` |
| `lastName` | `p_primer_apellido` | `PRIMER_APELLIDO` |
| `secondLastName` | `p_segundo_apellido` | `SEGUNDO_APELLIDO` |
| `birthDate` | `p_fecha_nacimiento` | `FECHA_NACIMIENTO` |
| `gender` | `p_sexo` | `SEXO` |

El diccionario `EMPLOYEE_FIELD_MAP` es la única fuente de verdad de esta tabla: de él se generan los binds del PL/SQL, las cláusulas del UPDATE y el mapeo fila→JSON de respuesta. Agregar un atributo nuevo = agregar el campo al DTO (con su validación) + una entrada al mapa.

## 12. Calidad de código (SonarQube)

- Cobertura con `jest --coverage`, reporte **lcov** (`coverage/lcov.info`) consumido por Sonar.
- Umbral de cobertura ≥ 80% (configurado en `jest` `coverageThreshold` para fallar el build antes de llegar a Sonar).
- `sonar-project.properties` en el repo con exclusiones estándar: `**/*.module.ts`, `**/main.ts`, `**/*.dto.ts` (solo declaraciones), `**/dist/**`, `**/test/**` como fuente de tests.
- El pipeline de Cloud Build corre lint + tests con cobertura antes del build de imagen; el análisis Sonar se engancha en ese paso.

## 13. Observabilidad

- Logging estructurado JSON (nestjs-pino) → Cloud Logging. Cada log incluye `country`, `requestId`, `sub` del token. Nunca loguear datos sensibles del empleado ni secretos.
- Interceptor de logging de request/response (método, ruta, status, latencia).
