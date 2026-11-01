import { ButtonLink } from './ButtonLink'
import { Card } from './Card'
import { EmptyState } from './EmptyState'
import { SearchIllustration } from './illustrations'

/**
 * A record that is not there: deleted, of another teacher (the API answers
 * 404 for both, and the screen does not tell them apart), or a wrong address.
 * It says what is missing and offers the way back, in the same shape an empty
 * list uses, so it reads as an answer and not as a broken page.
 */
export function NotFoundState({
  title,
  description,
  backTo,
  backLabel,
}: Readonly<{ title: string; description: string; backTo: string; backLabel: string }>) {
  return (
    <Card>
      <EmptyState
        illustration={<SearchIllustration />}
        title={title}
        description={description}
        action={
          <ButtonLink variant="secondary" to={backTo}>
            {backLabel}
          </ButtonLink>
        }
      />
    </Card>
  )
}
