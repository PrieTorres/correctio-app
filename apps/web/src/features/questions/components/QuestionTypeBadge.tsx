import { AlignLeft, CircleDot } from 'lucide-react';
import { Badge } from '@/components/ui';
import type { QuestionType } from '@/types/domain';

const TYPE_BADGE = {
  objetiva: { tone: 'info', label: 'Objetiva', Icon: CircleDot },
  discursiva: { tone: 'warning', label: 'Discursiva', Icon: AlignLeft },
} as const satisfies Record<QuestionType, unknown>;

/**
 * Tells the two kinds of question apart at a glance.
 *
 * Colour and icon carry the difference together rather than colour alone: the
 * distinction matters most when scanning a long list, which is exactly when
 * colour-blind readers and grey-scale printouts lose it. The icons echo the
 * shape of each kind — a chosen option against lines of written text.
 */
export function QuestionTypeBadge({ type }: Readonly<{ type: QuestionType }>) {
  const { tone, label, Icon } = TYPE_BADGE[type];

  return (
    <Badge tone={tone} icon={<Icon size={13} aria-hidden />}>
      {label}
    </Badge>
  );
}
