export const ORG_UNIT_JSON_FIELDS = [
  'companyId',
  'id',
  'name',
  'functions',
  'adminLocation',
  'startDate',
  'endDate',
  'parentUnitId',
  'maxPosts',
] as const;

export function toOrgUnitPayload(dto: object): Record<string, unknown> {
  const source = dto as Record<string, unknown>;
  const payload: Record<string, unknown> = {};
  for (const field of ORG_UNIT_JSON_FIELDS) {
    if (source[field] !== undefined) payload[field] = source[field];
  }
  return payload;
}
