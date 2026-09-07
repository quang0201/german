namespace German.Application.ProductionEntries;

internal static class ProductionMonthlyMatrixBuilder
{
    public static ProductionMonthlyMatrixResult Build(
        DateOnly fromDate,
        DateOnly untilDate,
        Guid? orderId,
        bool excludeSundays,
        IReadOnlyList<ProductionMonthlyMatrixRow> rows,
        IReadOnlyList<ProductionMonthlyMatrixRow> groupRows,
        IReadOnlySet<(Guid EmployeeId, DateOnly WorkDate)> workedDates,
        IReadOnlySet<(Guid EmployeeId, DateOnly WorkDate)> attendanceDates,
        IReadOnlySet<(Guid EmployeeId, DateOnly WorkDate)> paidLeaveDates)
    {
        var visible = excludeSundays
            ? rows.Where(row => row.WorkDate.DayOfWeek != DayOfWeek.Sunday).ToList()
            : rows.ToList();

        var visibleGroupRows = excludeSundays
            ? groupRows.Where(row => row.WorkDate.DayOfWeek != DayOfWeek.Sunday).ToList()
            : groupRows;

        var availableOrders = visibleGroupRows
            .GroupBy(row => (row.OrderId, row.OrderCode, row.ProductName))
            .OrderBy(group => group.Key.OrderCode)
            .Select(group => new ProductionMatrixOrderOptionDto(
                group.Key.OrderId, group.Key.OrderCode, group.Key.ProductName))
            .ToList();

        var scoped = orderId.HasValue
            ? visible.Where(row => row.OrderId == orderId.Value).ToList()
            : visible;

        var summary = new ProductionMonthlyMatrixSummary(
            scoped.Select(row => row.EmployeeId).Distinct().Count(),
            scoped.Count,
            scoped.Sum(row => row.HcQuantity),
            scoped.Sum(row => row.TcQuantity),
            scoped.Sum(row => row.TotalQuantity));

        var orders = visibleGroupRows
            .Where(row => !orderId.HasValue || row.OrderId == orderId.Value)
            .GroupBy(row => (row.OrderId, row.OrderCode, row.ProductName))
            .OrderBy(group => group.Key.OrderCode)
            .Select(group => BuildOrder(group, scoped, workedDates, attendanceDates, paidLeaveDates))
            .ToList();

        return new ProductionMonthlyMatrixResult(
            fromDate, untilDate, excludeSundays, summary, availableOrders, orders);
    }

    private static ProductionMatrixOrderBlockDto BuildOrder(
        IGrouping<(Guid OrderId, string OrderCode, string ProductName), ProductionMonthlyMatrixRow> group,
        IReadOnlyList<ProductionMonthlyMatrixRow> visibleRows,
        IReadOnlySet<(Guid EmployeeId, DateOnly WorkDate)> workedDates,
        IReadOnlySet<(Guid EmployeeId, DateOnly WorkDate)> attendanceDates,
        IReadOnlySet<(Guid EmployeeId, DateOnly WorkDate)> paidLeaveDates)
    {
        var employees = group
            .GroupBy(row => (row.EmployeeId, row.EmployeeCode, row.EmployeeName, row.EmployeeIsActive))
            .OrderBy(employeeGroup => employeeGroup.Key.EmployeeCode)
            .Select(employeeGroup => BuildEmployee(employeeGroup, visibleRows, workedDates, attendanceDates, paidLeaveDates))
            .ToList();
        return new ProductionMatrixOrderBlockDto(
            group.Key.OrderId, group.Key.OrderCode, group.Key.ProductName, employees);
    }

    private static ProductionMatrixEmployeeGroupDto BuildEmployee(
        IGrouping<(Guid EmployeeId, string EmployeeCode, string EmployeeName, bool EmployeeIsActive), ProductionMonthlyMatrixRow> group,
        IReadOnlyList<ProductionMonthlyMatrixRow> visibleRows,
        IReadOnlySet<(Guid EmployeeId, DateOnly WorkDate)> workedDates,
        IReadOnlySet<(Guid EmployeeId, DateOnly WorkDate)> attendanceDates,
        IReadOnlySet<(Guid EmployeeId, DateOnly WorkDate)> paidLeaveDates)
    {
        var operations = group
            .GroupBy(row => (row.OperationId, row.OperationNumber, row.OperationName))
            .OrderBy(operationGroup => operationGroup.Key.OperationNumber)
            .Select(operationGroup => BuildOperation(
                operationGroup,
                visibleRows.Where(row => row.EmployeeId == group.Key.EmployeeId
                    && row.OperationId == operationGroup.Key.OperationId)))
            .ToList();
        var productionDates = group
            .Where(row => row.Id != Guid.Empty)
            .Select(row => row.WorkDate)
            .Distinct()
            .OrderBy(date => date)
            .ToArray();
        var employeePaidLeaveDates = paidLeaveDates
            .Where(date => date.EmployeeId == group.Key.EmployeeId)
            .Select(date => date.WorkDate)
            .Distinct()
            .OrderBy(date => date)
            .ToArray();
        var employeeWorkedDates = workedDates
            .Where(date => date.EmployeeId == group.Key.EmployeeId)
            .Select(date => date.WorkDate)
            .Distinct()
            .OrderBy(date => date)
            .ToArray();
        var employeeAttendanceDates = attendanceDates
            .Where(date => date.EmployeeId == group.Key.EmployeeId)
            .Select(date => date.WorkDate)
            .Distinct()
            .OrderBy(date => date)
            .ToArray();

        return new ProductionMatrixEmployeeGroupDto(
            group.Key.EmployeeId, group.Key.EmployeeCode, group.Key.EmployeeName, group.Key.EmployeeIsActive, operations)
        {
            ProductionDates = productionDates,
            WorkedDates = employeeWorkedDates,
            AttendanceDates = employeeAttendanceDates,
            PaidLeaveDates = employeePaidLeaveDates
        };
    }

    private static ProductionMatrixOperationRowDto BuildOperation(
        IGrouping<(Guid OperationId, int OperationNumber, string OperationName), ProductionMonthlyMatrixRow> group,
        IEnumerable<ProductionMonthlyMatrixRow> visibleRows)
    {
        var rows = visibleRows.ToList();
        var cells = rows
            .GroupBy(row => row.WorkDate)
            .OrderBy(cellGroup => cellGroup.Key)
            .Select(cellGroup => new ProductionMatrixCellDto(
                cellGroup.Key,
                cellGroup.Sum(row => row.HcQuantity),
                cellGroup.Sum(row => row.TcQuantity),
                cellGroup.Sum(row => row.TotalQuantity),
                cellGroup.Count(),
                cellGroup.OrderBy(row => row.CreatedAt).ThenBy(row => row.Id)
                    .Select(row => new ProductionMatrixRecordDto(
                        row.Id, row.Version, row.EntryMode,
                        row.HcQuantity, row.TcQuantity, row.TotalQuantity, row.Note))
                    .ToList()))
            .ToList();
        return new ProductionMatrixOperationRowDto(
            group.Key.OperationId, group.Key.OperationNumber, group.Key.OperationName,
            rows.Sum(row => row.HcQuantity),
            rows.Sum(row => row.TcQuantity),
            rows.Sum(row => row.TotalQuantity),
            cells);
    }
}
