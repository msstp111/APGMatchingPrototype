namespace Apg.Domain.Entities;

/// <summary>
/// Explicit, APG-driven match lifecycle. Pass 1 uses Drafted -> Confirmed plus Cancelled;
/// <see cref="Notified"/> is deliberately retained but unreachable (resolved question 2) so the
/// status logic never needs reshaping when notifications arrive.
/// </summary>
public enum MatchStatus
{
    Drafted,
    Notified,
    Confirmed,
    Cancelled,
}

/// <summary>
/// Note the deliberate absence of Pending (resolved question 6): a space with only drafted matches
/// stays Booked and so remains inside the matching screen's default filter.
/// </summary>
public enum ProcessorSpaceStatus
{
    Booked,
    Confirmed,
    Cancelled,
}

/// <summary>
/// Largely derived from the record's matches; only Cancelled is set explicitly. The derivation
/// itself is Phase 1's work and lives nowhere else.
/// </summary>
public enum LivestockAvailabilityStatus
{
    Booked,
    Pending,
    Confirmed,
    Cancelled,
}

public enum MatchCancellationReason
{
    ChangeFromAgentOrFarmer,
    ChangeFromProcessor,
    InternalDecisionByApg,
}

public enum TransactionType
{
    FinanceStock,
    GrazingStock,
    Other,
}
