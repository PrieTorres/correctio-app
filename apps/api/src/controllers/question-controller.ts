import type { Request, Response, NextFunction } from 'express'
import { currentTeacherId } from '../middlewares/require-auth'
import type { QuestionService } from '../services/question-service'

export class QuestionController {
  constructor(private readonly service: QuestionService) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const teacherId = currentTeacherId(res)
      const question = await this.service.create(teacherId, req.body)
      res.status(201).json(question)
    } catch (error) {
      next(error)
    }
  }

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const teacherId = currentTeacherId(res)
      const question = await this.service.getById(String(req.params.id), teacherId)
      res.json(question)
    } catch (error) {
      next(error)
    }
  }

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const teacherId = currentTeacherId(res)
      const result = await this.service.list(teacherId, req.query)
      res.json(result)
    } catch (error) {
      next(error)
    }
  }

  listTags = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const teacherId = currentTeacherId(res)
      const tags = await this.service.listTags(teacherId)
      res.json({ tags })
    } catch (error) {
      next(error)
    }
  }

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const teacherId = currentTeacherId(res)
      const question = await this.service.update(String(req.params.id), teacherId, req.body)
      res.json(question)
    } catch (error) {
      next(error)
    }
  }

  archive = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const teacherId = currentTeacherId(res)
      await this.service.archive(String(req.params.id), teacherId)
      res.status(204).send()
    } catch (error) {
      next(error)
    }
  }

  restore = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const teacherId = currentTeacherId(res)
      await this.service.restore(String(req.params.id), teacherId)
      res.status(204).send()
    } catch (error) {
      next(error)
    }
  }
}