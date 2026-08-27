namespace Apg.Domain.Entities;

/// <summary>A farm. Seeded from Data/locations.csv and owned by exactly one farmer.</summary>
public class Location
{
    public int Id { get; set; }

    public required string Name { get; set; }
}
