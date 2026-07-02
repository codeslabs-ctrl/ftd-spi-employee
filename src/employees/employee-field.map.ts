export interface FieldMapping {
  bind: string; // PKG parameter name
  column: string; // column in INFOCENT.EO_PERSONA
  updatable?: boolean;
  sqlExpr?: string; // SQL expression for the bind (e.g. TO_DATE)
}

// Single source of truth: API field → PKG bind → table column.
// Adding an attribute = one DTO field (with validation) + one entry here;
// binds, PL/SQL args, UPDATE clauses and response mapping derive from it.
// Bind/column names assumed — locked once Task 0 confirms the real PKG signature.
export const EMPLOYEE_FIELD_MAP: Record<string, FieldMapping> = {
  idNumber: { bind: 'p_cedula', column: 'CEDULA' },
  nationality: { bind: 'p_nacionalidad', column: 'NACIONALIDAD', updatable: true },
  firstName: { bind: 'p_primer_nombre', column: 'PRIMER_NOMBRE', updatable: true },
  middleName: { bind: 'p_segundo_nombre', column: 'SEGUNDO_NOMBRE', updatable: true },
  lastName: { bind: 'p_primer_apellido', column: 'PRIMER_APELLIDO', updatable: true },
  secondLastName: { bind: 'p_segundo_apellido', column: 'SEGUNDO_APELLIDO', updatable: true },
  birthDate: {
    bind: 'p_fecha_nacimiento',
    column: 'FECHA_NACIMIENTO',
    updatable: true,
    sqlExpr: "TO_DATE(:p_fecha_nacimiento, 'YYYY-MM-DD')",
  },
  gender: { bind: 'p_sexo', column: 'SEXO', updatable: true },
};

export function rowToEmployee(row: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [field, m] of Object.entries(EMPLOYEE_FIELD_MAP)) {
    if (row[m.column] !== undefined) out[field] = row[m.column];
  }
  return out;
}
