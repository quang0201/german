using German.Domain.Common;

namespace German.Domain.Production;

public sealed class ProductionEntry : Entity
{
    public DateOnly WorkDate { get; set; }
    public Guid EmployeeId { get; set; }
    public Guid ProductionOrderId { get; set; }
    public Guid ProductionOperationId { get; set; }
    public ProductionEntryMode EntryMode { get; set; }

    public decimal? Shift1Quantity { get; set; }
    public decimal? Shift2Quantity { get; set; }
    public decimal? DirectHcQuantity { get; set; }
    public decimal? DirectTcQuantity { get; set; }
    public decimal? TotalInputQuantity { get; set; }
    public decimal? OvertimeHours { get; set; }
    public decimal? OvertimeQuantity { get; set; }

    public TimeOnly? WorkStart { get; set; }
    public TimeOnly? WorkEnd { get; set; }

    public decimal HcQuantity { get; set; }
    public decimal TcQuantity { get; set; }
    public decimal TotalQuantity { get; set; }

    public string? Note { get; set; }
    public Guid SubmittedByUserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedByUserId { get; set; }
    public int Version { get; set; } = 1;
}
