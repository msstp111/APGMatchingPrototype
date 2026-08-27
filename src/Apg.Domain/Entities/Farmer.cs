namespace Apg.Domain.Entities;

/// <summary>
/// Each location belongs to exactly one farmer (resolved question 10), so picking the location on an
/// availability record determines the farmer and their contact details.
/// </summary>
public class Farmer
{
    public int Id { get; set; }

    public int LocationId { get; set; }

    public required string Name { get; set; }

    public required string Mobile { get; set; }
}
