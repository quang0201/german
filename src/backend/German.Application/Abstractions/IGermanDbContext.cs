using German.Domain.Auditing;
using German.Domain.Attendance;
using German.Domain.Auth;
using German.Domain.Employees;
using German.Domain.Production;
using German.Domain.Shifts;
using Microsoft.EntityFrameworkCore;

namespace German.Application.Abstractions;

public interface IGermanDbContext
{
    DbSet<Employee> Employees { get; }
    DbSet<UserAccount> UserAccounts { get; }
    DbSet<ShiftTemplate> ShiftTemplates { get; }
    DbSet<ShiftPeriod> ShiftPeriods { get; }
    DbSet<EmployeeShiftAssignment> EmployeeShiftAssignments { get; }
    DbSet<ProductionOrder> ProductionOrders { get; }
    DbSet<ProductionOperation> ProductionOperations { get; }
    DbSet<ProductionEntry> ProductionEntries { get; }
    DbSet<AuditLog> AuditLogs { get; }
    DbSet<AttendanceDay> AttendanceDays { get; }
    DbSet<AttendanceShiftEntry> AttendanceShiftEntries { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
