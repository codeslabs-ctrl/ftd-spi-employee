import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { badRequest } from '../errors/http-error';

function flattenErrors(errors: ValidationError[], prefix = ''): string[] {
  const out: string[] = [];
  for (const e of errors) {
    const path = prefix ? `${prefix}.${e.property}` : e.property;
    if (e.constraints) out.push(...Object.values(e.constraints));
    if (e.children?.length) out.push(...flattenErrors(e.children, path));
  }
  return out;
}

export async function validateDto<T extends object>(
  Cls: new () => T,
  body: unknown,
): Promise<T> {
  const instance = plainToInstance(Cls, body ?? {}, {
    enableImplicitConversion: true,
    excludeExtraneousValues: false,
  });
  const errors = await validate(instance as object, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  if (errors.length) {
    throw badRequest('Bad Request', flattenErrors(errors));
  }
  return instance;
}
