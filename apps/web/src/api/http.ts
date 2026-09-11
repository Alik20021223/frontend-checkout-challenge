export type FieldError = { path: string; message: string };

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

export type RequestOptions = {
  method?: Method;
  body?: unknown;
  idempotencyKey?: string;
  signal?: AbortSignal;
  auth?: boolean;
};

type HttpConfig = {
  baseUrl: string;
  token: () => string | null;
  renewSession: () => Promise<unknown>;
};

type ErrorBody = { error?: { code?: string; message?: string; fields?: FieldError[] } };

export class ApiError extends Error {
  readonly name = 'ApiError';

  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields: FieldError[] = [],
  ) {
    super(message);
  }
}

const fallbackMessages: Record<number, string> = {
  0: 'Не удалось связаться с сервером. Проверьте соединение и повторите попытку.',
  500: 'На сервере произошла ошибка. Повторите попытку позже.',
};

export const isAbort = (error: unknown) =>
  error instanceof DOMException && error.name === 'AbortError';

export const toApiError = (error: unknown) =>
  error instanceof ApiError
    ? error
    : new ApiError(0, 'UNEXPECTED_ERROR', 'Что-то пошло не так. Повторите попытку.');

async function readBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  try {
    return await response.json();
  } catch {
    throw new ApiError(
      response.status,
      'INVALID_RESPONSE',
      'Сервер вернул ответ в неожиданном формате.',
    );
  }
}

function toError(status: number, body: unknown) {
  const error = (body as ErrorBody | undefined)?.error;
  return new ApiError(
    status,
    error?.code ?? 'HTTP_ERROR',
    error?.message ?? fallbackMessages[status] ?? `Запрос завершился с ошибкой ${status}.`,
    error?.fields,
  );
}

export function createHttp({ baseUrl, token, renewSession }: HttpConfig) {
  async function send(path: string, options: RequestOptions) {
    const { method = 'GET', body, idempotencyKey, signal, auth = true } = options;
    const headers = new Headers();
    if (body !== undefined) headers.set('Content-Type', 'application/json');
    if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);
    const bearer = auth ? token() : null;
    if (bearer) headers.set('Authorization', `Bearer ${bearer}`);
    try {
      return await fetch(baseUrl + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
      });
    } catch (error) {
      if (isAbort(error)) throw error;
      throw new ApiError(0, 'NETWORK_ERROR', fallbackMessages[0]);
    }
  }

  return async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    let response = await send(path, options);
    if (response.status === 401 && options.auth !== false) {
      await renewSession();
      response = await send(path, options);
    }
    const body = await readBody(response);
    if (!response.ok) throw toError(response.status, body);
    return body === undefined ? (undefined as T) : (body as { data: T }).data;
  };
}
