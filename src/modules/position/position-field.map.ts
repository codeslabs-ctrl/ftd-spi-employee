export const POSITION_JSON_FIELDS = [
  'companyId',
  'id',
  'name',
  'classificationId',
  'parentPositionId',
  'description',
  'functions',
  'purpose',
  'risk',
] as const;

export function toPositionPayload(dto: object): Record<string, unknown> {
  const source = dto as Record<string, unknown>;
  const payload: Record<string, unknown> = {};
  for (const field of POSITION_JSON_FIELDS) {
    if (source[field] !== undefined) payload[field] = source[field];
  }
  return payload;
}
