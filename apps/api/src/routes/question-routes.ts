import { Router } from 'express';
import type { Kysely } from 'kysely';
import type { Database } from '../models/tables.js';
import { QuestionRepository } from '../repositories/question-repository.js';
import { QuestionService } from '../services/question-service.js';
import { QuestionController } from '../controllers/question-controller.js';

export function questionRoutes(db: Kysely<Database>): Router {
  const router = Router();
  const repository = new QuestionRepository(db);
  const service = new QuestionService(repository);
  const controller = new QuestionController(service);

  router.post('/', controller.create);
  router.get('/', controller.list);
  router.get('/tags', controller.listTags);
  router.get('/:id', controller.getById);
  router.patch('/:id', controller.update);
  router.delete('/:id', controller.archive);
  router.patch('/:id/restore', controller.restore);

  return router;
}