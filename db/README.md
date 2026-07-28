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
| catalogs (12 catálogos) | `pkg_management_catalogs` | ver detalle abajo | 12/12 confirmadas y migradas a SELECT estático (verificadas contra QA Colombia real); `cities` sin filtro de dominio (ver nota) |

Nota histórica: en la verificación inicial (2026-07-16) `INFOCENT.EO_PUESTO` no aparecía en QA VE y solo se encontraba `INFOCENT.TA_RELACION_PUESTO` (relación laboral). Ya se confirmó que la tabla existe con las columnas esperadas (`ID_EMPRESA, ID_UNIDAD, ID, NOMBRE, ID_CARGO, DESCRIP, FUNCION, FECHA_INI, FECHA_FIN, RIESGO`), así que el paquete se reescribió con `SELECT` estático (mismo estilo que `position`) en vez del SQL dinámico que se usaba como salvaguarda.

## `pkg_management_catalogs_api.sql` — un solo paquete para 12 catálogos

Un único paquete Oracle (`PKG_MANAGEMENT_CATALOGS`) agrupa el GET de todos los catálogos de solo lectura pedidos: municipios, países, parroquias, localidades, ciudades, entidades federales, tipos de nómina, grupos, sucursales, bancos, tipos de cuenta y tipos de identificación.

Convención de nombres: procedimientos/funciones del paquete en inglés (`PRC_GET_COUNTRIES`, `PRC_GET_BANKS`...), igual que el resto de paquetes (`PRC_GET_EMPLOYEE`, `PRC_MERGE_POSITION`...). Los mensajes de error sí van en español (contenido, no identificador).

**Migración a SELECT estático (2026-07-27/28):** igual que se hizo con `job-post`, cada wrapper usa un `SELECT` estático explícito sobre su tabla real — mismo estilo que `position`/`job-post` (`PRC_PARSE_*_FILTER` + `FOR` loop + `FN_JSON_PAIR_CC`, que preserva camelCase en las claves del JSON). **Los 12 catálogos ya están migrados**; el motor genérico (`PRC_GET_GENERIC_CATALOG`, `DBMS_SQL`) y su `FN_JSON_PAIR` (forzaba minúsculas) se eliminaron del paquete por quedar sin ningún wrapper que los usara.

**Política de campos (2026-07-28):** se exponen **todas** las columnas de negocio de cada tabla — decisión explícita de no recortar a "solo lo esencial" para evitar que después pidan campos que se quitaron. Solo se excluyen las columnas de auditoría (`USRCRE`/`FECCRE`/`USRACT`/`FECACT`), igual que en el resto del API.

**Los 12 catálogos migrados a SELECT estático, verificados contra QA Colombia real:**
- `INFOCENT.SPI_PAISES` (→ `countries`): `CODIGO`, `NOMBRE`. Tabla plana, sin filtros. ✅ Verificado (Postman, CO).
- `INFOCENT.SPI_ENTIDAD_FEDERAL` (→ `states`): `CODIGO_PAIS`, `CODIGO`, `NOMBRE` (todos `NOT NULL`). Tabla multi-país — `countryCode` es filtro OPCIONAL. Un registro trae comillas literales embebidas en `NOMBRE` (dato de origen, no defecto). ✅ Verificado.
- `INFOCENT.SPI_MUNICIPIOS` (→ `municipalities`): `ID`, `NOMBRE`, `ID_PAIS`, `ID_ENTIDAD` (todos `NOT NULL`). Scoped por país + entidad (mismo patrón que `states`) — `countryCode`/`stateCode` OPCIONALES. Catálogo global: trae municipios de VEN aunque se consulte con `X-Country-Code: CO`. ✅ Verificado.
- `INFOCENT.SPI_PARROQUIAS` (→ `parishes`): `ID`, `NOMBRE`, `ID_MUNICIPIO` (todos `NOT NULL`). Scoped por municipio — `municipalityId` OPCIONAL. ✅ Verificado.
- ⚠️ **`INFOCENT.NMT002` (→ `localities`) — CORREGIDA 2026-07-28:** la primera versión usaba `IDEPRO/CODPOS/NACIONAL/FECSSO/RIESSO/REGSSO/OBSSSO`, que resultaron ser columnas **legacy al final de la tabla** (casi siempre `NULL` en filas reales) — ese `DESCRIBE` inicial solo mostraba la cola con scroll, no la tabla completa. La tabla real (~57 columnas de negocio) es una localidad/sucursal física de una compañía: `CIA_CODCIA`, `CODLOC`, `DESLO1/2`, `DIREC1/2/3`, `PARLOC`, `MUNLOC`/`NOMMUN`, `ENTFED`/`NOMFED`, `DISLOC`/`NOMDIS`, `SECLOC`, `CDAD_CODCIU`, `EDO_CODEDO`, `PAI_CODPAI`, `ACTECO`/`DESACT`, `CAPLOC`, `NOMANT`/`DIRANT`, `FECFUN`, `NROSSO`, `NROORD`, `REGMIN`, `PROLOC`, `HEFEOB/HEFEEM/DEFEOB/DEFEEM`, `NTRAO1-3`/`NTRAE1-3`, `SIGLAS`, `NUMRIF`, `NUMNIT`, `NUMTLF`, `NUMFAX`, `E_MAIL`, `HORSEM`, `TURNOS`, `NOMINF`/`CGOINF`, `IDEINF`, `NILCIA`, más las 7 columnas legacy originales. Scoped por `CIA_CODCIA` — `companyId` OPCIONAL. Muchos nombres de campo se exponen literales (sin traducir) por significado de negocio no confirmado (`caploc`, `nrosso`, `nroord`, `regmin`, `proloc`, `hefeob/hefeem/defeob/defeem`, `ntrao1-3/ntrae1-3`, `nilcia`, `idepro`, `nacional`). ✅ Corregido y re-verificado contra QA CO.
- ⚠️ `INFOCENT.SPI_REF` (→ `cities`): tabla de dominios genéricos compartida (`DOMAIN`, `L_VALUE`, `H_VALUE`, `MEANING`, `MEAN_LABEL`). Se revisaron ~50 dominios (nacionalidades/gentilicios, monedas, áreas administrativas, config. de nómina...) y **no se encontró un dominio de ciudades** — búsquedas por "Caracas"/"Bogotá"/"Medellín"/"Maracaibo"/"Valencia" en `MEANING` y `L_VALUE` no dieron resultado. Migrada a SELECT estático pero **sin filtro por `DOMAIN`** (devuelve todos los dominios mezclados). **Pendiente:** confirmar con la persona que dio la información original si el mapeo "Validar ciudad" → `SPI_REF` es correcto, o si las ciudades viven en otra tabla — candidato: la tabla que referencia `CDAD_CODCIU` (visto en `NMT020`/banks y ahora también en `NMT002`/localities). Sugerido: `SELECT table_name FROM all_tables WHERE owner='INFOCENT' AND table_name LIKE '%CIU%'`. 200 OK pero con esta observación abierta.
- `INFOCENT.EO_TIPO_NOMINA` (→ `payroll-types`): 23 columnas de negocio (`ID_EMPRESA`, `ID`, `NOMBRE`, `CLANOM`, `FRECUENCIA`, `FECHA_TOPE1-5`, `SALARIO_GUAR`, `CANTI_SALARIO`, `FACTOR_GUAR`, `ASIGNA_FON`, `DEDUC_FON`, `FACTOR_FON`, `FECHA_ABONO`, `REDONDEO`, `TIPO_FECHA_IN`, `REGRESO_HABIL`, `ANO_360`, `PGM_RECIBO`, `FRE_SALARIO`) — tabla de configuración de nómina, no un catálogo simple. Scoped por `ID_EMPRESA` — `companyId` OPCIONAL. ✅ Verificado.
- `INFOCENT.NMT023` (→ `groups`): `CIA_CODCIA`, `TNOM_TIPNOM`, `CODGRU`, `DESGRU`, `TIPJORN`, `LABDOM`. `CODGRU` no es único global (depende de `CIA_CODCIA + TNOM_TIPNOM`) — `companyId`/`payrollTypeCode` OPCIONALES. ✅ Verificado.
- `INFOCENT.NMT038` (→ `branches`): `CIA_CODCIA`, `CODSUC`, `DESSUC`, `CODCTB`, `CODUBI`. `CODSUC` scoped a `CIA_CODCIA` — `companyId` OPCIONAL. ✅ Verificado.
- `INFOCENT.NMT020` (→ `banks`): tabla mixta de instituciones (`CIA_CODCIA`, `TIPI_CODTIP`, `CODINS`, `DESINS`, `NRORIF`, `DIREC1/2/3`, `CDAD_CODCIU`, `EDO_CODEDO`, `PAI_CODPAI`, `NROTL1/2`, `NROFAX`, `NROCTA`, `CTACON`, `NOMCON`, `TCTA_TIPCTA`, `NOCTTO`, `CODRIE`). Confirmados 5 tipos de institución: `01`=bancos (DAVIVIENDA, BANCOLOMBIA, BANCO DE BOGOTÁ), `RP`=riesgos laborales, `PE`=pensión, `CA`=caja de compensación, `SA`=EPS/salud. `PRC_GET_BANKS` filtra `TIPI_CODTIP = '01'` (confirmado con varias muestras reales) + `companyId` opcional. `NOCTTO` se expone como `contractNumber` — nombre no confirmado semánticamente. ✅ Verificado (7 bancos reales en CO, sin mezcla).
- `INFOCENT.NMT022` (→ `account-types`): `TIPCTA`, `DESCTA` (`NOT NULL`). Solo 2 filas en QA: `1`=CUENTA CORRIENTE, `2`=CUENTA AHORRO. Sin filtros. ✅ Verificado.
- `INFOCENT.EO_TIPO_IDENTIFICACION` (→ `id-types`): `ID`, `DESCRIP` (`NOT NULL`). Tabla plana, sin filtros (algunas entradas legacy redundantes, ej. `4`/`CC` ambos "cédula de ciudadanía"). ✅ Verificado.

**Pendiente:**
- **"Validar reingreso"** (a partir de la cédula) **no está incluido** — falta la consulta SQL (pendiente de Jhon). Se agrega como catálogo 13 en cuanto llegue.
- Confirmar el `DOMAIN` correcto de `cities` (`SPI_REF`) — pendiente de conversación del usuario con la persona que dio la información original.

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
