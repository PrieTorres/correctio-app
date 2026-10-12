import { Router, type RequestHandler } from 'express';
import type { Kysely } from 'kysely';
import type { Database } from '../models/tables.js';
import type { HealthService } from '../services/health-service';
import { healthRoutes } from './health-routes.js';
import { questionRoutes } from './question-routes.js';

export interface RouteDependencies {
  healthService: HealthService;
  db: Kysely<Database>;
  /** Counts refused tokens per address, ahead of the gate, against guessing. */
  failedAuthLimit: RequestHandler;
  requireAuth: RequestHandler;
  /** Per-teacher budgets, behind the gate, where the teacher is known. */
  teacherLimit: RequestHandler;
}

export function createRouter({
  healthService,
  db,
  failedAuthLimit,
  requireAuth,
  teacherLimit,
}: RouteDependencies): Router {
  const router = Router();

  router.use('/health', healthRoutes(healthService));

  router.use(failedAuthLimit, requireAuth, teacherLimit);

  router.use('/questions', questionRoutes(db));

  return router;
}