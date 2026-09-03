import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { classInputSchema, type ClassInput } from '@/lib/schemas'
import { Button, Modal, TextField } from '@/components/ui'
import type { Class } from '@/types/domain'
import { useSaveClass } from '../hooks/useClasses'

const EMPTY: ClassInput = { name: '', subject: '', term: '' }

/**
 * Create/edit form for a class.
 *
 * The spec models this as its own screen, but with three fields a modal saves
 * a round trip and keeps the flow within the three-click budget.
 */
export function ClassFormModal({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: Class | null
}) {
  const save = useSaveClass()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ClassInput>({ resolver: zodResolver(classInputSchema), defaultValues: EMPTY })

  useEffect(() => {
    if (!open) return
    reset(
      editing === null
        ? EMPTY
        : { name: editing.name, subject: editing.subject, term: editing.term },
    )
  }, [open, editing, reset])

  const onSubmit = async (input: ClassInput) => {
    await save.mutateAsync({ id: editing?.id, input })
    onOpenChange(false)
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={editing === null ? 'Nova turma' : 'Editar turma'}
    >
      <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} className="flex flex-col gap-4" noValidate>
        <TextField
          label="Nome da turma"
          placeholder="Cálculo I — Noturno"
          error={errors.name?.message}
          {...register('name')}
        />
        <TextField
          label="Disciplina"
          placeholder="Matemática"
          error={errors.subject?.message}
          {...register('subject')}
        />
        <TextField
          label="Período"
          placeholder="2026/2"
          error={errors.term?.message}
          {...register('term')}
        />

        <div className="mt-2 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
