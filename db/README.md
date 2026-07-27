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

Nota histórica: en la verificación inicial (2026-07-16) `INFOCENT.EO_PUESTO` no aparecía en QA VE y solo se encontraba `INFOCENT.TA_RELACION_PUESTO` (relación laboral). Ya se confirmó que la tabla existe con las columnas esperadas (`ID_EMPRESA, ID_UNIDAD, ID, NOMBRE, ID_CARGO, DESCRIP, FUNCION, FECHA_INI, FECHA_FIN, RIESGO`), así que el paquete se reescribió con `SELECT` estático (mismo estilo que `position`) en vez del SQL dinámico que se usaba como salvaguarda.

## Compilar

```sql
-- como people_one
@pkg_management_position_api.sql
@pkg_management_company_api.sql
@pkg_management_marital_status_api.sql
@pkg_management_org_unit_api.sql
@pkg_management_job_post_api.sql
```

O desde el repo (usa `.env` VE):

```bash
node scripts/compile-pkgs.js
```
