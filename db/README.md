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
| job-post | `pkg_management_job_post` | `INFOCENT.EO_PUESTO` | **NO existe en QA** |

Para puestos solo aparece `INFOCENT.TA_RELACION_PUESTO` (relación laboral), no el catálogo.  
El body de `job_post` usa SQL dinámico y apunta a `GC_TABLE = 'INFOCENT.EO_PUESTO'` — el DBA debe crear la tabla o cambiar esa constante.

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
