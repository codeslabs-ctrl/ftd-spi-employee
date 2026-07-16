export const MARITAL_STATUS_JSON_FIELDS = ['id', 'name', 'legalCode'] as const;

export function toMaritalStatusPayload(dto: object): Record<string, unknown> {
  const source = dto as Record<string, unknown>;
  const payload: Record<string, unknown> = {};
  for (const field of MARITAL_STATUS_JSON_FIELDS) {
    if (source[field] !== undefined) payload[field] = source[field];
  }
  return payload;
}
