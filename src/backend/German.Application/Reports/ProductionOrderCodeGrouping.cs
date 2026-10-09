using System.Text.RegularExpressions;

namespace German.Application.Reports;

/// <summary>
/// Groups colour/variant production codes ("4004 xanh", "4004 đen", "TÚI 4004 đỏ") under their shared base number ("4004").
/// The base number is the first standalone run of at least three digits; codes without one keep their own value.
/// </summary>
public static partial class ProductionOrderCodeGrouping
{
    [GeneratedRegex(@"(?<![\p{L}\p{N}])\d{3,}(?![\p{L}\p{N}])")]
    private static partial Regex BaseNumberPattern();

    public static string BaseCode(string? code)
    {
        var value = (code ?? string.Empty).Trim();
        var match = BaseNumberPattern().Match(value);
        return match.Success ? match.Value : value;
    }

    public static IReadOnlyList<ProductionReportRow> MergeVariants(IReadOnlyList<ProductionReportRow> rows)
    {
        var namesByBase = rows
            .GroupBy(row => BaseCode(row.ProductionOrderCode), StringComparer.Ordinal)
            .ToDictionary(
                group => group.Key,
                group =>
                {
                    var names = group
                        .Select(row => row.ProductName?.Trim() ?? string.Empty)
                        .Where(name => name.Length > 0)
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .OrderBy(name => name, StringComparer.Ordinal)
                        .ToArray();
                    return string.Join(" / ", names);
                },
                StringComparer.Ordinal);

        return rows
            .Select(row =>
            {
                var baseCode = BaseCode(row.ProductionOrderCode);
                return row with { ProductionOrderCode = baseCode, ProductName = namesByBase[baseCode] };
            })
            .OrderBy(row => row.WorkDate)
            .ThenBy(row => row.EmployeeCode, StringComparer.Ordinal)
            .ThenBy(row => row.ProductionOrderCode, StringComparer.Ordinal)
            .ThenBy(row => row.OperationNumber)
            .ToList();
    }
}
