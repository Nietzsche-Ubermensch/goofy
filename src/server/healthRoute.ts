import { Router, Request, Response } from 'express';

/**
 * Health check router module.
 *
 * Provides a lightweight GET endpoint that returns the server's health
 * status and current ISO 8601 timestamp. Intended for use by load
 * balancers, container orchestration platforms, and monitoring tools
 * for liveness and readiness probes.
 *
 * @module healthRoute
 */

export const healthRouter = Router();

/**
 * GET / — Health check endpoint.
 *
 * Responds with HTTP 200 and a JSON body containing the server health
 * status and the current timestamp. On unexpected failure, responds
 * with HTTP 503 and an error status.
 *
 * @param _req - Express request object (unused)
 * @param res - Express response object
 */
healthRouter.get('/', (_req: Request, res: Response): void => {
  try {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  } catch {
    if (!res.headersSent) {
      res.status(503).json({
        status: 'error',
        timestamp: new Date().toISOString(),
      });
    }
  }
});
