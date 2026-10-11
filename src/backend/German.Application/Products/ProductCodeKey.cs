using System.Text.RegularExpressions;

namespace German.Application.Products;

public static partial class ProductCodeKey
{
    /// <summary>
    /// The base number of a production code: the first standalone run of three or more digits
    /// ("4004 xanh" and "TÚI 4004 đỏ" both give "4004"). A code without one stands alone and is its own key.
    /// </summary>
    public static string BaseOf(string orderCode)
    {
        var trimmed = (orderCode ?? string.Empty).Trim();
        var match = StandaloneNumber().Match(trimmed);
        return match.Success ? match.Value : trimmed.ToUpperInvariant();
    }

    [GeneratedRegex(@"(?<![\p{L}\p{N}])\d{3,}(?![\p{L}\p{N}])")]
    private static partial Regex StandaloneNumber();
}
