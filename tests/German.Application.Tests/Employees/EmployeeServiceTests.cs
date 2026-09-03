using German.Application.Employees;
using German.Domain.Employees;
using German.Domain.Shifts;
using German.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace German.Application.Tests.Employees;

[TestClass]
public sealed class EmployeeServiceTests
{
    [TestMethod]
    public async Task CreateAsyncWithShiftCreatesEmployeeAndEffectiveAssignment()
    {
        await using var db = CreateDb();
        var shift = new ShiftTemplate { Name = "Ca hành chính", IsActive = true };
        db.ShiftTemplates.Add(shift);
        await db.SaveChangesAsync();

        var effectiveFrom = new DateOnly(2026, 8, 17);
        var result = await new EmployeeService(db).CreateAsync(
            new CreateEmployeeCommand("E001", "Nguyễn Văn An", shift.Id, effectiveFrom),
            CancellationToken.None);

        Assert.IsTrue(result.IsSuccess);
        var employee = await db.Employees.SingleAsync();
        var assignment = await db.EmployeeShiftAssignments.SingleAsync();
        Assert.AreEqual("E001", employee.EmployeeCode);
        Assert.AreEqual(shift.Id, assignment.ShiftTemplateId);
        Assert.AreEqual(effectiveFrom, assignment.EffectiveFrom);
    }

    [TestMethod]
    public async Task CreateAsyncRejectsMissingShiftBeforeCreatingEmployee()
    {
        await using var db = CreateDb();

        var result = await new EmployeeService(db).CreateAsync(
            new CreateEmployeeCommand("E002", "Nguyễn Văn B", Guid.NewGuid(), new DateOnly(2026, 8, 17)),
            CancellationToken.None);

        Assert.IsFalse(result.IsSuccess);
        Assert.AreEqual("shift.not_found", result.Error?.Code);
        Assert.AreEqual(0, await db.Employees.CountAsync());
    }

    [TestMethod]
    public async Task CreateAsyncRejectsMissingShiftAssignment()
    {
        await using var db = CreateDb();

        var result = await new EmployeeService(db).CreateAsync(
            new CreateEmployeeCommand("E003", "Nguyễn Văn C"),
            CancellationToken.None);

        Assert.IsFalse(result.IsSuccess);
        Assert.AreEqual("shift.effective_from_required", result.Error?.Code);
        Assert.AreEqual(0, await db.Employees.CountAsync());
    }

    [TestMethod]
    public async Task ListAsyncReturnsShiftAssignmentActiveOnRequestedDate()
    {
        await using var db = CreateDb();
        var employee = new Employee { EmployeeCode = "E010", FullName = "Nguyễn Văn E" };
        var previousShift = new ShiftTemplate { Name = "Ca cũ", IsActive = true };
        var currentShift = new ShiftTemplate { Name = "Ca hiện tại", IsActive = true };
        db.AddRange(employee, previousShift, currentShift);
        db.EmployeeShiftAssignments.AddRange(
            new EmployeeShiftAssignment
            {
                EmployeeId = employee.Id,
                ShiftTemplateId = previousShift.Id,
                EffectiveFrom = new DateOnly(2026, 8, 1),
                EffectiveTo = new DateOnly(2026, 8, 19)
            },
            new EmployeeShiftAssignment
            {
                EmployeeId = employee.Id,
                ShiftTemplateId = currentShift.Id,
                EffectiveFrom = new DateOnly(2026, 8, 20)
            });
        await db.SaveChangesAsync();

        var rows = await new EmployeeService(db).ListAsync(
            CancellationToken.None,
            new DateOnly(2026, 8, 28));

        var row = rows.Single();
        Assert.AreEqual(currentShift.Id, row.CurrentShiftTemplateId);
        Assert.AreEqual("Ca hiện tại", row.CurrentShiftTemplateName);
        Assert.AreEqual(new DateOnly(2026, 8, 20), row.CurrentShiftEffectiveFrom);
    }

    [TestMethod]
    public async Task ListAsyncDoesNotTreatFutureAssignmentAsCurrent()
    {
        await using var db = CreateDb();
        var employee = new Employee { EmployeeCode = "E011", FullName = "Nguyễn Văn F" };
        var futureShift = new ShiftTemplate { Name = "Ca tương lai", IsActive = true };
        db.AddRange(employee, futureShift);
        db.EmployeeShiftAssignments.Add(new EmployeeShiftAssignment
        {
            EmployeeId = employee.Id,
            ShiftTemplateId = futureShift.Id,
            EffectiveFrom = new DateOnly(2026, 9, 1)
        });
        await db.SaveChangesAsync();

        var rows = await new EmployeeService(db).ListAsync(
            CancellationToken.None,
            new DateOnly(2026, 8, 28));

        var row = rows.Single();
        Assert.IsNull(row.CurrentShiftTemplateId);
        Assert.IsNull(row.CurrentShiftTemplateName);
        Assert.IsNull(row.CurrentShiftEffectiveFrom);
    }

    [TestMethod]
    public async Task DeleteAsyncDeactivatesEmployeeAndKeepsHistory()
    {
        await using var db = CreateDb();
        var employee = new Employee { EmployeeCode = "E004", FullName = "Nguyễn Văn D" };
        db.Employees.Add(employee);
        await db.SaveChangesAsync();

        var result = await new EmployeeService(db).DeleteAsync(employee.Id, CancellationToken.None);

        Assert.IsTrue(result.IsSuccess);
        var deactivated = await db.Employees.SingleAsync();
        Assert.IsFalse(deactivated.IsActive);
        Assert.AreEqual(DateOnly.FromDateTime(DateTime.Today), deactivated.DeactivatedAt);
    }

    [TestMethod]
    public async Task UpdateAsyncTracksDeactivationAndClearsItWhenReactivated()
    {
        await using var db = CreateDb();
        var employee = new Employee { EmployeeCode = "E012", FullName = "Nguyễn Văn G" };
        db.Employees.Add(employee);
        await db.SaveChangesAsync();
        var service = new EmployeeService(db);

        var deactivate = await service.UpdateAsync(
            employee.Id,
            new UpdateEmployeeCommand("E012", "Nguyễn Văn G", false),
            CancellationToken.None);

        Assert.IsTrue(deactivate.IsSuccess, deactivate.Error?.Message);
        Assert.AreEqual(DateOnly.FromDateTime(DateTime.Today), (await db.Employees.SingleAsync()).DeactivatedAt);

        var reactivate = await service.UpdateAsync(
            employee.Id,
            new UpdateEmployeeCommand("E012", "Nguyễn Văn G", true),
            CancellationToken.None);

        Assert.IsTrue(reactivate.IsSuccess, reactivate.Error?.Message);
        var restored = await db.Employees.SingleAsync();
        Assert.IsTrue(restored.IsActive);
        Assert.IsNull(restored.DeactivatedAt);
    }

    [TestMethod]
    public async Task DeleteAsyncDoesNotInventDeactivationDateForLegacyInactiveEmployee()
    {
        await using var db = CreateDb();
        var employee = new Employee
        {
            EmployeeCode = "E013",
            FullName = "Nhân viên cũ",
            IsActive = false,
            DeactivatedAt = null
        };
        db.Employees.Add(employee);
        await db.SaveChangesAsync();

        var result = await new EmployeeService(db).DeleteAsync(employee.Id, CancellationToken.None);

        Assert.IsTrue(result.IsSuccess);
        var unchanged = await db.Employees.SingleAsync();
        Assert.IsFalse(unchanged.IsActive);
        Assert.IsNull(unchanged.DeactivatedAt);
    }

    [TestMethod]
    public async Task AssignShiftRejectsInactiveEmployee()
    {
        await using var db = CreateDb();
        var employee = new Employee { EmployeeCode = "E005", FullName = "Đã nghỉ", IsActive = false };
        var shift = new ShiftTemplate { Name = "Ca hành chính", IsActive = true };
        db.AddRange(employee, shift);
        await db.SaveChangesAsync();

        var result = await new EmployeeService(db).AssignShiftAsync(
            employee.Id,
            new AssignShiftCommand(shift.Id, new DateOnly(2026, 8, 21)),
            CancellationToken.None);

        Assert.IsFalse(result.IsSuccess);
        Assert.AreEqual("employee.inactive", result.Error?.Code);
        Assert.AreEqual(0, await db.EmployeeShiftAssignments.CountAsync());
    }

    private static GermanDbContext CreateDb() => new(
        new DbContextOptionsBuilder<GermanDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);
}
