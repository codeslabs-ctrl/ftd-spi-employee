export const JOB_POST_JSON_FIELDS = [
  'companyId',
  'unitId',
  'id',
  'name',
  'positionId',
  'description',
  'functions',
  'startDate',
  'endDate',
  'risk',
] as const;

export function toJobPostPayload(dto: object): Record<string, unknown> {
  const source = dto as Record<string, unknown>;
  const payload: Record<string, unknown> = {};
  for (const field of JOB_POST_JSON_FIELDS) {
    if (source[field] !== undefined) payload[field] = source[field];
  }
  return payload;
}
