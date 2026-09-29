import { z } from '@hono/zod-openapi';

export const PROBLEM_CONTENT_TYPE = 'application/problem+json';

/** RFC 9457 problem details, plus `requestId` and optional field `errors` extensions. */
export const problemSchema = z
  .object({
    type: z.string().meta({ example: 'about:blank' }),
    title: z.string().meta({ example: 'Not Found' }),
    status: z.number().int().meta({ example: 404 }),
    detail: z.string().optional(),
    instance: z.string().meta({ example: '/v1/unknown' }),
    requestId: z.string(),
    errors: z
      .array(z.object({ field: z.string(), message: z.string(), code: z.string() }))
      .optional(),
  })
  .meta({ id: 'Problem' });

export type Problem = z.infer<typeof problemSchema>;

const titles: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  413: 'Payload Too Large',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  503: 'Service Unavailable',
};

export function titleFor(status: number): string {
  return titles[status] ?? (status >= 500 ? 'Server Error' : 'Client Error');
}

/** Throwable application error mapped to a problem+json response. */
export class AppError extends Error {
  readonly status: number;
  readonly type: string;
  readonly detail: string | undefined;

  constructor(status: number, detail?: string, type = 'about:blank') {
    super(detail ?? titleFor(status));
    this.name = 'AppError';
    this.status = status;
    this.type = type;
    this.detail = detail;
  }
}

/** Builds a Response with `application/problem+json` content type. */
export function problemResponse(problem: Problem): Response {
  return new Response(JSON.stringify(problem), {
    status: problem.status,
    headers: { 'content-type': PROBLEM_CONTENT_TYPE },
  });
}
