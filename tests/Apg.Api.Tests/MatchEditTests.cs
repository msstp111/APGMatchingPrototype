using System.Reflection;
using Apg.Api.Contracts;
using Apg.Domain.Entities;
using Apg.Domain.Matching;

namespace Apg.Api.Tests;

/// <summary>
/// The rest of a match's life — edit, confirm, cancel, delete — and confirming a Processor Space,
/// driven off the real generated seed with no database.
/// </summary>
/// <remarks>
/// <para>
/// Two things here are worth more than the rest. The <b>edit ceiling</b> is remaining supply plus the
/// match's own current quantity (resolved question 13); the requirements document says the
/// availability record's <em>original</em> quantity, which would hand out the same animals twice. And
/// the <b>non-cascade</b>, proved in both directions at this layer as well as in the domain: cancelling
/// a match must not touch its parents, and a cancelled record keeps its matches.
/// </para>
/// <para>
/// Every test that mutates works on <see cref="Clone"/>d entities. <c>SeedFixture.Data</c> is a lazily
/// generated singleton shared by every test in the assembly, so confirming a match in place here would
/// silently change what another file asserts.
/// </para>
/// </remarks>
public class MatchEditTests
{
    private static readonly WorkingSet Seed = new(
        SeedFixture.Data.ProcessorSpaces,
        SeedFixture.Data.Availabilities,
        SeedFixture.Data.Matches,
        SeedFixture.Data.Locations,
        SeedFixture.Data.Farmers);

    // --- the ceiling ----------------------------------------------------------------------------

    /// <summary>
    /// The acceptance criterion names this case: a match that already consumes most of its record's
    /// supply. Its ceiling has to include what it is already holding, or the operator could not even
    /// keep the quantity they have.
    /// </summary>
    [Fact]
    public void The_edit_ceiling_is_remaining_supply_plus_the_matchs_own_quantity()
    {
        var (match, availability) = MostOfItsRecordsSupply();

        var unmatched = MatchQuantities.ForAvailability(availability, Seed.Matches, SeedFixture.Cancelled).Unmatched;
        var ceiling = MatchWriter.EditCeiling(Seed, match);

        Assert.Equal(unmatched + match.QuantityMatched, ceiling);

        // The case is the one it claims to be: this match really does hold most of the record.
        Assert.True(
            match.QuantityMatched * 2 > availability.QuantityAvailable,
            $"match {match.Id} holds {match.QuantityMatched} of {availability.QuantityAvailable}");
    }

    /// <summary>
    /// The failure mode of reaching for the one-argument <c>MaxMatchQuantity</c>, which is for a
    /// <em>new</em> match and adds nothing back: the operator could not resubmit the form unchanged.
    /// </summary>
    [Fact]
    public void The_ceiling_always_lets_a_match_keep_the_quantity_it_already_has()
    {
        foreach (var match in Seed.Matches.Where(MatchQuantities.IsLive))
        {
            Assert.True(
                MatchWriter.EditCeiling(Seed, match) >= match.QuantityMatched,
                $"match {match.Id} could not keep its own {match.QuantityMatched}");
        }
    }

    /// <summary>
    /// The other failure mode — the requirements document's "originally available". The ceiling may
    /// never reach a record's original quantity while another match is <em>holding</em> part of it,
    /// which is exactly the over-commit the pink state exists to flag.
    /// </summary>
    /// <remarks>
    /// "Holding" is the load-bearing word, and it is narrower than "live": a sibling match tied to a
    /// <b>cancelled</b> Processor Space consumes none of this record's supply, so the ceiling
    /// legitimately rises by its quantity. The seed has three such matches, and this test would read
    /// the ceiling as 26 rather than 58 on one of them if it counted siblings the way the arithmetic
    /// no longer does.
    /// </remarks>
    [Fact]
    public void The_ceiling_never_permits_over_committing_a_record()
    {
        foreach (var match in Seed.Matches.Where(MatchQuantities.IsLive))
        {
            var availability = Seed.Availabilities.First(a => a.Id == match.LivestockAvailabilityId);
            var ceiling = MatchWriter.EditCeiling(Seed, match);

            var siblings = MatchQuantities
                .ConsumingAvailability(availability, Seed.Matches, SeedFixture.Cancelled)
                .Where(m => m.Id != match.Id)
                .Sum(m => m.QuantityMatched);

            Assert.Equal(availability.QuantityAvailable - siblings, ceiling);
            Assert.True(ceiling <= availability.QuantityAvailable);
        }
    }

    [Fact]
    public void An_edit_is_accepted_at_exactly_the_ceiling_and_refused_one_above()
    {
        var (match, _) = MostOfItsRecordsSupply();
        var ceiling = MatchWriter.EditCeiling(Seed, match);

        Assert.Null(MatchWriter.RejectUpdate(Seed, match, Update(ceiling)));

        var rejection = MatchWriter.RejectUpdate(Seed, match, Update(ceiling + 1));
        Assert.NotNull(rejection);
        Assert.Contains($"Capped at {ceiling}", rejection);
    }

    [Fact]
    public void An_edit_below_one_head_is_refused_rather_than_emptying_the_match()
    {
        // Reducing a match to nothing is a delete or a cancel, not an edit (Phase 6, 3.1).
        var (match, _) = MostOfItsRecordsSupply();

        Assert.Equal(MatchWriter.BelowOneHead, MatchWriter.RejectUpdate(Seed, match, Update(0)));
        Assert.Equal(MatchWriter.BelowOneHead, MatchWriter.RejectUpdate(Seed, match, Update(-5)));
        Assert.Equal(MatchWriter.NoSuchMatch, MatchWriter.RejectUpdate(Seed, null, Update(1)));
    }

    /// <summary>
    /// Over-filling is deliberately asymmetric (resolved question 1). An edit may push a space past
    /// what it needs — that is the blue "Over-filled" state — and may never push a record past what
    /// the farmer has.
    /// </summary>
    [Fact]
    public void An_edit_may_over_fill_the_space_and_never_over_commit_the_record()
    {
        var set = Clone();
        var match = set.Matches.First(m => MatchQuantities.IsLive(m) && CeilingExceedsDemand(set, m));
        var ceiling = MatchWriter.EditCeiling(set, match);

        Assert.Null(MatchWriter.RejectUpdate(set, match, Update(ceiling)));
        MatchWriter.Apply(match, Update(ceiling));

        var space = MatchingProjection.SpaceById(set, match.ProcessorSpaceId)!;
        var availability = MatchingProjection.AvailabilityById(set, match.LivestockAvailabilityId)!;

        Assert.Equal(QuantityState.Over, space.QuantityState);
        Assert.Equal("Over-filled", space.QuantityStateLabel);

        // Exactly zero, never negative: the pink state stays unreachable.
        Assert.Equal(0, availability.Unmatched);
        Assert.Equal(QuantityState.Exact, availability.QuantityState);
    }

    /// <summary>Transport is trimmed on an edit exactly as it is on a create; an empty box is no carrier.</summary>
    [Fact]
    public void An_edit_writes_the_three_fields_and_leaves_the_status_alone()
    {
        var set = Clone();
        var match = set.Matches.First(m => m.Status == MatchStatus.Confirmed);

        MatchWriter.Apply(match, Update(1));

        Assert.Equal(1, match.QuantityMatched);
        Assert.Equal(6.10m, match.PricePerKg);
        Assert.Equal("Kaikoura Carriers", match.TransportCompany);
        Assert.Equal(MatchStatus.Confirmed, match.Status);

        MatchWriter.Apply(match, new UpdateMatchRequest { QuantityMatched = 1, TransportCompany = "   " });
        Assert.Null(match.TransportCompany);
        Assert.Null(match.PricePerKg);
    }

    // --- notify, confirm, cancel, delete ------------------------------------------------------------

    /// <summary>
    /// Every match here is an ANZCO one, so the only clause under test is the status. The processor
    /// clause has its own test below — picking "the first drafted match" would otherwise silently
    /// become a test of whichever processor the seed happened to put first.
    /// </summary>
    [Fact]
    public void Notify_is_refused_for_anything_but_a_draft()
    {
        var drafted = AnzcoMatch(MatchStatus.Drafted);
        var confirmed = AnzcoMatch(MatchStatus.Confirmed);
        var cancelled = AnzcoMatch(MatchStatus.Cancelled);

        Assert.Null(MatchWriter.RejectNotify(Seed, drafted));
        Assert.Equal(
            MatchLifecycle.OnlyDraftedCanBeNotified,
            MatchWriter.RejectNotify(Seed, confirmed));
        Assert.Equal(
            MatchLifecycle.OnlyDraftedCanBeNotified,
            MatchWriter.RejectNotify(Seed, cancelled));
        Assert.Equal(MatchWriter.NoSuchMatch, MatchWriter.RejectNotify(Seed, null));
    }

    /// <summary>
    /// Notification is ANZCO's alone (Mark, 2026-09-11). The seed's 70/20/10 mix means there really
    /// are drafted matches on all three processors' spaces, so this asserts over whatever the seed
    /// produced rather than over a hand-built pair.
    /// </summary>
    [Fact]
    public void Notify_is_refused_for_a_processor_that_does_not_receive_notifications()
    {
        var drafts = Seed.Matches.Where(m => m.Status == MatchStatus.Drafted).ToList();

        var byProcessor = drafts
            .Select(m => (Match: m, Space: Seed.Spaces.First(s => s.Id == m.ProcessorSpaceId)))
            .ToList();

        var notAnzco = byProcessor.Where(p => p.Space.Processor != "ANZCO").ToList();

        // The case exists in the seed at all. Without this the test could pass on an empty sequence.
        Assert.NotEmpty(notAnzco);

        foreach (var (match, space) in notAnzco)
        {
            Assert.Equal(
                $"{space.Processor} does not receive match notifications",
                MatchWriter.RejectNotify(Seed, match));
        }

        Assert.All(
            byProcessor.Where(p => p.Space.Processor == "ANZCO"),
            p => Assert.Null(MatchWriter.RejectNotify(Seed, p.Match)));
    }

    /// <summary>
    /// The footer's gate and the endpoint's are one answer, asked once. A modal that offered Notify
    /// on a match the server would refuse is the kind of disagreement that only shows up in a demo.
    /// </summary>
    [Fact]
    public void The_edit_context_carries_the_same_notify_gate_the_endpoint_enforces()
    {
        foreach (var match in Seed.Matches.Where(MatchQuantities.IsLive))
        {
            var context = MatchWriter.EditContext(Seed, match.Id);

            Assert.NotNull(context);
            Assert.Equal(MatchWriter.RejectNotify(Seed, match) is null, context!.CanNotify);
        }
    }

    /// <summary>A seeded match at <paramref name="status"/> whose space is ANZCO's.</summary>
    private static Match AnzcoMatch(MatchStatus status) =>
        Seed.Matches.First(m =>
            m.Status == status &&
            Seed.Spaces.First(s => s.Id == m.ProcessorSpaceId).Processor == "ANZCO");

    /// <summary>
    /// Notified is an entry into Confirmed, and the seed has no Notified match to draw on — it never
    /// creates one, because nothing but an operator pressing the button does. So this notifies a
    /// draft first, which is also the sequence the modal produces. On a clone, since it mutates.
    /// </summary>
    [Fact]
    public void Confirm_is_refused_for_anything_but_a_live_unconfirmed_match()
    {
        var set = Clone();
        var drafted = set.Matches.First(m => m.Status == MatchStatus.Drafted);
        var confirmed = set.Matches.First(m => m.Status == MatchStatus.Confirmed);
        var cancelled = set.Matches.First(m => m.Status == MatchStatus.Cancelled);

        Assert.Null(MatchWriter.RejectConfirm(drafted));

        MatchLifecycle.Notify(drafted);
        Assert.Null(MatchWriter.RejectConfirm(drafted));

        Assert.Equal(MatchLifecycle.OnlyALiveMatchCanBeConfirmed, MatchWriter.RejectConfirm(confirmed));
        Assert.Equal(MatchLifecycle.OnlyALiveMatchCanBeConfirmed, MatchWriter.RejectConfirm(cancelled));
        Assert.Equal(MatchWriter.NoSuchMatch, MatchWriter.RejectConfirm(null));
    }

    /// <summary>
    /// A notified match blocks its space's confirmation exactly as a draft does, and — the part worth
    /// testing — the sentence beside the disabled button now says so. It read "and no drafts" until
    /// Notified became reachable, which would have denied on screen what the gate was doing.
    /// </summary>
    [Fact]
    public void A_notified_match_blocks_its_spaces_confirmation_and_the_reason_says_so()
    {
        var set = Clone();

        // A Booked space, or the reason would be "already confirmed" / "this space is cancelled" and
        // the test would pass without ever reaching the clause it is about.
        var space = set.Spaces.First(s =>
            s.Status == ProcessorSpaceStatus.Booked &&
            set.Matches.Any(m => m.ProcessorSpaceId == s.Id && m.Status == MatchStatus.Drafted));

        // Every live match on the space, so the block that remains is Notified's alone and the old
        // wording would have been describing a state that no longer exists.
        foreach (var live in set.Matches.Where(m =>
            m.ProcessorSpaceId == space.Id && m.Status == MatchStatus.Drafted))
        {
            MatchLifecycle.Notify(live);
        }

        var reason = MatchWriter.RejectSpaceConfirm(set, space);

        Assert.Equal(ProcessorSpaceRules.NeedsConfirmedMatches, reason);
        Assert.DoesNotContain("draft", reason, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Cancel_is_for_matches_past_drafted_and_always_needs_a_reason()
    {
        var drafted = Seed.Matches.First(m => m.Status == MatchStatus.Drafted);
        var confirmed = Seed.Matches.First(m => m.Status == MatchStatus.Confirmed);
        var cancelled = Seed.Matches.First(m => m.Status == MatchStatus.Cancelled);
        var reason = MatchCancellationReason.ChangeFromProcessor;

        Assert.Null(MatchWriter.RejectCancel(confirmed, reason));

        // A mis-drag is deleted, and the two acts leave different records behind.
        Assert.Equal(
            MatchLifecycle.ADraftIsDeletedNotCancelled,
            MatchWriter.RejectCancel(drafted, reason));

        Assert.Equal(MatchLifecycle.AlreadyCancelled, MatchWriter.RejectCancel(cancelled, reason));
        Assert.Equal(MatchLifecycle.ReasonRequired, MatchWriter.RejectCancel(confirmed, reason: null));
        Assert.Equal(MatchWriter.NoSuchMatch, MatchWriter.RejectCancel(null, reason));
    }

    /// <summary>
    /// The rule most likely to be "helpfully" broken, proved at this layer as well as in the domain:
    /// cancelling a match writes to the match and to nothing else.
    /// </summary>
    [Fact]
    public void Cancelling_a_match_leaves_both_parent_records_untouched()
    {
        var set = Clone();
        var match = set.Matches.First(m => m.Status == MatchStatus.Confirmed);
        var space = set.Spaces.First(s => s.Id == match.ProcessorSpaceId);
        var availability = set.Availabilities.First(a => a.Id == match.LivestockAvailabilityId);

        var spaceStatus = space.Status;
        var availabilityStatus = availability.Status;
        var required = space.QuantityRequired;
        var available = availability.QuantityAvailable;

        RecordCancellation.CancelMatch(match, MatchCancellationReason.InternalDecisionByApg);

        Assert.Equal(spaceStatus, space.Status);
        Assert.Equal(availabilityStatus, availability.Status);
        Assert.Equal(required, space.QuantityRequired);
        Assert.Equal(available, availability.QuantityAvailable);
    }

    /// <summary>
    /// The same rule from the other end. The seed deliberately keeps a Cancelled space holding live
    /// matches for exactly this: cancelling a record does not cancel what it was matched to.
    /// </summary>
    [Fact]
    public void A_cancelled_space_still_carries_its_live_matches_through_the_projection()
    {
        var cancelled = Seed.Spaces
            .Where(s => s.Status == ProcessorSpaceStatus.Cancelled)
            .First(s => SeedFixture.MatchesForSpace(s.Id).Any(MatchQuantities.IsLive));

        var dto = MatchingProjection.SpaceById(Seed, cancelled.Id)!;

        Assert.Equal(ProcessorSpaceStatus.Cancelled, dto.Status);
        Assert.NotEmpty(dto.Matches);
        Assert.All(dto.Matches, m => Assert.NotEqual(MatchStatus.Cancelled, m.Status));

        // And it says so rather than greying Confirm out in silence.
        Assert.False(dto.CanConfirm);
        Assert.Equal(ProcessorSpaceRules.SpaceIsCancelled, dto.ConfirmBlockedReason);
    }

    /// <summary>
    /// Where a cancelled match goes, now that pass 1 has nowhere to show it: out of both parents'
    /// collections (resolved question 4) while both sums move. That is what makes it disappear from
    /// the matching screen, and why the operator is warned before doing it.
    /// </summary>
    [Fact]
    public void A_cancelled_match_leaves_both_collections_and_both_sums_move()
    {
        var set = Clone();
        var match = set.Matches.First(m => m.Status == MatchStatus.Confirmed);
        var quantity = match.QuantityMatched;

        var spaceBefore = MatchingProjection.SpaceById(set, match.ProcessorSpaceId)!;
        var availabilityBefore = MatchingProjection.AvailabilityById(set, match.LivestockAvailabilityId)!;

        RecordCancellation.CancelMatch(match, MatchCancellationReason.ChangeFromAgentOrFarmer);

        var spaceAfter = MatchingProjection.SpaceById(set, match.ProcessorSpaceId)!;
        var availabilityAfter = MatchingProjection.AvailabilityById(set, match.LivestockAvailabilityId)!;

        Assert.Contains(spaceBefore.Matches, m => m.Id == match.Id);
        Assert.DoesNotContain(spaceAfter.Matches, m => m.Id == match.Id);
        Assert.DoesNotContain(availabilityAfter.Matches, m => m.Id == match.Id);

        Assert.Equal(spaceBefore.MatchedInclDraft - quantity, spaceAfter.MatchedInclDraft);
        Assert.Equal(spaceBefore.MatchedExclDraft - quantity, spaceAfter.MatchedExclDraft);
        Assert.Equal(availabilityBefore.Unmatched + quantity, availabilityAfter.Unmatched);
    }

    /// <summary>
    /// Requirement 6.3: deleting a drafted match and cancelling one have the same numeric effect. The
    /// difference is only that the record is gone rather than retained with its reason.
    /// </summary>
    [Fact]
    public void Deleting_a_draft_and_cancelling_it_move_the_numbers_identically()
    {
        var deleted = Clone();
        var cancelledSet = Clone();

        var id = Seed.Matches.First(m => m.Status == MatchStatus.Drafted).Id;
        var target = deleted.Matches.First(m => m.Id == id);

        var afterDelete = MatchingProjection.SpaceById(
            deleted with { Matches = deleted.Matches.Where(m => m.Id != id).ToList() },
            target.ProcessorSpaceId)!;

        RecordCancellation.CancelMatch(
            cancelledSet.Matches.First(m => m.Id == id),
            MatchCancellationReason.InternalDecisionByApg);

        var afterCancel = MatchingProjection.SpaceById(cancelledSet, target.ProcessorSpaceId)!;

        Assert.Equal(afterDelete.MatchedInclDraft, afterCancel.MatchedInclDraft);
        Assert.Equal(afterDelete.MatchedExclDraft, afterCancel.MatchedExclDraft);
        Assert.Equal(afterDelete.Unmatched, afterCancel.Unmatched);
        Assert.Equal(afterDelete.Matches.Count, afterCancel.Matches.Count);
    }

    /// <summary>
    /// Requirement 4.4: confirming the last outstanding match on a fully matched record flips it to
    /// Confirmed. Derived from the match set on the way out, so the card shows it without a refetch.
    /// </summary>
    [Fact]
    public void Confirming_the_last_outstanding_match_flips_a_fully_matched_record()
    {
        var set = Clone();

        var availability = set.Availabilities.First(a =>
            MatchQuantities.ForAvailability(a, set.Matches, SeedFixture.Cancelled) is { Unmatched: 0 }
            && set.Matches.Any(m =>
                m.LivestockAvailabilityId == a.Id && m.Status == MatchStatus.Drafted));

        Assert.Equal(
            LivestockAvailabilityStatus.Pending,
            MatchingProjection.AvailabilityById(set, availability.Id)!.Status);

        foreach (var draft in set.Matches.Where(m =>
                     m.LivestockAvailabilityId == availability.Id
                     && m.Status == MatchStatus.Drafted))
        {
            MatchLifecycle.Confirm(draft);
        }

        Assert.Equal(
            LivestockAvailabilityStatus.Confirmed,
            MatchingProjection.AvailabilityById(set, availability.Id)!.Status);
    }

    // --- the modal's context --------------------------------------------------------------------

    [Fact]
    public void The_edit_context_carries_both_parents_and_the_ceiling()
    {
        var match = Seed.Matches.First(MatchQuantities.IsLive);
        var context = MatchWriter.EditContext(Seed, match.Id);

        Assert.NotNull(context);
        Assert.Equal(match.Id, context.Match.Id);
        Assert.Equal(match.ProcessorSpaceId, context.Space.Id);
        Assert.Equal(match.LivestockAvailabilityId, context.Availability.Id);
        Assert.Equal(MatchWriter.EditCeiling(Seed, match), context.MaximumQuantity);

        // Both parents whole, because the modal shows each one's own original quantity and unmatched
        // figure — and neither of those is on the match itself.
        Assert.Equal(
            Seed.Spaces.First(s => s.Id == match.ProcessorSpaceId).QuantityRequired,
            context.Space.QuantityRequired);

        Assert.Contains(context.Space.Matches, m => m.Id == match.Id);
        Assert.Contains(context.Availability.Matches, m => m.Id == match.Id);
    }

    /// <summary>
    /// The same id opens the same match whichever card it was reached from, because the context is
    /// fetched by match id and nothing else (requirement 1.2).
    /// </summary>
    [Fact]
    public void The_same_id_gives_the_same_match_whichever_card_it_came_from()
    {
        var match = Seed.Matches.First(MatchQuantities.IsLive);

        var fromSpace = MatchingProjection.SpaceById(Seed, match.ProcessorSpaceId)!
            .Matches.First(m => m.Id == match.Id);

        var fromAvailability = MatchingProjection.AvailabilityById(Seed, match.LivestockAvailabilityId)!
            .Matches.First(m => m.Id == match.Id);

        Assert.Equal(fromSpace, fromAvailability);
        Assert.Equal(fromSpace, MatchWriter.EditContext(Seed, fromAvailability.Id)!.Match);
    }

    [Fact]
    public void There_is_no_context_for_a_missing_or_cancelled_match()
    {
        var cancelled = Seed.Matches.First(m => m.Status == MatchStatus.Cancelled);

        Assert.Null(MatchWriter.EditContext(Seed, 0));

        // A cancelled match is on no card in pass 1, so there is nothing to open it from.
        Assert.Null(MatchWriter.EditContext(Seed, cancelled.Id));
    }

    // --- confirming a Processor Space ------------------------------------------------------------

    [Fact]
    public void A_space_the_domain_agrees_about_may_be_confirmed_and_others_are_told_why()
    {
        var confirmable = Seed.Spaces.First(s => ProcessorSpaceRules.CanConfirm(s, Seed.Matches, SeedFixture.Cancelled));
        var withDrafts = Seed.Spaces.First(s =>
            s.Status == ProcessorSpaceStatus.Booked
            && SeedFixture.MatchesForSpace(s.Id).Any(m => m.Status == MatchStatus.Drafted));

        Assert.Null(MatchWriter.RejectSpaceConfirm(Seed, confirmable));
        Assert.Equal(
            ProcessorSpaceRules.NeedsConfirmedMatches,
            MatchWriter.RejectSpaceConfirm(Seed, withDrafts));
        Assert.Equal(MatchWriter.NoSuchSpace, MatchWriter.RejectSpaceConfirm(Seed, space: null));
    }

    /// <summary>
    /// Confirming a space writes its stored status and touches no match — the mirror of the cancel
    /// case, and the reason there is no derivation on this side to overwrite what a human chose.
    /// </summary>
    [Fact]
    public void Confirming_a_space_changes_its_status_and_no_match()
    {
        var set = Clone();
        var space = set.Spaces.First(s => ProcessorSpaceRules.CanConfirm(s, set.Matches, SeedFixture.Cancelled));
        var before = set.Matches
            .Where(m => m.ProcessorSpaceId == space.Id)
            .Select(m => (m.Id, m.QuantityMatched, m.Status))
            .ToList();

        space.Status = ProcessorSpaceStatus.Confirmed;

        var dto = MatchingProjection.SpaceById(set, space.Id)!;

        Assert.Equal(ProcessorSpaceStatus.Confirmed, dto.Status);
        Assert.Equal(ProcessorSpaceRules.AlreadyConfirmed, dto.ConfirmBlockedReason);
        Assert.False(dto.CanConfirm);
        Assert.Equal(
            before,
            set.Matches
                .Where(m => m.ProcessorSpaceId == space.Id)
                .Select(m => (m.Id, m.QuantityMatched, m.Status))
                .ToList());
    }

    /// <summary>
    /// Every space in the seed answers the question, one way or the other. A card must never have a
    /// disabled Confirm button with nothing to print beside it.
    /// </summary>
    [Fact]
    public void Every_space_either_can_be_confirmed_or_says_why_not()
    {
        var spaces = MatchingProjection.ProcessorSpaces(Seed);

        foreach (var space in spaces)
        {
            Assert.Equal(space.CanConfirm, space.ConfirmBlockedReason is null);
        }

        Assert.Contains(spaces, s => s.ConfirmBlockedReason is not null);
    }

    // --- helpers ---------------------------------------------------------------------------------

    private static UpdateMatchRequest Update(int quantity) =>
        new()
        {
            QuantityMatched = quantity,
            PricePerKg = 6.10m,
            TransportCompany = " Kaikoura Carriers ",
        };

    /// <summary>The live match holding the largest share of its own availability record.</summary>
    private static (Match Match, LivestockAvailability Availability) MostOfItsRecordsSupply()
    {
        var candidates =
            from match in Seed.Matches
            where MatchQuantities.IsLive(match)
            join availability in Seed.Availabilities
                on match.LivestockAvailabilityId equals availability.Id
            orderby (double)match.QuantityMatched / availability.QuantityAvailable descending
            select (match, availability);

        return candidates.First();
    }

    /// <summary>True when raising this match to its ceiling would push its space past what it needs.</summary>
    private static bool CeilingExceedsDemand(WorkingSet set, Match match)
    {
        var space = set.Spaces.First(s => s.Id == match.ProcessorSpaceId);
        var others = MatchQuantities.ForSpace(space, set.Matches, SeedFixture.Cancelled).MatchedInclDraft - match.QuantityMatched;

        return others + MatchWriter.EditCeiling(set, match) > space.QuantityRequired;
    }

    /// <summary>
    /// A copy of the seed whose entities may be mutated without reaching the shared singleton every
    /// other test file reads. Reflective rather than hand-written so it cannot go stale when an entity
    /// gains a property — a copy that silently dropped a field would make these tests lie.
    /// </summary>
    private static WorkingSet Clone() => new(
        SeedFixture.Data.ProcessorSpaces.Select(Copy).ToList(),
        SeedFixture.Data.Availabilities.Select(Copy).ToList(),
        SeedFixture.Data.Matches.Select(Copy).ToList(),
        SeedFixture.Data.Locations,
        SeedFixture.Data.Farmers);

    private static T Copy<T>(T source)
    {
        var copy = (T)Activator.CreateInstance(typeof(T), nonPublic: true)!;

        foreach (var property in typeof(T).GetProperties(BindingFlags.Public | BindingFlags.Instance))
        {
            if (property is { CanRead: true, CanWrite: true })
            {
                property.SetValue(copy, property.GetValue(source));
            }
        }

        return copy;
    }
}
