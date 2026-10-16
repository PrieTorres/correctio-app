import type { Logger } from 'pino'
import { describe, expect, it, vi } from 'vitest'
import { createLogMailer } from '../mailer'

const MESSAGE = { to: 'ana@exemplo.edu.br', subject: 'Assunto', text: 'link secreto', html: '<p>link secreto</p>' }

function spyLogger() {
  const logger = { info: vi.fn(), error: vi.fn() }
  return { logger, asLogger: logger as unknown as Logger }
}

describe('createLogMailer', () => {
  it('writes the e-mail to the log on a developer machine, where reading the link there is the point', async () => {
    const { logger, asLogger } = spyLogger()
    await createLogMailer(asLogger, { production: false }).send(MESSAGE)

    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ text: 'link secreto' }), expect.any(String))
  })

  it('reports an error on a deployed API without ever printing the link', async () => {
    const { logger, asLogger } = spyLogger()
    await createLogMailer(asLogger, { production: true }).send(MESSAGE)

    expect(logger.error).toHaveBeenCalledOnce()
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain('link secreto')
    expect(logger.info).not.toHaveBeenCalled()
  })
})
