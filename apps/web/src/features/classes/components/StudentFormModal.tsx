import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router-dom'
import { studentInputSchema, type StudentInput } from '@/lib/schemas'
import { Button, Modal, TextField } from '@/components/ui'
import { ROUTES } from '@/app/routes'
import { useAddStudent } from '../hooks/useClasses'

const EMPTY: StudentInput = { fullName: '', registration: '', email: undefined }

export function StudentFormModal({
  open,
  onOpenChange,
  classId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  classId: string
}) {
  const addStudent = useAddStudent(classId)

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<StudentInput>({ resolver: zodResolver(studentInputSchema), defaultValues: EMPTY })

  useEffect(() => {
    if (open) reset(EMPTY)
  }, [open, reset])

  const onSubmit = async (input: StudentInput) => {
    try {
      await addStudent.mutateAsync({ ...input, email: input.email || undefined })
      onOpenChange(false)
    } catch (error) {
      setError('registration', {
        message: error instanceof Error ? error.message : 'Não foi possível adicionar.',
      })
    }
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

        <p className="rounded-[var(--radius-control)] bg-surface-muted p-3 text-caption text-ink-muted">
          Você é responsável pelos dados pessoais de terceiros que insere aqui. O aluno pode
          solicitar a anonimização a qualquer momento.{' '}
          <Link to={ROUTES.privacy} className="underline">
            Aviso de privacidade
          </Link>
        </p>

        <div className="mt-2 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Salvando…' : 'Adicionar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
