// API fields exchanged with corsox.pkg_management_employee as JSON (I_JSON / O_JSON).
// Single source of truth on the Node side. Adding an attribute = one DTO field
// (with validation) + one entry here + the matching JSON_TABLE column / JSON_OBJECT
// key in the PKG script (db/pkg_management_employee_api.sql).
export const EMPLOYEE_JSON_FIELDS = [
  'idNumber', // NUM_IDEN
  'idType', // ID_TIPO_IDEN
  'nationality', // NACIONAL
  'passport', // PASAPORTE
  'firstName', // NOMBRE1
  'middleName', // NOMBRE2
  'lastName', // APELLIDO1
  'secondLastName', // APELLIDO2
  'birthDate', // FECHA_NA (YYYY-MM-DD)
  'gender', // SEXO ('M'/'F' in the API; '1'/'2' in the table — DECODE in the PKG)
  'maritalStatus', // EDO_CIVIL
  'address', // DIRECCION
  'city', // CIUDAD
  'phone', // TELEFONO1
  'mobile', // CELULAR
  'email', // E_MAIL1
] as const;

export type EmployeeJsonField = (typeof EMPLOYEE_JSON_FIELDS)[number];

// Picks only known, defined fields — the JSON sent to the PKG never carries extras.
export function toEmployeePayload(dto: object): Record<string, unknown> {
  const source = dto as Record<string, unknown>;
  const payload: Record<string, unknown> = {};
  for (const field of EMPLOYEE_JSON_FIELDS) {
    if (source[field] !== undefined) payload[field] = source[field];
  }
  return payload;
}
