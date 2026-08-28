/**
 * The two numbers that govern carry-over cards.
 *
 * They are named constants rather than literals because both are expected to be tuned once Mark has
 * used the screen: design-system.md 9.3 calls the carry-over display "the one Mark expects to iterate
 * on", and these are the two dials.
 */

/**
 * Carry-overs open expanded at or below this count and collapsed above it.
 *
 * A small pile stays visible and draggable for free; a large one defers to the week's own work until
 * asked for. Nine seeded records really do carry over from week 16 Aug into week 23 Aug, and expanded
 * that is 360px of repeats pushing the week's own cards off a 544px list.
 *
 * This is also what makes the two proposals in design-system.md 9.3 the same component: Proposal B
 * ("one summary strip per band") is Proposal A ("repeat every record") collapsed, so Mark can compare
 * them at runtime rather than in another design pass.
 */
export const CARRY_OVER_EXPAND_LIMIT = 4;

/**
 * Weeks forward of the *current* week that a carry-over may still appear in.
 *
 * Four covers the seeded span and APG's booking window. Past that, a record still holding unmatched
 * stock is a data-quality problem rather than a matching opportunity, and repeating it forever would
 * bury the weeks that matter.
 */
export const CARRY_OVER_HORIZON_WEEKS = 4;
