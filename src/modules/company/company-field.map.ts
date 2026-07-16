export const COMPANY_JSON_FIELDS = [
  'id',
  'name',
  'shortName',
  'sector',
  'isPublic',
  'taxId1',
  'taxId2',
  'address',
  'city',
  'postalCode',
  'phone1',
  'phone2',
  'webPage',
  'email',
] as const;

export function toCompanyPayload(dto: object): Record<string, unknown> {
  const source = dto as Record<string, unknown>;
  const payload: Record<string, unknown> = {};
  for (const field of COMPANY_JSON_FIELDS) {
    if (source[field] !== undefined) payload[field] = source[field];
  }
  return payload;
}
