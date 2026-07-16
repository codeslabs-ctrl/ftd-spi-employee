# SPI — CRUD adicionales (position, company, marital-status, job-post, org-unit)

**Fecha:** 2026-07-16
**Estado:** Diseño aprobado
**Base:** replica 1:1 el patrón del módulo `employees/` ya en producción.

## 1. Objetivo

El spec del SPI (`API.docx`) define, además de Employee (`EO_PERSONA`), cinco recursos
que hoy faltan. Esta iteración agrega esos cinco recursos siguiendo **exactamente** la
arquitectura con la que se construyó Employee (PKG-first, multi-tenant, cifrado P2C,
todo el código/contrato en inglés, cobertura SonarQube ≥80%).

## 2. Recursos, rutas y operaciones

Estilo de ruta Farmatodo: `POST /ftd-spi-employee/rest/{recurso}/{verbo}`, verbo al final,
identificador en el **body** (nunca en la URL, para que viaje cifrado y no quede en logs).

| Recurso | Tabla origen | Rutas | Escritura |
|---|---|---|---|
| **position** (Cargos) | cargos (VE/CO) | `position/create`, `position/update`, `position/get`, `position/list` | Sí (create/update) |
| **company** (Empresas) | `EO_EMPRESA` | `company/get`, `company/list` | No |
| **marital-status** (Estado Civil) | `eo_estado_civil` | `marital-status/list` | No |
| **job-post** (Puestos) | puestos | `job-post/list` (empresa+unidad+cargo), `job-post/get` | No |
| **org-unit** (Unidad) | unidad | `org-unit/get`, `org-unit/list` | No |

Solo **position** tiene escritura, tal como pide el documento ("Crear, Actualizar y
Consultar"). El resto son de solo consulta.

## 3. Mapeo de campos (API en inglés → columna Oracle)

Cada recurso tiene su `{recurso}-field.map.ts` declarativo (patrón `employee-field.map.ts`):
agregar un atributo = una línea en el array + una entrada en el JSON del PKG.

### position (clave compuesta `companyId` + `id`)
| API | Columna |
|---|---|
| companyId | ID_EMPRESA |
| id | ID |
| name | NOMBRE |
| classificationId | ID_CLASIFICA |
| parentPositionId | ID_CARGO_SUP |
| description | DESCRIP |
| functions | FUNCION |
| purpose | PROPOSITO |
| risk | RIESGO |

### company (clave `id`)
`id`(ID), `name`(NOMBRE), `shortName`(NOMBRE_ABREV), `sector`(SECTOR_EMP),
`isPublic`(PUBLICA), `taxId1`(RIF1), `taxId2`(RIF2), `address`(DIRECCION), `city`(CIUDAD),
`postalCode`(COD_POSTAL), `phone1`(TELEFONO1), `phone2`(TELEFONO2), `webPage`(PAGINA_WEB),
`email`(E_MAIL).

### marital-status (clave `id`)
`id`(ID), `name`(NOMBRE), `legalCode`(CODIGO_LEY).

### job-post (clave compuesta `companyId` + `unitId` + `id`)
`companyId`(ID_EMPRESA), `unitId`(ID_UNIDAD), `id`(ID), `name`(NOMBRE),
`positionId`(ID_CARGO), `description`(DESCRIP), `functions`(FUNCION),
`startDate`(FECHA_INI), `endDate`(FECHA_FIN), `risk`(RIESGO).

### org-unit (clave compuesta `companyId` + `id`)
`companyId`(ID_EMPRESA), `id`(ID), `name`(NOMBRE), `functions`(FUNCIONES),
`adminLocation`(UBICA_ADMIN), `startDate`(FECHA_INI), `endDate`(FECHA_FIN),
`parentUnitId`(ID_UNIDAD_SUP), `maxPosts`(MAX_PUESTO).

Los campos de auditoría (USRCRE/FECCRE/USRACT/FECACT) los asigna el PKG, no el API.

## 4. Estructura por recurso (idéntica a `employees/`)

```
src/{recurso}/
  dto/*.dto.ts               # DTOs con class-validator (create/update/get/list según aplique)
  {recurso}-field.map.ts     # mapeo declarativo + toXxxPayload()
  {recurso}.repository.ts     # Oracle vía callPkg (PKG configurable)
  in-memory-{recurso}.repository.ts   # FAKE_DB
  {recurso}.service.ts
  {recurso}.controller.ts     # @Controller('{recurso}'), todos @Post
  {recurso}.module.ts         # factory: FAKE_DB ? inMemory : oracle
  *.spec.ts                   # unit tests de cada pieza
```

No se modifica auth, crypto, tenancy ni el filtro global de errores. Los guards
(`JwtAuthGuard` → `CountryGuard`) y el `PayloadCryptoInterceptor` son globales
(`app.module.ts`), por lo que los controladores nuevos heredan automáticamente JWT,
`X-Country-Code`, cifrado P2C y manejo de errores.

## 5. Capa de datos y configuración

Cada repositorio reutiliza el mecanismo de `employees.repository.ts`: `withConn(country)`,
`callPkg(conn, procedure, inJson, withOutJson)` con contrato `I_JSON CLOB → O_JSON/O_COD/
O_MESSAGE`, `readLob`, y `assertPkgSuccess` (mismos `PKG_SUCCESS_CODE`/`PKG_NORECORDS_CODE`
y mismo mapeo de ORA→422/500). Solo cambian el nombre del PKG y de los procedimientos.

Nuevas variables en `configuration.ts` (con default, igual que `employeePkg`). **Todos los
PKG se despliegan en el mismo esquema que el de Employee (`people_one`), por lo que los
defaults van sin prefijo de esquema** (se resuelven en el esquema de conexión):

| Variable | Default |
|---|---|
| `POSITION_PKG` | `pkg_management_position` |
| `COMPANY_PKG` | `pkg_management_company` |
| `MARITAL_STATUS_PKG` | `pkg_management_marital_status` |
| `JOB_POST_PKG` | `pkg_management_job_post` |
| `ORG_UNIT_PKG` | `pkg_management_org_unit` |

`PKG_SUCCESS_CODE` / `PKG_NORECORDS_CODE` se comparten. Se agregan los bloques
correspondientes a `.env.example` (sin secretos).

Cada `module.ts` usa la misma *factory* que Employee: `FAKE_DB=true` → repo en memoria;
si no → repo Oracle.

### Scripts SQL (propuesta para el DBA)
Un script por paquete, Oracle 12.1 (JSON construido manualmente como en
`pkg_management_employee_api.sql`), creando el paquete en el esquema `people_one`
(sin `corsox.`):
`db/pkg_management_position_api.sql`, `db/pkg_management_company_api.sql`,
`db/pkg_management_marital_status_api.sql`, `db/pkg_management_job_post_api.sql`,
`db/pkg_management_org_unit_api.sql`. Los nombres reales de procedimiento se confirman
con el DBA (como Task 0/12 de Employee).

## 6. Manejo de errores (idéntico al actual)

- Validación DTO fallida → **400**.
- Token inválido / país no en claim → **403**; país no habilitado → **422**.
- `get` sin registros → **404** (`NotFoundException`).
- `list` con `noRecordsCode` → lista vacía (200).
- Violación de integridad ORA (unique/not-null/check/FK/value-too-large) o
  `RAISE_APPLICATION_ERROR -20000..-20999` → **422** con mensaje.
- `position/create` duplicado (clave `companyId+id`) → **409** vía `mapOracleError`.
- Resto → **500** con detalle solo en logs.

## 7. Pruebas y entregables

- Specs unitarios por repo/service/controller/DTO de cada recurso (patrón `employees/*.spec.ts`)
  + casos e2e. Meta cobertura SonarQube ≥80%.
- `README.md`: se agrega la tabla de endpoints nuevos.
- Colección Postman: una carpeta por recurso (variante cifrada P2C + un negativo),
  como la colección actual.

## 8. Fuera de alcance (YAGNI)

- Sin `delete` en los recursos nuevos (el doc no lo pide; solo position tiene escritura).
- Sin SDD/SelfQA en esta iteración (se regenera aparte si se solicita).
- Sin cambios en el despliegue GCP ni en el PKG de Employee.
