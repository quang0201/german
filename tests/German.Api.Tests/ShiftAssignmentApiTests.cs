using System.Net;
using System.Net.Http.Json;
using German.Application.Auth;
using German.Domain.Auth;
using German.Domain.Employees;
using German.Domain.Shifts;
using German.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace German.Api.Tests;

[TestClass]
public sealed class ShiftAssignmentApiTests
{
    [TestMethod]
    public async Task AssignShift_BeforeFutureAssignment_EndsNewAssignmentBeforeFutureStart()
    {
        await using var factory = new GermanApiFactory();
        Guid employeeId = Guid.Empty;
        Guid shiftAId = Guid.Empty;

        await factory.SeedAsync(async services =>
        {
            var db = services.GetRequiredService<GermanDbContext>();
            var passwordService = services.GetRequiredService<IPasswordService>();

            var managerEmployee = new Employee { EmployeeCode = "M010", FullName = "Manager" };
            var manager = new UserAccount
            {
                Username = "manager-shift",
                NormalizedUsername = "MANAGER-SHIFT",
                Role = UserRole.Manager,
                EmployeeId = managerEmployee.Id
            };
            manager.PasswordHash = passwordService.HashPassword(manager, "manager-secret");

            var worker = new Employee { EmployeeCode = "E500", FullName = "Worker" };
            var shiftA = new ShiftTemplate { Name = "Ca A" };
            var shiftB = new ShiftTemplate { Name = "Ca B" };
            db.AddRange(managerEmployee, manager, worker, shiftA, shiftB);
            db.EmployeeShiftAssignments.Add(new EmployeeShiftAssignment
            {
                EmployeeId = worker.Id,
                ShiftTemplateId = shiftB.Id,
                EffectiveFrom = new DateOnly(2026, 9, 1)
            });

            employeeId = worker.Id;
            shiftAId = shiftA.Id;
            await db.SaveChangesAsync();
        });

        using var client = factory.CreateClient(new() { HandleCookies = true });
        var login = await client.PostAsJsonAsync("/api/auth/login", new
        {
            identifier = "manager-shift",
            password = "manager-secret"
        });
        Assert.AreEqual(HttpStatusCode.OK, login.StatusCode);

        var response = await client.PostAsJsonAsync($"/api/employees/{employeeId}/shift-assignments", new
        {
            shiftTemplateId = shiftAId,
            effectiveFrom = "2026-08-15"
        });
        Assert.AreEqual(HttpStatusCode.Created, response.StatusCode);

        await factory.SeedAsync(async services =>
        {
            var db = services.GetRequiredService<GermanDbContext>();
            var assignments = await db.EmployeeShiftAssignments.AsNoTracking()
                .Where(x => x.EmployeeId == employeeId)
                .OrderBy(x => x.EffectiveFrom)
                .ToListAsync();

            Assert.AreEqual(2, assignments.Count);
            Assert.AreEqual(new DateOnly(2026, 8, 31), assignments[0].EffectiveTo);
            Assert.AreEqual(new DateOnly(2026, 9, 1), assignments[1].EffectiveFrom);
        });
    }
}
