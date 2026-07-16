export const EMPLOYEE_JSON_FIELDS = [
  'idNumber',
  'idType',
  'nationality',
  'passport',
  'firstName',
  'middleName',
  'lastName',
  'secondLastName',
  'birthDate',
  'gender',
  'maritalStatus',
  'address',
  'city',
  'phone',
  'mobile',
  'email',
] as const;

export function toEmployeePayload(dto: object): Record<string, unknown> {
  const source = dto as Record<string, unknown>;
  const payload: Record<string, unknown> = {};
  for (const field of EMPLOYEE_JSON_FIELDS) {
    if (source[field] !== undefined) payload[field] = source[field];
  }
  return payload;
}
