using System.Globalization;
using System.Text;
using German.Application.Products;

namespace German.Api.Startup;

public static class BackfillReport
{
    public static string Format(BackfillPlan plan, bool apply)
    {
        var text = new StringBuilder();
        text.AppendLine(apply ? "=== Gom sản phẩm: GHI DỮ LIỆU (--apply) ===" : "=== Gom sản phẩm: XEM TRƯỚC (chưa ghi, thêm --apply để ghi) ===");
        text.AppendLine();
        text.AppendLine($"Sản phẩm sẽ tạo/gắn: {plan.Products.Count}");
        foreach (var product in plan.Products)
        {
            var numbers = string.Join(", ", product.Operations.Select(x => x.OperationNumber));
            text.AppendLine($"  {product.Code} · {product.Name} · CĐ {numbers}");
            foreach (var order in product.Orders)
            {
                text.AppendLine($"      - {order.Code}");
            }
        }

        text.AppendLine();
        text.AppendLine($"Mã bị bỏ sót (để trống sản phẩm, gán tay): {plan.Skipped.Count}");
        foreach (var skipped in plan.Skipped)
        {
            text.AppendLine($"  {skipped.Code}: {skipped.Reason}");
        }

        text.AppendLine();
        text.AppendLine($"CĐ có đơn giá khác nhau giữa các mã (vẫn gom, kiểm tra lại): {plan.PriceDifferences.Count}");
        foreach (var difference in plan.PriceDifferences)
        {
            var prices = string.Join("; ", difference.Prices.Select(x => $"{x.OrderCode} = {(x.Price?.ToString("0.##", CultureInfo.InvariantCulture) ?? "chưa có")}"));
            text.AppendLine($"  {difference.ProductCode} · CĐ{difference.OperationNumber}: {prices}");
        }

        return text.ToString();
    }
}
