import { MatchCancellationReason } from '../../api/models';

/**
 * The three cancellation reasons, in the words design-system.md 15 fixes them in.
 *
 * A presentation mapping over a closed enum, in the same spirit as `transactionTypeLabel` — the set
 * itself is the domain's, and there are exactly three. It lives here rather than beside the card
 * chrome because nothing outside this folder shows a cancellation: a cancelled match is excluded from
 * both parent DTOs, so the only place these strings can appear is the dialog that produces one.
 *
 * The order is the order they are offered in, and it is the spec's: the two external causes first,
 * APG's own decision last.
 */
export const CANCELLATION_REASONS: readonly {
  readonly value: MatchCancellationReason;
  readonly label: string;
}[] = [
  { value: 'ChangeFromAgentOrFarmer', label: 'Change from Agent/Farmer' },
  { value: 'ChangeFromProcessor', label: 'Change from Processor' },
  { value: 'InternalDecisionByApg', label: 'Internal decision by APG' },
] as const;
