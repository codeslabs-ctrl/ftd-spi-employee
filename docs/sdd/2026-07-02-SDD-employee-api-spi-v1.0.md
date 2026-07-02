# Software Design Document
## Employee API SPI — API RESTful multi-tenant de empleados
### Versión 1.0

**Estado:** Análisis y Diseño (aprobado — inicia desarrollo)
**Autor(es):** carlos.rodriguez@farmatodo.com
**Fecha:** 2026-07-02

| Aprobador | Comentario |
|-----------|------------|
|           |            |

| Campo | Valor |
|---|---|
| Estado | Análisis y Diseño |
| Objetivo | Exponer un API RESTful para la gestión de empleados del sistema SPI, multi-tenant por país |
| Ámbito | Backend — nuevo servicio `employee-api-spi` en GCP Cloud Run |
| Fecha | 2026-07-02 |

---

## 2. Resumen ejecutivo

`employee-api-spi` es un servicio NestJS que expone la gestión de empleados del sistema SPI como API RESTful, iniciando con Venezuela y preparado para Argentina y Colombia sin cambios de código. La V1 prioriza: creación de empleados envolviendo el paquete Oracle existente `corsox.pkg_management_employee` (estándar FTD: PKG-first), consulta sobre `INFOCENT.EO_PERSONA`, seguridad con JWT RS256 (TTL 12h) y aislamiento de datos por región mediante el header `X-Country-Code`. El principio arquitectónico central es un único despliegue multi-tenant en Cloud Run con un connection pool Oracle por país, donde el header de país determina dinámicamente el enrutamiento a la base de datos correspondiente.

## 3. Objetivo y alcance

| | |
|---|---|
| **Objetivo** | API RESTful de empleados SPI con CRUD completo, seguridad JWT y enrutamiento multi-tenant por país |
| **Incluye** | `POST /auth/token` (emisión JWT RS256 TTL 12h); CRUD `/api/v1/employees` (POST vía PKG, GET por id, GET paginado, PUT, DELETE lógico); middleware `X-Country-Code` (ISO 3166-1 alfa-2); pools Oracle por país (VE activo); despliegue Cloud Run + Cloud Build; Swagger; quality gate SonarQube ≥80% |
| **Fuera de alcance** | Habilitación efectiva de AR/CO (queda por configuración); consulta a `corsox.ftd_ingresos` (sus datos llegan como parámetros obligatorios del request); UI de gestión de clientes del API; sincronización con otros sistemas (SIM, RMS) |
| **Principio rector** | Un solo servicio multi-tenant, PKG-first contra Oracle, contrato del API en inglés desacoplado del esquema legado mediante diccionario de mapeo |

## 4. Drivers de diseño y decisiones clave

- **PKG-first (estándar FTD):** toda escritura pasa por procedimientos de `corsox.pkg_management_employee` cuando existan; SQL directo solo como fallback documentado. La lógica de negocio permanece en la BD.
- **Multi-tenant en un solo despliegue:** un pool `oracledb` por país creado al bootstrap; `X-Country-Code` resuelve el pool por request. Habilitar un país nuevo = agregar variables `DB_<CC>_*`, sin código.
- **Contrato en inglés, esquema en español:** el diccionario `EMPLOYEE_FIELD_MAP` (campo API → bind PKG → columna) es la única fuente de verdad; de él se generan binds, PL/SQL, UPDATE y mapeo de respuesta. Agregar un atributo = 1 campo DTO + 1 entrada del mapa.
- **Seguridad autocontenida:** el propio servicio emite JWT RS256 (llaves en Secret Manager) con TTL de 12 horas y claim `countries` que restringe qué países puede usar cada cliente.
- **Serverless nativo GCP:** Cloud Run con escalado automático; conectividad a la BD SPI vía Serverless VPC Access; secretos en Secret Manager; CI/CD en Cloud Build.
- **DELETE lógico:** nunca borrado físico sobre `EO_PERSONA` (BD espejo de producción).
- **Calidad verificable:** TDD, cobertura ≥80% (lcov) como quality gate de SonarQube antes del build de imagen.

## 5. Arquitectura objetivo y responsabilidades

| Componente | Responsabilidad principal | Notas |
|---|---|---|
| `employee-api-spi` (Cloud Run) | Exponer el API REST, validar, autenticar y enrutar por país | NestJS 10, Node 20, contenedor `node:20-slim` |
| Módulo `auth` | Emitir y validar JWT RS256 TTL 12h; guard global | `passport-jwt`; algoritmo fijado a RS256 |
| Módulo `tenancy` | Validar `X-Country-Code` y resolver el tenant | 400 header inválido; 422 país no habilitado; 403 país no autorizado para el cliente |
| Módulo `database` | Pools `oracledb` por país (thin mode) | `TenantConnectionService.getPool(cc)`; cierre limpio en shutdown |
| Módulo `employees` | CRUD: controller → service → repository | Repository genera PL/SQL y binds desde `EMPLOYEE_FIELD_MAP` |
| BD SPI VE (espejo) | Lógica de negocio de creación (`pkg_management_employee`) y datos (`INFOCENT.EO_PERSONA`) | Esquema `corsox`; acceso vía VPC connector |
| Secret Manager | Llaves RSA, credenciales Oracle por país, clientes del API | Montados como env vars en Cloud Run |
| Cloud Build | Pipeline: lint → tests+cobertura → build → push → deploy | Gate SonarQube en el paso de tests |

## 6. Flujo funcional de inicio a fin

1. El sistema cliente solicita token: `POST /auth/token` con `client_id`/`client_secret`.
2. `employee-api-spi` valida credenciales contra los clientes registrados (Secret Manager) y responde JWT RS256 con `exp = iat + 12h` y claim `countries`.
3. El cliente invoca un endpoint CRUD con `Authorization: Bearer <jwt>` y `X-Country-Code: VE`.
4. El guard JWT valida firma RS256, emisor y vigencia (401 si falla).
5. El middleware de tenancy valida el header (400/422/403 según el caso) y resuelve el pool Oracle de VE.
6. Para creación: el repositorio construye el bloque PL/SQL desde `EMPLOYEE_FIELD_MAP` y ejecuta `corsox.pkg_management_employee.prc_crear_datos_basicos` con los datos del request (los parámetros que en origen provienen de `corsox.ftd_ingresos` — el servicio no consulta esa tabla).
7. El PKG responde código/mensaje OUT; código ≠ 0 se mapea a 422 con el mensaje del PKG; éxito responde 201.
8. Para consultas: SELECT sobre `INFOCENT.EO_PERSONA`, la fila se traduce a campos en inglés vía el mismo diccionario; 404 si no existe.
9. Errores Oracle se mapean: ORA-00001 → 409; ORA-20xxx → 422; resto → 500 sin filtrar detalles internos.
10. Todo request queda en Cloud Logging con `country`, `requestId` y `sub` del token (sin datos sensibles).

## 7. Endpoints de la V1

### POST /api/v1/auth/token
Emite el token de acceso del API. Único endpoint público junto a health y docs.

**Request**
```json
{
  "client_id": "hr-integration",
  "client_secret": "********"
}
```

**Response sugerida** (200)
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 43200
}
```

**Notas**
- Credenciales inválidas → 401. Body incompleto → 400.
- `expires_in` fijo en 43200 s (12 h) por premisa de seguridad.

### POST /api/v1/employees
Crea los datos básicos del empleado envolviendo `prc_crear_datos_basicos`.

**Request**
```json
{
  "idNumber": "12345678",
  "nationality": "V",
  "firstName": "MARIA",
  "middleName": "ALEJANDRA",
  "lastName": "PEREZ",
  "secondLastName": "GOMEZ",
  "birthDate": "1990-05-14",
  "gender": "F"
}
```

**Response sugerida** (201)
```json
{
  "idNumber": "12345678",
  "message": "OK"
}
```

**Notas**
- Todos los parámetros que el PKG exige son obligatorios en el body (origen funcional: `corsox.ftd_ingresos`).
- Validación por campo con class-validator → 400 con detalle. Duplicado → 409. Regla de negocio del PKG → 422 con su mensaje.
- [PENDIENTE: confirmar firma exacta de `prc_crear_datos_basicos` contra la BD espejo — Task 0 del plan; los campos listados son la firma asumida de trabajo]

### GET /api/v1/employees/{idNumber}
Consulta un empleado por identificación sobre `INFOCENT.EO_PERSONA`.

**Response sugerida** (200)
```json
{
  "idNumber": "12345678",
  "nationality": "V",
  "firstName": "MARIA",
  "lastName": "PEREZ",
  "birthDate": "1990-05-14T00:00:00.000Z",
  "gender": "F"
}
```

**Notas**
- No existe → 404 con formato de error estándar.

### GET /api/v1/employees?page=1&size=20
Listado paginado.

**Response sugerida** (200)
```json
{
  "page": 1,
  "size": 20,
  "items": [ { "idNumber": "12345678", "firstName": "MARIA" } ]
}
```

**Notas**
- `size` máximo 100. Paginación con `OFFSET/FETCH`.

### PUT /api/v1/employees/{idNumber}
Actualización parcial de datos básicos (campos updatable del diccionario).

**Request**
```json
{
  "firstName": "MARIA ALEJANDRA"
}
```

**Response sugerida** (200): el empleado actualizado (mismo shape del GET).

**Notas**
- PKG-first: si `pkg_management_employee` expone procedimiento de actualización, se envuelve; fallback: UPDATE controlado. [PENDIENTE: resultado Task 0]
- Body vacío → 422 "Nothing to update".

### DELETE /api/v1/employees/{idNumber}
Borrado lógico (status inactivo). Responde 204 sin body. No existe → 404.

### GET /health · GET /health/ready
Liveness y readiness (incluye países con pool activo). Públicos, para Cloud Run.

## 8. Contratos propuestos

| Flujo | Quién llama | Quién responde | Contrato clave |
|---|---|---|---|
| Emisión de token | Sistema cliente (RRHH/integraciones) | `employee-api-spi` | `client_id`/`client_secret` → JWT RS256, `expires_in: 43200` |
| CRUD empleados | Sistema cliente | `employee-api-spi` | JSON en inglés + headers `Authorization` y `X-Country-Code` |
| Creación en SPI | `employee-api-spi` (repository) | BD Oracle SPI (`corsox.pkg_management_employee`) | Binds nombrados desde `EMPLOYEE_FIELD_MAP`; OUT: código + mensaje |
| Consulta en SPI | `employee-api-spi` (repository) | BD Oracle SPI (`INFOCENT.EO_PERSONA`) | SELECT parametrizado; fila → JSON inglés vía diccionario |

## 9. Modelo de datos mínimo

El servicio **no crea tablas propias**: opera sobre el esquema existente del SPI (Oracle, BD espejo de producción por país). La persistencia y las reglas de negocio de creación viven en el paquete `corsox.pkg_management_employee`.

| Tabla / Objeto | Campos imprescindibles | Uso |
|---|---|---|
| `INFOCENT.EO_PERSONA` | CEDULA, NACIONALIDAD, PRIMER_NOMBRE, SEGUNDO_NOMBRE, PRIMER_APELLIDO, SEGUNDO_APELLIDO, FECHA_NACIMIENTO, SEXO, STATUS | Lectura (GET), actualización (PUT fallback), borrado lógico (DELETE) |
| `corsox.pkg_management_employee.prc_crear_datos_basicos` | Parámetros IN según firma real + OUT código/mensaje | Creación del empleado (POST) |
| `corsox.ftd_ingresos` | — | **No se consulta.** Es el origen funcional de los datos que el cliente envía como parámetros |

Idempotencia: la deduplicación la resuelve la BD (clave única de cédula → ORA-00001 → 409; o validación del propio PKG → 422).

## 10. Flujos asíncronos / continuidad

No aplica en V1: todos los flujos son síncronos request/response. Los pools de conexión se crean al bootstrap y se cierran en shutdown limpio (`onModuleDestroy`). Si a futuro la creación masiva de empleados lo requiere, la evolución natural es una carga por lotes con Cloud Tasks + outbox, fuera del alcance de esta versión.

## 11. Plan por sprints (propuesta)

| Sprint | Tiempo | Objetivo | Entregables principales |
|---|---|---|---|
| 1 | 1 semana | Fundaciones del servicio | Scaffold NestJS, config multi-país, filtro de errores estándar, middleware `X-Country-Code`, pools Oracle, auth JWT RS256 completa (Tasks 1–6 del plan) |
| 2 | 1 semana | CRUD de empleados | DTOs en inglés, `EMPLOYEE_FIELD_MAP`, repository PKG-first, controller/service, e2e, health, Swagger, cobertura ≥80% (Tasks 7–10) |
| 3 | 1 semana | Verificación BD + despliegue | Firma real del PKG (Task 0) y ajuste de binds, Docker, Cloud Build, setup GCP (secretos, VPC connector), deploy Cloud Run, integración contra espejo VE, colección Postman y Self QA (Tasks 8-ajuste, 11–12) |

## 12. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| La firma real de `prc_crear_datos_basicos` difiere de la asumida | Retrabajo en DTOs/binds; bloqueo del POST | Task 0 obligatoria antes de integrar; el diccionario `EMPLOYEE_FIELD_MAP` concentra el cambio en un solo archivo |
| El PKG no expone procedimientos de update/delete | PUT/DELETE requieren SQL directo sobre BD espejo | Fallback documentado (UPDATE controlado + borrado lógico); validar con el DBA dueño del PKG |
| Conectividad Cloud Run → BD SPI (VPC connector) no disponible a tiempo | Bloquea despliegue e integración (Sprint 3) | Solicitar el connector al equipo de redes desde el Sprint 1; desarrollo y tests no dependen de la BD |
| Agotamiento de conexiones Oracle por escalado de Cloud Run | Errores 500 intermitentes bajo carga | Alinear `concurrency` de Cloud Run con `POOL_MAX`; `min-instances=1`; monitoreo de pool en `/health/ready` |
| Fuga de secretos (llaves RSA, credenciales Oracle) | Acceso indebido a datos de empleados | Secret Manager exclusivamente; nunca en repo ni logs; rotación de llaves documentada |
| TTL de 12 h del token comprometido | Ventana amplia de uso indebido | Claim `countries` limita alcance por cliente; revocación por rotación de llaves; logging con `sub` para auditoría |

## 13. Conclusión

La V1 construye un servicio NestJS multi-tenant que expone el CRUD de empleados del SPI cumpliendo las cinco premisas: nube nativa GCP (Cloud Run), JWT RS256 con TTL de 12 horas, aislamiento por país vía `X-Country-Code`, diseño REST estricto y creación vía el paquete estándar del esquema `corsox`. La separación de responsabilidades clave es: la lógica de negocio permanece en los paquetes Oracle (PKG-first), el servicio aporta el contrato REST en inglés, la seguridad y el enrutamiento multi-tenant, y el diccionario `EMPLOYEE_FIELD_MAP` desacopla ambos mundos. La evolución recomendada es habilitar AR/CO por configuración una vez existan sus BD espejo, y evaluar carga por lotes asíncrona si el volumen de ingresos lo demanda.
