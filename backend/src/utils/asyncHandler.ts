import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Wraps async Express route handlers and forwards rejected promises to Express error middleware.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
