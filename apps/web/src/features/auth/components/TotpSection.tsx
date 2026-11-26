import { ShieldCheck } from 'lucide-react'
import { Button, Card, SaveError } from '@/components/ui'
import { useDisableTotp, useEnableTotp, useTotpSetup } from '../hooks/useAuth'
import { CodeForm } from './CodeForm'

/** Starts with a button; once the server answered the setup, shows the QR Code, the secret to type and the field for the first code. */
function Enrolment() {
  const setup = useTotpSetup()
  const enable = useEnableTotp()

  if (setup.data === undefined) {
    return (
      <>
        <p className="text-body text-ink-muted">
          Desativada. Com ela ligada, quem descobrir sua senha ainda precisa do código do seu celular para entrar.
        </p>
        <SaveError error={setup.error} />
        <Button variant="primary" icon={<ShieldCheck size={18} aria-hidden />} disabled={setup.isPending} onClick={() => setup.mutate()}>
          {setup.isPending ? 'Gerando o QR Code…' : 'Ativar verificação em duas etapas'}
        </Button>
      </>
    )
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <ol className="list-decimal pl-5 text-body text-ink-muted">
        <li>Abra um aplicativo autenticador (Google Authenticator, Authy, 1Password…).</li>
        <li>Escaneie o QR Code abaixo ou digite a chave.</li>
        <li>Digite o código de 6 dígitos que o aplicativo mostrar.</li>
      </ol>
      <img src={setup.data.qrCodeDataUrl} alt="QR Code para o aplicativo autenticador" width={200} height={200} className="self-center rounded-[var(--radius-control)] border border-line bg-white p-2" />
      <div>
        <p className="text-label text-ink-muted">Chave para digitar no aplicativo</p>
        <code className="block break-all text-body text-ink" data-testid="totp-secret">
          {setup.data.secret}
        </code>
      </div>
      <CodeForm
        label="Código de confirmação (6 dígitos)"
        submitLabel="Confirmar e ativar"
        pendingLabel="Confirmando…"
        isPending={enable.isPending}
        error={enable.error}
        onSubmit={(code) => enable.mutate(code)}
      />
      <Button variant="secondary" onClick={() => setup.reset()}>
        Cancelar
      </Button>
    </div>
  )
}

function Disable() {
  const disable = useDisableTotp()

  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <p className="flex items-center gap-2 text-body text-ink">
        <ShieldCheck size={18} aria-hidden className="text-success" />
        Ativada: ao entrar, o Correctio pede o código do aplicativo.
      </p>
      <p className="text-body text-ink-muted">Para desativar, digite o código atual do aplicativo.</p>
      <CodeForm
        label="Código para desativar (6 dígitos)"
        submitLabel="Desativar verificação em duas etapas"
        pendingLabel="Desativando…"
        variant="danger"
        isPending={disable.isPending}
        error={disable.error}
        onSubmit={(code) => disable.mutate(code)}
      />
    </div>
  )
}

/**
 * Optional second factor of the account (security analysis, R2). While off, the
 * section offers enrolment; once on, it offers turning off with a current code.
 * The state comes from the server (`totpEnabled` of `GET /me`), never from what
 * this screen did last.
 */
export function TotpSection({ enabled }: Readonly<{ enabled: boolean }>) {
  return (
    <Card className="flex flex-col items-start gap-3 p-6">
      <h2 className="text-title text-primary">Verificação em duas etapas</h2>
      {enabled && <Disable />}
      {!enabled && <Enrolment />}
    </Card>
  )
}
