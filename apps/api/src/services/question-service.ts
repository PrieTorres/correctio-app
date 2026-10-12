/* eslint-disable */
import { randomUUID } from 'node:crypto';
import { questionInputSchema } from '@correctio/domain';
import { ApiError } from '../lib/api-error.js';
import { QuestionRepository } from '../repositories/question-repository.js';

export class QuestionService {
  constructor(private readonly repository: QuestionRepository) {}

  async create(teacherId: string, data: any) {
    const parsed = questionInputSchema.safeParse(data);

    if (!parsed.success) {
      throw new ApiError('invalid', 'Dados da questão inválidos.');
    }

    const id = randomUUID();
    return this.repository.create({ ...parsed.data, id, teacherId });
  }

  async getById(id: string, teacherId: string) {
    const question = await this.repository.findById(id, teacherId);

    if (!question) {
      throw new ApiError('not-found', 'Questão não encontrada.');
    }

    return question;
  }

  async list(teacherId: string, filters: any) {
    return this.repository.findMany(teacherId, filters);
  }

  async listTags(teacherId: string): Promise<string[]> {
    return this.repository.findDistinctTags(teacherId);
  }

  async update(id: string, teacherId: string, data: any) {
    await this.getById(id, teacherId);
    return this.repository.update(id, teacherId, data);
  }

  async archive(id: string, teacherId: string) {
    await this.getById(id, teacherId);
    await this.repository.softDelete(id, teacherId);
  }

  async restore(id: string, teacherId: string) {
    await this.getById(id, teacherId);
    await this.repository.restore(id, teacherId);
  }
}