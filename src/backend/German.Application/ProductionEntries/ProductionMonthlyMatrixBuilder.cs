namespace German.Application.ProductionEntries;

internal static class ProductionMonthlyMatrixBuilder
{
    public static ProductionMonthlyMatrixResult Build(
        DateOnly fromDate,
        DateOnly untilDate,
        ProductionMonthlyMatrixQuery request,
        IReadOnlyList<ProductionMonthlyMatrixRow> rows)
    {
        var visible = request.ExcludeSundays
            ? rows.Where(row => row.WorkDate.DayOfWeek != DayOfWeek.Sunday).ToList()
            : rows.ToList();

        var availableOrders = visible
            .GroupBy(row => (row.OrderId, row.OrderCode, row.ProductName))
            .OrderBy(group => group.Key.OrderCode)
            .Select(group => new ProductionMatrixOrderOptionDto(
                group.Key.OrderId, group.Key.OrderCode, group.Key.ProductName))
            .ToList();

        var scoped = request.OrderId.HasValue
            ? visible.Where(row => row.OrderId == request.OrderId.Value).ToList()
            : visible;

        var summary = new ProductionMonthlyMatrixSummary(
            scoped.Select(row => row.EmployeeId).Distinct().Count(),
            scoped.Count,
            scoped.Sum(row => row.HcQuantity),
            scoped.Sum(row => row.TcQuantity),
            scoped.Sum(row => row.TotalQuantity));

        var orders = scoped
            .GroupBy(row => (row.OrderId, row.OrderCode, row.ProductName))
            .OrderBy(group => group.Key.OrderCode)
            .Select(BuildOrder)
            .ToList();

        return new ProductionMonthlyMatrixResult(
            fromDate, untilDate, request.ExcludeSundays, summary, availableOrders, orders);
    }

    private static ProductionMatrixOrderBlockDto BuildOrder(
        IGrouping<(Guid OrderId, string OrderCode, string ProductName), ProductionMonthlyMatrixRow> group)
    {
        var employees = group
            .GroupBy(row => (row.EmployeeId, row.EmployeeCode, row.EmployeeName, row.EmployeeIsActive))
            .OrderBy(employeeGroup => employeeGroup.Key.EmployeeCode)
            .Select(BuildEmployee)
            .ToList();
        return new ProductionMatrixOrderBlockDto(
            group.Key.OrderId, group.Key.OrderCode, group.Key.ProductName, employees);
    }

    private static ProductionMatrixEmployeeGroupDto BuildEmployee(
        IGrouping<(Guid EmployeeId, string EmployeeCode, string EmployeeName, bool EmployeeIsActive), ProductionMonthlyMatrixRow> group)
    {
        var operations = group
            .GroupBy(row => (row.OperationId, row.OperationNumber, row.OperationName))
            .OrderBy(operationGroup => operationGroup.Key.OperationNumber)
            .Select(BuildOperation)
            .ToList();
        return new ProductionMatrixEmployeeGroupDto(
            group.Key.EmployeeId, group.Key.EmployeeCode, group.Key.EmployeeName, group.Key.EmployeeIsActive, operations);
    }

    private static ProductionMatrixOperationRowDto BuildOperation(
        IGrouping<(Guid OperationId, int OperationNumber, string OperationName), ProductionMonthlyMatrixRow> group)
    {
        var cells = group
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
            group.Sum(row => row.HcQuantity),
            group.Sum(row => row.TcQuantity),
            group.Sum(row => row.TotalQuantity),
            cells);
    }
}
