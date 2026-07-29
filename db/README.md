# Oracle PKG — CRUD adicionales SPI

Scripts para esquema de conexión **`people_one`** (QA: `NOMQAVE`).  
Contrato: `I_JSON CLOB → O_JSON? / O_COD / O_MESSAGE` (mismos códigos que Employee).

## `pkg_global_errors_api.sql` — manejo de errores en español (paquete único, compartido)

`PKG_GLOBAL_ERRORS.FN_GET_ERROR_MESSAGE(P_SQLCODE, P_SQLERRM, P_CONTEXT)` centraliza la traducción de errores Oracle comunes (tabla no existe, sin privilegios, timeout/pérdida de conexión, clave duplicada, sin registros) a un mensaje en español, con fallback genérico para el resto. Antes cada paquete (`catalogs`, `company`, `employee`, `job-post`, `marital-status`, `org-unit`, `position`) tenía su propia copia idéntica de esta función; se centralizó en un solo paquete (2026-07-28) para que agregar o ajustar un mapeo de código Oracle se haga en un solo lugar y se replique a todos los paquetes que lo llaman, en vez de tener que editar 7 archivos cada vez.

Todos los `PKG_MANAGEMENT_*` la llaman calificada (`PKG_GLOBAL_ERRORS.FN_GET_ERROR_MESSAGE(...)`) desde su bloque `WHEN OTHERS`, pasando la tabla/recurso afectado como contexto (p. ej. `'INFOCENT.EO_EMPRESA'`). **Compilar `pkg_global_errors_api.sql` antes que cualquier otro paquete** — ya está primero en `scripts/compile-pkgs.js`.

`PKG_MANAGEMENT_EMPLOYEE` también vive en `people_one` (se quitó la calificación `CORSOX.` que tenía antes — no corresponde) y llama a `PKG_GLOBAL_ERRORS` sin calificar esquema, igual que el resto de paquetes.

**Códigos Oracle mapeados (2026-07-28):** objeto/privilegios (`-942` tabla no existe, `-1031` sin privilegios, `-904` columna inválida, `-911` carácter inválido), conexión (`-12154` TNS, `-1017` usuario/clave, `-12170`/`-12535` timeout, `-3113`/`-3114` conexión perdida, `-25408` replay inseguro), concurrencia (`-54` registro bloqueado, `-60` deadlock, `-1013` operación cancelada), integridad de datos (`-1` clave duplicada, `-2291` FK — padre no encontrado, `-2292` FK — hijos dependientes, `-1400` NOT NULL, `-1722` número inválido, `-1830`/`-1858`/`-1861` formato de fecha, `-12899` valor muy largo, `-6502` error numérico/buffer PL-SQL), aplicación (`-20000..-20999` de `RAISE_APPLICATION_ERROR`, devuelve el mensaje de negocio tal cual se lanzó) y sin datos (`100`/`-1403`). Cualquier otro código cae al mensaje genérico con el `SQLERRM` acotado a 300 caracteres.

## Tablas verificadas en QA (2026-07-16)

| Recurso | PKG | Tabla | Estado |
|---|---|---|---|
| position | `pkg_management_position` | `INFOCENT.EO_CARGO` | OK |
| company | `pkg_management_company` | `INFOCENT.EO_EMPRESA` | OK |
| marital-status | `pkg_management_marital_status` | `INFOCENT.EO_ESTADO_CIVIL` | OK |
| org-unit | `pkg_management_org_unit` | `INFOCENT.EO_UNIDAD` | OK |
| job-post | `pkg_management_job_post` | `INFOCENT.EO_PUESTO` | OK (confirmada, columnas verificadas) |
| catalogs (19 catálogos + validar reingreso) | `pkg_management_catalogs` | ver detalle abajo | 19/19 catálogos de solo lectura confirmados y migrados a SELECT estático (12 verificados contra QA Colombia real + 7 agregados 2026-07-29 con DESCRIBE/SELECT confirmados, probados con FAKE_DB, aún sin evidencia Postman contra QA real); `cities` sin filtro de dominio (ver nota). Más `PRC_VALIDATE_REENTRY` (escribe) — wireing Node completo, probado con FAKE_DB, pendiente confirmar esquema de `FTD_INGRESOS` y compilar/probar contra QA real. |

Nota histórica: en la verificación inicial (2026-07-16) `INFOCENT.EO_PUESTO` no aparecía en QA VE y solo se encontraba `INFOCENT.TA_RELACION_PUESTO` (relación laboral). Ya se confirmó que la tabla existe con las columnas esperadas (`ID_EMPRESA, ID_UNIDAD, ID, NOMBRE, ID_CARGO, DESCRIP, FUNCION, FECHA_INI, FECHA_FIN, RIESGO`), así que el paquete se reescribió con `SELECT` estático (mismo estilo que `position`) en vez del SQL dinámico que se usaba como salvaguarda.

## `pkg_management_catalogs_api.sql` — un solo paquete para 19 catálogos + validar reingreso

Un único paquete Oracle (`PKG_MANAGEMENT_CATALOGS`) agrupa el GET de todos los catálogos de solo lectura pedidos: municipios, países, parroquias, localidades, ciudades, entidades federales, tipos de nómina, grupos, sucursales, bancos, tipos de cuenta, tipos de identificación, causales de retiro, motivos de cambio, tipos de contrato de trabajo, y (solo Colombia) fondos de pensión/AFP, EPS, cajas de compensación y fondos de cesantías. Más `PRC_VALIDATE_REENTRY` ("Validar reingreso"), el único que escribe.

Convención de nombres: procedimientos/funciones del paquete en inglés (`PRC_GET_COUNTRIES`, `PRC_GET_BANKS`...), igual que el resto de paquetes (`PRC_GET_EMPLOYEE`, `PRC_MERGE_POSITION`...). Los mensajes de error sí van en español (contenido, no identificador).

**Migración a SELECT estático (2026-07-27/28):** igual que se hizo con `job-post`, cada wrapper usa un `SELECT` estático explícito sobre su tabla real — mismo estilo que `position`/`job-post` (`PRC_PARSE_*_FILTER` + `FOR` loop + `FN_JSON_PAIR_CC`, que preserva camelCase en las claves del JSON). **Los 12 catálogos ya están migrados**; el motor genérico (`PRC_GET_GENERIC_CATALOG`, `DBMS_SQL`) y su `FN_JSON_PAIR` (forzaba minúsculas) se eliminaron del paquete por quedar sin ningún wrapper que los usara.

**Política de campos (2026-07-28):** se exponen **todas** las columnas de cada tabla, incluida auditoría — decisión explícita de no recortar nada para evitar que después pidan campos que se quitaron (a diferencia del resto del API, que sí excluye `USRCRE`/`FECCRE`/`USRACT`/`FECACT`). Se agregaron como `createdBy`/`createdAt`/`updatedBy`/`updatedAt` en los catálogos cuya tabla real tiene esas columnas: `localities`, `groups`, `branches`, `banks`, `account-types`, `payroll-types`. Los que no las tienen en la BD (`countries`, `states`, `municipalities`, `parishes`, `cities`) no las exponen porque no existen.

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

**13ª — `PRC_VALIDATE_REENTRY` ("Validar reingreso", 2026-07-28):** a diferencia de los otros 17 (solo lectura), este SÍ escribe. Input: `{ "numIden": "<cédula>", "reingreso": "SI"|"NO" }` (lo que el caller declara). Busca en `INFOCENT.EO_PERSONA` + `INFOCENT.TA_RELACION_LABORAL` (prioriza relación laboral activa, `F_RETIRO IS NULL`, sobre una ya retirada) para determinar si la cédula tiene rastro previo; si lo declarado por el caller no coincide con lo encontrado, corrige `INFOCENT.FTD_INGRESOS.REINGRESO` (`UPDATE` + `COMMIT`) — misma lógica que pasó Jhon, adaptada al contrato `I_JSON`/`O_JSON`/`O_COD`/`O_MESSAGE`. Salida: `{ "reentry": { "numIden", "declaredReingreso", "reingreso" (valor final/corregido), "corrected" ("S"/"N"), "value" (0/1, mismo valor que devolvía la función original de Jhon) } }`. Wireing Node completo (`POST /catalogs/validate-reentry`) y probado con FAKE_DB (2026-07-29).

⚠️ **Supuesto pendiente de confirmar:** se asume que `FTD_INGRESOS` vive en el esquema `INFOCENT` (igual que el resto de tablas de este paquete) con columnas `NUMERO_DOCUMENTO` y `REINGRESO` — Jhon las pasó sin calificar esquema en su query. Ajustar el nombre de tabla en `PRC_VALIDATE_REENTRY` si en realidad vive en otro esquema.

**14ª-19ª (2026-07-29) — NMT035/NMT036 confirmadas + 4 tipos de institución NMT020 adicionales:**
- `INFOCENT.NMT035` (→ `termination-reasons`): `CODDES`, `DESDE1`, `DESDE2`, `IMPLIQ`, `CLASSO` + auditoría. Causales de retiro/terminación (ej. "TERMINACION POR ABANDONO DE CARGO", "RENUNCIA POR PARTE DEL TRABAJADOR"). `IMPLIQ`/`CLASSO` se exponen literales — significado de negocio no confirmado. Sin filtros. ✅ Confirmada (DESCRIBE + SELECT reales).
- `INFOCENT.NMT036` (→ `change-reasons`): `CODCAM`, `DESCAM` + auditoría. Motivos de cambio/movimiento (ej. "PROMOCION", "DECRETO PRESIDENCIAL", "CONTRATO", "INGRESO", "MERITO"). Sin filtros. ✅ Confirmada.
- `INFOCENT.NMT020` — 4 tipos de institución adicionales, solo Colombia, mismo patrón que `banks` (`TIPI_CODTIP='01'`): AFP → `pension-funds` (`TIPI_CODTIP='PE'`), EPS → `health-providers` (`'SA'`), Caja de Compensación → `compensation-funds` (`'CA'`), Fondo de Cesantías → `severance-funds` (`'CE'`, tipo nuevo no visto antes). Las 4 reutilizan `PRC_PARSE_BANKS_FILTER` (genérico) y las mismas columnas/JSON que `banks`. ✅ Confirmadas.

**20ª (2026-07-29) — `INFOCENT.EO_CONTRATO_TRABAJO` (→ `contract-types`, "Contrato"):** ya con permisos, confirmada. Columnas: `ID_EMPRESA`, `ID`, `NOMBRE`, `ID_TIPO_CONTRATO`, `NUM_TOPE`, `DURACION_MAX`, `LAPSO_ESPERA`, `DURACION_MAX_ACUM`, `OBSERVACIONES` + auditoría. Scoped por `ID_EMPRESA` — `companyId` OPCIONAL (reutiliza `PRC_PARSE_BANKS_FILTER`). `NUM_TOPE`/`DURACION_MAX`/`LAPSO_ESPERA`/`DURACION_MAX_ACUM` se exponen literales — unidades (días/meses) no confirmadas. ✅ Confirmada y wireing Node probado con FAKE_DB.

**Pendiente:**
- Confirmar esquema real de `FTD_INGRESOS` (ver nota arriba) antes de compilar `PRC_VALIDATE_REENTRY` contra QA.
- Confirmar el `DOMAIN` correcto de `cities` (`SPI_REF`) — pendiente de conversación del usuario con la persona que dio la información original.
- Recompilar `pkg_management_catalogs_api.sql` en QA Colombia (ya trae los 7 catálogos nuevos + reingreso) y capturar evidencia Postman real de los 7 catálogos agregados 2026-07-29 (hoy solo probados con FAKE_DB).

**Bug corregido (2026-07-29) — filtros opcionales bloqueados del lado Node:** los filtros opcionales ya existían en Oracle (`PRC_PARSE_*_FILTER`: `companyId`, `countryCode`, `stateCode`, `municipalityId`, `payrollTypeCode`) pero `ListCatalogDto` (Node) solo whitelisteaba `page`/`size` — cualquier otro campo se rechazaba con `400 property X should not exist` antes de llegar a Oracle. Se corrigió agregando esos campos como opcionales al DTO y reenviándolos por toda la cadena (`controller` → `service` → `repository` → `I_JSON`). Verificado con FAKE_DB: `branches/list` con `companyId` ya no da 400.

Manejo de errores en español: `PKG_GLOBAL_ERRORS.FN_GET_ERROR_MESSAGE` (paquete único compartido, ver sección arriba) traduce los códigos Oracle más comunes a mensajes claros en español. Del lado Node, `src/shared/oracle/catalog-pkg-assert.ts` es el equivalente reutilizable — separado de `pkg-assert.ts` (que sigue en inglés) para no romper el contrato de errores ya probado en employee/position/company/etc. `DATA_ERROR_CODES` (catalog-pkg-assert.ts) se amplió (2026-07-29) para que los códigos "culpa del caller" (`-1722` número inválido, `-1830`/`-1858`/`-1861` formato de fecha) también devuelvan su mensaje específico en el 422, no solo un 500 genérico.

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
