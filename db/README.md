# Oracle PKG — CRUD adicionales SPI

Scripts para esquema de conexión **`people_one`** (QA: `NOMQAVE`).  
Contrato: `I_JSON CLOB → O_JSON? / O_COD / O_MESSAGE` (mismos códigos que Employee).

## Tablas verificadas en QA (2026-07-16)

| Recurso | PKG | Tabla | Estado |
|---|---|---|---|
| position | `pkg_management_position` | `INFOCENT.EO_CARGO` | OK |
| company | `pkg_management_company` | `INFOCENT.EO_EMPRESA` | OK |
| marital-status | `pkg_management_marital_status` | `INFOCENT.EO_ESTADO_CIVIL` | OK |
| org-unit | `pkg_management_org_unit` | `INFOCENT.EO_UNIDAD` | OK |
| job-post | `pkg_management_job_post` | `INFOCENT.EO_PUESTO` | OK (confirmada, columnas verificadas) |
| catalogs (12 catálogos) | `pkg_management_catalogs` | ver detalle abajo | 11/12 confirmadas y migradas a SELECT estático; falta `payroll-types` |

Nota histórica: en la verificación inicial (2026-07-16) `INFOCENT.EO_PUESTO` no aparecía en QA VE y solo se encontraba `INFOCENT.TA_RELACION_PUESTO` (relación laboral). Ya se confirmó que la tabla existe con las columnas esperadas (`ID_EMPRESA, ID_UNIDAD, ID, NOMBRE, ID_CARGO, DESCRIP, FUNCION, FECHA_INI, FECHA_FIN, RIESGO`), así que el paquete se reescribió con `SELECT` estático (mismo estilo que `position`) en vez del SQL dinámico que se usaba como salvaguarda.

## `pkg_management_catalogs_api.sql` — un solo paquete para 12 catálogos

Un único paquete Oracle (`PKG_MANAGEMENT_CATALOGS`) agrupa el GET de todos los catálogos de solo lectura pedidos: municipios, países, parroquias, localidades, ciudades, entidades federales, tipos de nómina, grupos, sucursales, bancos, tipos de cuenta y tipos de identificación.

Convención de nombres: procedimientos/funciones del paquete en inglés (`PRC_GET_COUNTRIES`, `PRC_GET_BANKS`...), igual que el resto de paquetes (`PRC_GET_EMPLOYEE`, `PRC_MERGE_POSITION`...). Los mensajes de error sí van en español (contenido, no identificador).

**Migración a SELECT estático (2026-07-27):** igual que se hizo con `job-post`, en cuanto se confirma la estructura real de una tabla (vía `DESCRIBE` en QA), su wrapper deja el motor genérico y pasa a un `SELECT` estático explícito — mismo estilo que `position`/`job-post` (`PRC_PARSE_*_FILTER` + `FOR` loop + `FN_JSON_PAIR_CC`, que preserva camelCase en las claves del JSON). Más legible y mantenible que la introspección genérica.

**Migrados a SELECT estático (11/12):** `countries`, `states`, `localities`, `banks`, `groups`, `branches`, `account-types`, `id-types`, `cities`, `municipalities`, `parishes`.

**Sigue en el motor genérico** (`PRC_GET_GENERIC_CATALOG`, privado, usa `DBMS_SQL` para leer cualquier tabla sin conocer sus columnas de antemano) **mientras no se confirme su estructura real:** `payroll-types` (`INFOCENT.EO_TIPO_NOMINA`) — falta el `DESCRIBE` de esta tabla, la última pendiente.

**Tablas confirmadas y migradas a SELECT estático (DESCRIBE en QA, 2026-07-27):**
- `INFOCENT.NMT002` (→ `localities`): `IDEPRO`, `CODPOS`, `NACIONAL`, `FECSSO DATE`, `RIESSO`, `REGSSO`, `OBSSSO`. Sin filtros. Nombres de campo se mantienen tal cual la columna (en minúscula) porque no se confirmó su significado de negocio.
- `INFOCENT.SPI_ENTIDAD_FEDERAL` (→ `states`): `CODIGO_PAIS`, `CODIGO`, `NOMBRE` (todos `NOT NULL`). Tabla multi-país (la muestra trae hasta Seychelles) — `countryCode` es filtro OPCIONAL. Sin columna de sigla/abreviación (pendiente aclarar si el `CODIGO` numérico es lo que se necesita).
- `INFOCENT.SPI_PAISES` (→ `countries`): solo `CODIGO`, `NOMBRE`. Tabla plana, sin filtros.
- `INFOCENT.NMT023` (→ `groups`): `CIA_CODCIA`, `TNOM_TIPNOM` (tipo de nómina), `CODGRU`, `DESGRU`, `TIPJORN`, `LABDOM` (todos los primeros 4 `NOT NULL`). `CODGRU` no es único global (depende de `CIA_CODCIA + TNOM_TIPNOM`) — `companyId`/`payrollTypeCode` son filtros OPCIONALES (si no se mandan, devuelve todo).
- `INFOCENT.NMT038` (→ `branches`): `CIA_CODCIA`, `CODSUC`, `DESSUC` (`NOT NULL`), `CODCTB`, `CODUBI`. `CODSUC` scoped a `CIA_CODCIA` — `companyId` es filtro OPCIONAL.
- ⚠️ `INFOCENT.NMT020` (→ `banks`): tabla mixta de instituciones (`CIA_CODCIA`, `TIPI_CODTIP`, `CODINS`, `DESINS`, `NRORIF`, `DIREC1/2/3`, `CDAD_CODCIU`, `EDO_CODEDO`, `PAI_CODPAI`, `NROTL1/2`, `NROFAX`, `NROCTA`, `CTACON`, `NOMCON`, `TCTA_TIPCTA`, `NOCTTO`, `CODRIE`). Con más filas se confirmaron 5 tipos: `01`=bancos (DAVIVIENDA, BANCOLOMBIA), `RP`=riesgos laborales (ARP Sura), `PE`=pensión (Protección, Skandia, Colfondos, Colpensiones), `CA`=caja de compensación (Comfamiliar, Cofrem), `SA`=EPS/salud (Sanitas, Sura, Coomeva...). `PRC_GET_BANKS` filtra `TIPI_CODTIP = '01'` (razonablemente confirmado con la muestra ampliada) + `companyId` opcional. `NOCTTO` se expone como `contractNumber` — nombre no confirmado semánticamente.
- `INFOCENT.NMT022` (→ `account-types`): `TIPCTA`, `DESCTA` (`NOT NULL`). Solo 2 filas en QA: `1`=CUENTA CORRIENTE, `2`=CUENTA AHORRO. Sin filtros.
- `INFOCENT.EO_TIPO_IDENTIFICACION` (→ `id-types`): `ID`, `DESCRIP` (`NOT NULL`). Tabla plana, sin filtros (algunas entradas legacy redundantes, ej. `4`/`CC` ambos "cédula de ciudadanía" — se expone tal cual).
- ⚠️ `INFOCENT.SPI_REF` (→ `cities`): tabla de dominios genéricos compartida (`DOMAIN`, `L_VALUE`, `H_VALUE`, `MEANING`, `MEAN_LABEL`). Se revisaron ~50 dominios (nacionalidades/gentilicios, monedas, áreas administrativas, config. de nómina...) y **no se encontró un dominio de ciudades** — búsquedas por "Caracas"/"Bogotá"/"Medellín"/"Maracaibo"/"Valencia" en `MEANING` y `L_VALUE` no dieron resultado. Ya migrada a SELECT estático pero **sin filtro por `DOMAIN`** (devuelve todos los dominios mezclados, mismo comportamiento que tenía antes). **Pendiente:** el usuario habla mañana con la persona que dio la información original para confirmar si el mapeo "Validar ciudad" → `SPI_REF` es correcto, o si las ciudades viven en otra tabla — candidato: la tabla que referencia `CDAD_CODCIU` (visto en `NMT020`/banks). Sugerido para confirmar: `SELECT table_name FROM all_tables WHERE owner='INFOCENT' AND table_name LIKE '%CIU%'`.
- `INFOCENT.SPI_MUNICIPIOS` (→ `municipalities`): `ID NUMBER(20)`, `NOMBRE VARCHAR2(64)`, `ID_PAIS VARCHAR2(4)`, `ID_ENTIDAD VARCHAR2(4)` (todos `NOT NULL`). Tabla dedicada, scoped por país + entidad (mismo patrón que `states`) — `countryCode`/`stateCode` son filtros OPCIONALES.
- `INFOCENT.SPI_PARROQUIAS` (→ `parishes`): `ID NUMBER(20)`, `NOMBRE VARCHAR2(64)`, `ID_MUNICIPIO NUMBER(20)` (todos `NOT NULL`). Tabla dedicada, scoped por municipio — `municipalityId` es filtro OPCIONAL.

**Pendiente de confirmar (sigue en el motor genérico, falta el `DESCRIBE`):**
- `payroll-types` → `INFOCENT.EO_TIPO_NOMINA` — última tabla sin confirmar.
- **"Validar reingreso"** (a partir de la cédula) **no está incluido** — falta la consulta SQL (pendiente de Jhon). Se agrega como catálogo 13 en cuanto llegue.

Manejo de errores en español: `FN_MENSAJE_ERROR_ES` (dentro del mismo paquete) traduce los códigos Oracle más comunes (tabla no existe, sin privilegios, timeout/pérdida de conexión) a mensajes claros en español. Del lado Node, `src/shared/oracle/catalog-pkg-assert.ts` es el equivalente reutilizable — separado de `pkg-assert.ts` (que sigue en inglés) para no romper el contrato de errores ya probado en employee/position/company/etc.

## Compilar

```sql
-- como people_one
@pkg_management_position_api.sql
@pkg_management_company_api.sql
@pkg_management_marital_status_api.sql
@pkg_management_org_unit_api.sql
@pkg_management_job_post_api.sql
@pkg_management_catalogs_api.sql
```

O desde el repo (usa `.env` VE):

```bash
node scripts/compile-pkgs.js
```
