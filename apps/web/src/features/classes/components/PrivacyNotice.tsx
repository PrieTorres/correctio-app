import { Link } from 'react-router-dom'
import { ROUTES } from '@/app/routes'

/**
 * The privacy notice of RF39, shown wherever a teacher enters someone else's
 * personal data: the student form and the import. One component, so the two
 * places can never say different things.
 */
export function PrivacyNotice() {
  return (
    <p className="rounded-[var(--radius-control)] bg-surface-muted p-3 text-caption text-ink-muted">
      Você é responsável pelos dados pessoais de terceiros que insere aqui. O aluno pode
      solicitar a anonimização a qualquer momento.{' '}
      <Link to={ROUTES.privacy} className="underline">
        Aviso de privacidade
      </Link>
    </p>
  )
}
