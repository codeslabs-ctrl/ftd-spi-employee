export class HttpError extends Error {
  status: number;
  errors: string[];

  constructor(status: number, message: string, errors: string[] = []) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.errors = errors;
  }
}

export function badRequest(message: string, errors: string[] = []): HttpError {
  return new HttpError(400, message, errors);
}

export function unauthorized(message = 'Unauthorized'): HttpError {
  return new HttpError(401, message);
}

export function forbidden(message: string): HttpError {
  return new HttpError(403, message);
}

export function notFound(message: string): HttpError {
  return new HttpError(404, message);
}

export function conflict(message: string): HttpError {
  return new HttpError(409, message);
}

export function unprocessable(message: string): HttpError {
  return new HttpError(422, message);
}

export function internalError(message = 'Internal server error'): HttpError {
  return new HttpError(500, message);
}
