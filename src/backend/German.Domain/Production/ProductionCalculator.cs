namespace German.Domain.Production;

public static class ProductionCalculator
{
    public static ProductionCalculationResult Calculate(ProductionCalculationInput input)
    {
        ArgumentNullException.ThrowIfNull(input);
        ValidateNonNegative(input.HcHours, nameof(input.HcHours));
        ValidateOptionalNonNegative(input.Shift1Quantity, nameof(input.Shift1Quantity));
        ValidateOptionalNonNegative(input.Shift2Quantity, nameof(input.Shift2Quantity));
        ValidateOptionalNonNegative(input.DirectHcQuantity, nameof(input.DirectHcQuantity));
        ValidateOptionalNonNegative(input.DirectTcQuantity, nameof(input.DirectTcQuantity));
        ValidateOptionalNonNegative(input.TotalQuantity, nameof(input.TotalQuantity));
        ValidateOptionalNonNegative(input.OvertimeHours, nameof(input.OvertimeHours));
        ValidateOptionalNonNegative(input.OvertimeQuantity, nameof(input.OvertimeQuantity));

        return input.Mode switch
        {
            ProductionEntryMode.ByShift => CalculateByShift(input),
            ProductionEntryMode.Direct => CalculateDirect(input),
            ProductionEntryMode.TotalWithOvertime => CalculateTotalWithOvertime(input),
            _ => throw new ArgumentOutOfRangeException(nameof(input.Mode), input.Mode, "Unsupported production entry mode.")
        };
    }

    private static ProductionCalculationResult CalculateByShift(ProductionCalculationInput input)
    {
        var hc = (input.Shift1Quantity ?? 0m) + (input.Shift2Quantity ?? 0m);
        decimal tc;

        if (input.OvertimeQuantity.HasValue)
        {
            tc = input.OvertimeQuantity.Value;
        }
        else if ((input.OvertimeHours ?? 0m) > 0m)
        {
            EnsureHcHours(input.HcHours);
            tc = RoundQuantity(hc / input.HcHours * input.OvertimeHours!.Value);
        }
        else
        {
            tc = 0m;
        }

        return new ProductionCalculationResult(hc, tc, hc + tc);
    }

    private static ProductionCalculationResult CalculateDirect(ProductionCalculationInput input)
    {
        var hc = input.DirectHcQuantity ?? 0m;
        var tc = input.DirectTcQuantity ?? 0m;
        return new ProductionCalculationResult(hc, tc, hc + tc);
    }

    private static ProductionCalculationResult CalculateTotalWithOvertime(ProductionCalculationInput input)
    {
        var total = input.TotalQuantity ?? 0m;
        var overtimeHours = input.OvertimeHours ?? 0m;

        if (overtimeHours <= 0m)
        {
            return new ProductionCalculationResult(total, 0m, total);
        }

        EnsureHcHours(input.HcHours);
        var hc = RoundQuantity(total * input.HcHours / (input.HcHours + overtimeHours));
        var tc = total - hc;
        return new ProductionCalculationResult(hc, tc, total);
    }

    private static decimal RoundQuantity(decimal value) =>
        decimal.Round(value, 0, MidpointRounding.AwayFromZero);

    private static void EnsureHcHours(decimal hcHours)
    {
        if (hcHours <= 0m)
        {
            throw new ArgumentOutOfRangeException(nameof(hcHours), "Configured HC hours must be greater than zero when overtime is auto-calculated.");
        }
    }

    private static void ValidateOptionalNonNegative(decimal? value, string parameterName)
    {
        if (value.HasValue)
        {
            ValidateNonNegative(value.Value, parameterName);
        }
    }

    private static void ValidateNonNegative(decimal value, string parameterName)
    {
        if (value < 0m)
        {
            throw new ArgumentOutOfRangeException(parameterName, "Value cannot be negative.");
        }
    }
}
