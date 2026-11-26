import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button, SaveError, TextField } from '@/components/ui'
import { totpCodeRequestSchema, type TotpCodeRequest } from '@/lib/schemas'

interface CodeFormProps {
  /** Names the field for assistive tech, which reads it before the digits. */
  label?: string
  submitLabel: string
  pendingLabel: string
  isPending: boolean
  error: Error | null
  variant?: 'primary' | 'danger'
  onSubmit: (code: string) => void
}

/**
 * The six digits of the authenticator app. One component for the sign-in step
 * and for turning the factor on and off, so the field behaves the same in the
 * three: numeric keyboard on a phone, and the browser may offer the code the
 * phone received (`one-time-code`).
 */
export function CodeForm({
  label = 'Código do aplicativo (6 dígitos)',
  submitLabel,
  pendingLabel,
  isPending,
  error,
  variant = 'primary',
  onSubmit,
}: CodeFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TotpCodeRequest>({ resolver: zodResolver(totpCodeRequestSchema), defaultValues: { code: '' } })

  return (
    <form onSubmit={(event) => void handleSubmit(({ code }) => onSubmit(code))(event)} className="flex w-full flex-col gap-4" noValidate>
      <TextField
        label={label}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="000000"
        error={errors.code?.message}
        {...register('code', { setValueAs: (value: string) => value.trim() })}
      />
      <SaveError error={error} />
      <Button variant={variant} type="submit" fullWidth disabled={isPending}>
        {isPending ? pendingLabel : submitLabel}
      </Button>
    </form>
  )
}
