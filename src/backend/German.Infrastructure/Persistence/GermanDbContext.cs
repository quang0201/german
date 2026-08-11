using German.Application.Abstractions;
using German.Domain.Auditing;
using German.Domain.Auth;
using German.Domain.Employees;
using German.Domain.Production;
using German.Domain.Shifts;
using Microsoft.EntityFrameworkCore;

namespace German.Infrastructure.Persistence;

public sealed class GermanDbContext(DbContextOptions<GermanDbContext> options)
    : DbContext(options), IGermanDbContext
{
    public DbSet<Employee> Employees => Set<Employee>();
    public DbSet<UserAccount> UserAccounts => Set<UserAccount>();
    public DbSet<ShiftTemplate> ShiftTemplates => Set<ShiftTemplate>();
    public DbSet<ShiftPeriod> ShiftPeriods => Set<ShiftPeriod>();
    public DbSet<EmployeeShiftAssignment> EmployeeShiftAssignments => Set<EmployeeShiftAssignment>();
    public DbSet<ProductionOrder> ProductionOrders => Set<ProductionOrder>();
    public DbSet<ProductionOperation> ProductionOperations => Set<ProductionOperation>();
    public DbSet<ProductionEntry> ProductionEntries => Set<ProductionEntry>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Employee>(builder =>
        {
            builder.Property(x => x.EmployeeCode).HasMaxLength(64).IsRequired();
            builder.Property(x => x.FullName).HasMaxLength(200).IsRequired();
            builder.HasIndex(x => x.EmployeeCode).IsUnique();
        });

        modelBuilder.Entity<UserAccount>(builder =>
        {
            builder.Property(x => x.Username).HasMaxLength(100).IsRequired();
            builder.Property(x => x.NormalizedUsername).HasMaxLength(100).IsRequired();
            builder.Property(x => x.PasswordHash).HasMaxLength(1000).IsRequired();
            builder.HasIndex(x => x.NormalizedUsername).IsUnique();
            builder.HasIndex(x => x.EmployeeId).IsUnique();
        });

        modelBuilder.Entity<ShiftTemplate>(builder =>
        {
            builder.Property(x => x.Name).HasMaxLength(150).IsRequired();
            builder.HasMany(x => x.Periods)
                .WithOne()
                .HasForeignKey(x => x.ShiftTemplateId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ShiftPeriod>(builder =>
        {
            builder.Property(x => x.Name).HasMaxLength(100).IsRequired();
            builder.HasIndex(x => new { x.ShiftTemplateId, x.SortOrder });
        });

        modelBuilder.Entity<EmployeeShiftAssignment>(builder =>
        {
            builder.HasIndex(x => new { x.EmployeeId, x.EffectiveFrom });
        });

        modelBuilder.Entity<ProductionOrder>(builder =>
        {
            builder.Property(x => x.Code).HasMaxLength(100).IsRequired();
            builder.Property(x => x.ProductName).HasMaxLength(250).IsRequired();
            builder.Property(x => x.PlannedQuantity).HasPrecision(18, 2);
            builder.HasIndex(x => x.Code).IsUnique();
            builder.HasMany(x => x.Operations)
                .WithOne()
                .HasForeignKey(x => x.ProductionOrderId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ProductionOperation>(builder =>
        {
            builder.Property(x => x.Name).HasMaxLength(300).IsRequired();
            builder.Property(x => x.Unit).HasMaxLength(50).IsRequired();
            builder.HasIndex(x => new { x.ProductionOrderId, x.OperationNumber }).IsUnique();
        });

        modelBuilder.Entity<ProductionEntry>(builder =>
        {
            builder.Property(x => x.Shift1Quantity).HasPrecision(18, 2);
            builder.Property(x => x.Shift2Quantity).HasPrecision(18, 2);
            builder.Property(x => x.DirectHcQuantity).HasPrecision(18, 2);
            builder.Property(x => x.DirectTcQuantity).HasPrecision(18, 2);
            builder.Property(x => x.TotalInputQuantity).HasPrecision(18, 2);
            builder.Property(x => x.OvertimeHours).HasPrecision(8, 2);
            builder.Property(x => x.OvertimeQuantity).HasPrecision(18, 2);
            builder.Property(x => x.HcQuantity).HasPrecision(18, 2);
            builder.Property(x => x.TcQuantity).HasPrecision(18, 2);
            builder.Property(x => x.TotalQuantity).HasPrecision(18, 2);
            builder.Property(x => x.Note).HasMaxLength(1000);
            builder.Property(x => x.Version).IsConcurrencyToken();
            builder.HasIndex(x => new { x.WorkDate, x.EmployeeId });
            builder.HasQueryFilter(x => !x.IsDeleted);
        });

        modelBuilder.Entity<AuditLog>(builder =>
        {
            builder.Property(x => x.EntityType).HasMaxLength(150).IsRequired();
            builder.Property(x => x.BeforeJson).HasColumnType("jsonb");
            builder.Property(x => x.AfterJson).HasColumnType("jsonb");
            builder.HasIndex(x => new { x.EntityType, x.EntityId, x.PerformedAt });
        });
    }
}
