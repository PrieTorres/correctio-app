export type StorageErrorCode = 'not-found' | 'invalid' | 'conflict' | 'quota-exceeded' | 'failure'

/** Single error shape, matching what the HTTP API will return. */
export class StorageError extends Error {
  constructor(
    message: string,
    readonly code: StorageErrorCode,
    options?: { cause?: unknown },
  ) {
    super(message, options)
    this.name = 'StorageError'
  }
}
