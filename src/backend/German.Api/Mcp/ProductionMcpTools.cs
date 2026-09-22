using System.ComponentModel;
using German.Api.Auth;
using German.Application.Common;
using German.Application.Employees;
using German.Application.Lookups;
using German.Application.ProductionEntries;
using German.Application.ProductionOrders;
using German.Application.Reports;
using German.Domain.Production;
using ModelContextProtocol.Server;

namespace German.Api.Mcp;

[McpServerToolType]
public sealed class ProductionMcpTools(
    EmployeeService employeeService,
    LookupService lookupService,
    ProductionOrderService productionOrderService,
    ProductionReportService productionReportService,
    ProductionExternalQuantityService externalQuantityService,
    ProductionEntryService productionEntryService,
    IHttpContextAccessor httpContextAccessor,
    ILogger<ProductionMcpTools> logger)
{
    [McpServerTool(Name = "find_employees", ReadOnly = true, Idempotent = true)]
    [Description("Tìm nhân viên theo mã hoặc họ tên. Chỉ trả về nhân sự được phép sử dụng trong dữ liệu nội bộ.")]
    public async Task<McpToolResponse<IReadOnlyList<EmployeeLookupResult>>> FindEmployees(
        [Description("Từ khóa mã hoặc họ tên; để trống để lấy toàn bộ nhân viên.")] string? search,
        CancellationToken cancellationToken)
    {
        LogInvocation(nameof(FindEmployees));
        var employees = await employeeService.ListAsync(cancellationToken);
        var keyword = search?.Trim();
        if (!string.IsNullOrWhiteSpace(keyword))
        {
            employees = employees
                .Where(employee => employee.EmployeeCode.Contains(keyword, StringComparison.OrdinalIgnoreCase)
                    || employee.FullName.Contains(keyword, StringComparison.OrdinalIgnoreCase))
                .ToList();
        }

        return McpToolResponse<IReadOnlyList<EmployeeLookupResult>>.Success(employees
            .Select(employee => new EmployeeLookupResult(
                employee.Id,
                employee.EmployeeCode,
                employee.FullName,
                employee.IsActive,
                employee.CompensationType.ToString(),
                employee.DateOfBirth))
            .ToArray());
    }

    [McpServerTool(Name = "list_production_orders", ReadOnly = true, Idempotent = true)]
    [Description("Liệt kê toàn bộ mã sản xuất và các công đoạn đã cấu hình.")]
    public async Task<McpToolResponse<IReadOnlyList<ProductionOrderLookupResult>>> ListProductionOrders(
        CancellationToken cancellationToken)
    {
        LogInvocation(nameof(ListProductionOrders));
        var orders = await productionOrderService.ListAsync(cancellationToken);
        return McpToolResponse<IReadOnlyList<ProductionOrderLookupResult>>.Success(orders
            .Select(order => new ProductionOrderLookupResult(
                order.Id,
                order.Code,
                order.ProductName,
                order.PlannedQuantity,
                order.Status.ToString(),
                order.Operations.Select(operation => new ProductionOperationLookupResult(
                    operation.Id,
                    operation.OperationNumber,
                    operation.Name,
                    operation.Unit,
                    operation.IsActive)).ToArray()))
            .ToArray());
    }

    [McpServerTool(Name = "list_production_operations", ReadOnly = true, Idempotent = true)]
    [Description("Liệt kê các công đoạn đang hoạt động của một mã sản xuất.")]
    public async Task<McpToolResponse<IReadOnlyList<ProductionOperationLookupResult>>> ListProductionOperations(
        [Description("ID mã sản xuất.")] Guid orderId,
        CancellationToken cancellationToken)
    {
        LogInvocation(nameof(ListProductionOperations), orderId);
        var operations = await lookupService.ListActiveOperationsAsync(orderId, cancellationToken);
        return McpToolResponse<IReadOnlyList<ProductionOperationLookupResult>>.Success(operations
            .Select(operation => new ProductionOperationLookupResult(
                operation.Id,
                operation.OperationNumber,
                operation.Name,
                operation.Unit,
                true))
            .ToArray());
    }

    [McpServerTool(Name = "get_production_summary", ReadOnly = true, Idempotent = true)]
    [Description("Lấy tổng sản lượng theo công đoạn, nhân viên và ngày trong khoảng thời gian yêu cầu.")]
    public async Task<McpToolResponse<ProductionOperationSummaryReport>> GetProductionSummary(
        [Description("ID mã sản xuất.")] Guid orderId,
        [Description("Ngày bắt đầu, định dạng yyyy-MM-dd.")] string? fromDate,
        [Description("Ngày kết thúc, định dạng yyyy-MM-dd.")] string? untilDate,
        CancellationToken cancellationToken)
    {
        if (!TryParseRange(fromDate, untilDate, out var from, out var until, out var error))
        {
            return McpToolResponse<ProductionOperationSummaryReport>.Failure("invalid_date", error!);
        }

        LogInvocation(nameof(GetProductionSummary), orderId, from, until);
        var result = await productionReportService.BuildOperationSummaryAsync(orderId, from, until, cancellationToken);
        return result.IsSuccess
            ? McpToolResponse<ProductionOperationSummaryReport>.Success(result.Value!)
            : McpToolResponse<ProductionOperationSummaryReport>.Failure(result.Error!.Code, result.Error.Message);
    }

    [McpServerTool(Name = "list_external_quantities", ReadOnly = true, Idempotent = true)]
    [Description("Liệt kê sản lượng gia công ngoài theo mã sản xuất, công đoạn và khoảng ngày.")]
    public async Task<McpToolResponse<IReadOnlyList<ProductionExternalQuantityDto>>> ListExternalQuantities(
        [Description("ID mã sản xuất.")] Guid orderId,
        [Description("ID công đoạn, nếu muốn lọc theo công đoạn.")] Guid? operationId,
        [Description("Ngày bắt đầu, định dạng yyyy-MM-dd.")] string? fromDate,
        [Description("Ngày kết thúc, định dạng yyyy-MM-dd.")] string? untilDate,
        CancellationToken cancellationToken)
    {
        if (!TryParseRange(fromDate, untilDate, out var from, out var until, out var error))
        {
            return McpToolResponse<IReadOnlyList<ProductionExternalQuantityDto>>.Failure("invalid_date", error!);
        }

        LogInvocation(nameof(ListExternalQuantities), orderId, from, until);
        var result = await externalQuantityService.ListAsync(orderId, operationId, from, until, cancellationToken);
        return result.IsSuccess
            ? McpToolResponse<IReadOnlyList<ProductionExternalQuantityDto>>.Success(result.Value!)
            : McpToolResponse<IReadOnlyList<ProductionExternalQuantityDto>>.Failure(result.Error!.Code, result.Error.Message);
    }

    [McpServerTool(Name = "preview_production_entry", ReadOnly = true, Idempotent = true)]
    [Description("Tính thử HC, TC và tổng sản lượng trước khi ghi nhận. Tool này không thay đổi dữ liệu.")]
    public async Task<McpToolResponse<ProductionEntryPreviewDto>> PreviewProductionEntry(
        McpProductionEntryInput input,
        CancellationToken cancellationToken)
    {
        if (!TryBuildCommand(input, out var command, out var error))
        {
            return McpToolResponse<ProductionEntryPreviewDto>.Failure("invalid_input", error!);
        }

        LogInvocation(nameof(PreviewProductionEntry), input.ProductionOrderId, requestId: input.RequestId);
        var result = await productionEntryService.PreviewAsync(GetActor(), command!, cancellationToken);
        return result.IsSuccess
            ? McpToolResponse<ProductionEntryPreviewDto>.Success(result.Value!)
            : McpToolResponse<ProductionEntryPreviewDto>.Failure(result.Error!.Code, result.Error.Message);
    }

    [McpServerTool(Name = "create_production_entry", Destructive = true, Idempotent = false)]
    [Description("Ghi nhận sản lượng nội bộ sau khi đã preview. Bắt buộc confirm=true và requestId để truy vết audit.")]
    public async Task<McpToolResponse<ProductionEntryDto>> CreateProductionEntry(
        McpProductionEntryInput input,
        [Description("Phải là true để cho phép ghi dữ liệu.")] bool confirm,
        CancellationToken cancellationToken)
    {
        if (!confirm)
        {
            return McpToolResponse<ProductionEntryDto>.Failure(
                "confirmation_required",
                "Cần gọi preview trước, sau đó gửi lại với confirm=true.");
        }

        if (string.IsNullOrWhiteSpace(input.RequestId) || input.RequestId.Trim().Length > 100)
        {
            return McpToolResponse<ProductionEntryDto>.Failure(
                "request_id_required",
                "requestId là bắt buộc và tối đa 100 ký tự.");
        }

        if (!TryBuildCommand(input, out var command, out var error))
        {
            return McpToolResponse<ProductionEntryDto>.Failure("invalid_input", error!);
        }

        LogInvocation(nameof(CreateProductionEntry), input.ProductionOrderId, requestId: input.RequestId);
        var result = await productionEntryService.CreateAsync(GetActor(), command!, cancellationToken);
        return result.IsSuccess
            ? McpToolResponse<ProductionEntryDto>.Success(result.Value!)
            : McpToolResponse<ProductionEntryDto>.Failure(result.Error!.Code, result.Error.Message);
    }

    [McpServerTool(Name = "create_external_quantity", Destructive = true, Idempotent = false)]
    [Description("Ghi nhận sản lượng gia công ngoài sau khi đã xác nhận. Bắt buộc confirm=true và requestId để truy vết.")]
    public async Task<McpToolResponse<ProductionExternalQuantityDto>> CreateExternalQuantity(
        McpExternalQuantityInput input,
        [Description("Phải là true để cho phép ghi dữ liệu.")] bool confirm,
        CancellationToken cancellationToken)
    {
        if (!confirm)
        {
            return McpToolResponse<ProductionExternalQuantityDto>.Failure(
                "confirmation_required",
                "Cần kiểm tra dữ liệu trước, sau đó gửi lại với confirm=true.");
        }

        if (string.IsNullOrWhiteSpace(input.RequestId) || input.RequestId.Trim().Length > 100)
        {
            return McpToolResponse<ProductionExternalQuantityDto>.Failure(
                "request_id_required",
                "requestId là bắt buộc và tối đa 100 ký tự.");
        }

        if (!DateOnly.TryParseExact(input.ReceivedDate, "yyyy-MM-dd", out var receivedDate))
        {
            return McpToolResponse<ProductionExternalQuantityDto>.Failure(
                "invalid_input",
                "receivedDate phải có định dạng yyyy-MM-dd.");
        }

        LogInvocation(nameof(CreateExternalQuantity), input.ProductionOrderId, requestId: input.RequestId);
        var result = await externalQuantityService.CreateAsync(
            GetActor(),
            new CreateProductionExternalQuantityCommand(
                input.ProductionOrderId,
                input.ProductionOperationId,
                receivedDate,
                input.Quantity,
                input.SourceName,
                input.Note,
                input.ExternalSourceId),
            cancellationToken);
        return result.IsSuccess
            ? McpToolResponse<ProductionExternalQuantityDto>.Success(result.Value!)
            : McpToolResponse<ProductionExternalQuantityDto>.Failure(result.Error!.Code, result.Error.Message);
    }

    private CurrentActor GetActor() => httpContextAccessor.HttpContext!.User.ToCurrentActor();

    private void LogInvocation(
        string tool,
        Guid? orderId = null,
        DateOnly? from = null,
        DateOnly? until = null,
        string? requestId = null)
    {
        var userId = httpContextAccessor.HttpContext?.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        logger.LogInformation(
            "MCP tool invoked. Tool={Tool} UserId={UserId} OrderId={OrderId} FromDate={FromDate} UntilDate={UntilDate} RequestId={RequestId}",
            tool,
            userId,
            orderId,
            from,
            until,
            requestId);
    }

    private static bool TryBuildCommand(
        McpProductionEntryInput input,
        out CreateProductionEntryCommand? command,
        out string? error)
    {
        command = null;
        error = null;
        if (!DateOnly.TryParseExact(input.WorkDate, "yyyy-MM-dd", out var workDate))
        {
            error = "workDate phải có định dạng yyyy-MM-dd.";
            return false;
        }

        if (!Enum.TryParse<ProductionEntryMode>(input.EntryMode, true, out var entryMode))
        {
            error = "entryMode phải là ByShift, Direct hoặc TotalWithOvertime.";
            return false;
        }

        if (!TryParseTime(input.WorkStart, out var workStart) || !TryParseTime(input.WorkEnd, out var workEnd))
        {
            error = "workStart/workEnd phải có định dạng HH:mm hoặc HH:mm:ss.";
            return false;
        }

        command = new CreateProductionEntryCommand(
            workDate,
            input.EmployeeId,
            input.ProductionOrderId,
            input.ProductionOperationId,
            entryMode,
            input.Shift1Quantity,
            input.Shift2Quantity,
            input.DirectHcQuantity,
            input.DirectTcQuantity,
            input.TotalInputQuantity,
            input.OvertimeHours,
            input.OvertimeQuantity,
            workStart,
            workEnd,
            input.Note,
            input.ExpectedEmpty,
            input.HcHours);
        return true;
    }

    private static bool TryParseTime(string? value, out TimeOnly? parsed)
    {
        parsed = null;
        if (string.IsNullOrWhiteSpace(value)) return true;
        if (!TimeOnly.TryParseExact(value, "HH:mm", out var shortTime)
            && !TimeOnly.TryParseExact(value, "HH:mm:ss", out shortTime)) return false;
        parsed = shortTime;
        return true;
    }

    private static bool TryParseRange(
        string? fromText,
        string? untilText,
        out DateOnly? from,
        out DateOnly? until,
        out string? error)
    {
        from = null;
        until = null;
        error = null;
        if (!string.IsNullOrWhiteSpace(fromText)
            && !DateOnly.TryParseExact(fromText, "yyyy-MM-dd", out var parsedFrom))
        {
            error = "fromDate phải có định dạng yyyy-MM-dd.";
            return false;
        }

        if (!string.IsNullOrWhiteSpace(untilText)
            && !DateOnly.TryParseExact(untilText, "yyyy-MM-dd", out var parsedUntil))
        {
            error = "untilDate phải có định dạng yyyy-MM-dd.";
            return false;
        }

        if (!string.IsNullOrWhiteSpace(fromText)) from = DateOnly.ParseExact(fromText, "yyyy-MM-dd");
        if (!string.IsNullOrWhiteSpace(untilText)) until = DateOnly.ParseExact(untilText, "yyyy-MM-dd");
        if (from.HasValue && until.HasValue && from > until)
        {
            error = "fromDate phải nhỏ hơn hoặc bằng untilDate.";
            return false;
        }

        return true;
    }
}

public sealed record McpToolResponse<T>(bool Ok, string? Code, string? Message, T? Data)
{
    public static McpToolResponse<T> Success(T data) => new(true, null, null, data);

    public static McpToolResponse<T> Failure(string code, string message) => new(false, code, message, default);
}

public sealed record EmployeeLookupResult(
    Guid Id,
    string EmployeeCode,
    string FullName,
    bool IsActive,
    string CompensationType,
    DateOnly? DateOfBirth);

public sealed record ProductionOrderLookupResult(
    Guid Id,
    string Code,
    string ProductName,
    decimal PlannedQuantity,
    string Status,
    IReadOnlyList<ProductionOperationLookupResult> Operations);

public sealed record ProductionOperationLookupResult(
    Guid Id,
    int OperationNumber,
    string Name,
    string Unit,
    bool IsActive);

public sealed record McpProductionEntryInput(
    string RequestId,
    string WorkDate,
    Guid EmployeeId,
    Guid ProductionOrderId,
    Guid ProductionOperationId,
    string EntryMode,
    decimal? Shift1Quantity = null,
    decimal? Shift2Quantity = null,
    decimal? DirectHcQuantity = null,
    decimal? DirectTcQuantity = null,
    decimal? TotalInputQuantity = null,
    decimal? OvertimeHours = null,
    decimal? OvertimeQuantity = null,
    string? WorkStart = null,
    string? WorkEnd = null,
    string? Note = null,
    bool ExpectedEmpty = false,
    decimal? HcHours = null);

public sealed record McpExternalQuantityInput(
    string RequestId,
    Guid ProductionOrderId,
    Guid ProductionOperationId,
    string ReceivedDate,
    decimal Quantity,
    string? SourceName = null,
    string? Note = null,
    Guid? ExternalSourceId = null);
