import { Response } from 'express';

export function handleApiError(res: Response, err: any) {
  const statusCode = err?.statusCode || (err?.isPermissionDenied || err?.code === 7 ? 403 : 500);
  const message = err?.message || 'Terjadi kesalahan pada server/database';
  return res.status(statusCode).json({
    error: message,
    status: err?.isPermissionDenied ? 'PERMISSION_DENIED' : 'DATABASE_ERROR',
    code: err?.code || statusCode,
  });
}
