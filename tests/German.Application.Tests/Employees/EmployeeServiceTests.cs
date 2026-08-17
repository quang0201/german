using German.Application.Employees;
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
    public async Task DeleteAsyncDeactivatesEmployeeAndKeepsHistory()
    {
        await using var db = CreateDb();
        var employee = new Employee { EmployeeCode = "E004", FullName = "Nguyễn Văn D" };
        db.Employees.Add(employee);
        await db.SaveChangesAsync();

        var result = await new EmployeeService(db).DeleteAsync(employee.Id, CancellationToken.None);

        Assert.IsTrue(result.IsSuccess);
        Assert.IsFalse((await db.Employees.SingleAsync()).IsActive);
    }

    private static GermanDbContext CreateDb() => new(
        new DbContextOptionsBuilder<GermanDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);
}
