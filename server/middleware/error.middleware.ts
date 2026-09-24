import { Request, Response, NextFunction } from 'express';
import { Sentry } from '../core/observability/sentry';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: unknown;
}

export const errorMiddleware = (
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  const code = err.code || 'INTERNAL_SERVER_ERROR';

  console.error(`[Error] ${req.method} ${req.url} - ${statusCode}:`, err);

  if (statusCode >= 500) {
    try {
      Sentry.withScope((scope) => {
        scope.setTag('http.method', req.method);
        scope.setTag('http.path', req.path);
        scope.setTag('http.status_code', String(statusCode));
        scope.setExtra('error_code', code);
        Sentry.captureException(err);
      });
    } catch {}
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    code,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};
