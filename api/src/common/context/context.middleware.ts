import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { requestContext, RequestContext } from './request-context';

/** Establishes an AsyncLocalStorage store for every request. Guards enrich it after auth. */
export function contextMiddleware(req: Request, res: Response, next: NextFunction) {
  const store: RequestContext = {
    requestId: randomUUID(),
    ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip,
    userAgent: req.headers['user-agent'],
  };
  res.setHeader('X-Request-Id', store.requestId);
  requestContext.run(store, () => next());
}
