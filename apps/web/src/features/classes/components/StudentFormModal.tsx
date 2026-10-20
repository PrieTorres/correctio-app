import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { studentInputSchema, type StudentInput } from '@/lib/schemas'
import { StorageError } from '@/lib/storage/errors'
import { Button, Modal, SaveError, TextField } from '@/components/ui'
import { useAddStudent } from '../hooks/useClasses'
import { PrivacyNotice } from './PrivacyNotice'

const EMPTY: StudentInput = { fullName: '', registration: '', email: undefined }

/** A registration already in the class is the one refusal the teacher fixes in a field. */
function isRegistrationConflict(error: Error | null): error is StorageError {
  return error instanceof StorageError && error.code === 'conflict'
}

/**
 * Adds one student to the class (RF07), with the privacy notice of RF39.
 *
 * Only a registration already in the class is shown under "Matrícula", because
 * that is the field to change. Any other refusal, such as the server being out
 * of reach, appears below the form: under the field it would send the teacher
 * to fix something that has nothing wrong.
 */
export function StudentFormModal({
  open,
  onOpenChange,
  classId,
}: Readonly<{
  open: boolean
  onOpenChange: (open: boolean) => void
  classId: string
}>) {
  const addStudent = useAddStudent(classId)
  const { reset: resetSave } = addStudent

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<StudentInput>({ resolver: zodResolver(studentInputSchema), defaultValues: EMPTY })

  useEffect(() => {
    if (!open) return
    reset(EMPTY)
    resetSave()
  }, [open, reset, resetSave])

  /** `mutate` with callbacks, so a refusal is shown on the form instead of becoming an unhandled rejection. */
  const onSubmit = (input: StudentInput) => {
    addStudent.mutate(input, {
      onSuccess: () => onOpenChange(false),
      onError: (error) => {
        if (isRegistrationConflict(error)) setError('registration', { message: error.message })
      },
    })
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Adicionar aluno">
      <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} className="flex flex-col gap-4" noValidate>
        <TextField
          label="Nome completo"
          error={errors.fullName?.message}
          {...register('fullName')}
        />
        <TextField
          label="Matrícula"
          error={errors.registration?.message}
          {...register('registration')}
        />
        <TextField
          label="E-mail (opcional)"
          type="email"
          error={errors.email?.message}
          {...register('email')}
        />

        <PrivacyNotice />

        <SaveError error={isRegistrationConflict(addStudent.error) ? null : addStudent.error} />

        <div className="mt-2 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" disabled={addStudent.isPending}>
            {addStudent.isPending ? 'Salvando…' : 'Adicionar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
