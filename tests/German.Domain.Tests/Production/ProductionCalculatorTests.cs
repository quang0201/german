using German.Domain.Production;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace German.Domain.Tests.Production;

[TestClass]
public sealed class ProductionCalculatorTests
{
    [TestMethod]
    public void ByShift_WithoutOvertime_UsesShiftQuantitiesAsHc()
    {
        var result = ProductionCalculator.Calculate(new ProductionCalculationInput(
            ProductionEntryMode.ByShift,
            HcHours: 9m,
            Shift1Quantity: 280m,
            Shift2Quantity: 120m));

        Assert.AreEqual(400m, result.Hc);
        Assert.AreEqual(0m, result.Tc);
        Assert.AreEqual(400m, result.Total);
    }

    [TestMethod]
    public void ByShift_WithOvertimeHours_CalculatesTcFromConfiguredHcHours()
    {
        var result = ProductionCalculator.Calculate(new ProductionCalculationInput(
            ProductionEntryMode.ByShift,
            HcHours: 9m,
            Shift1Quantity: 310m,
            Shift2Quantity: 120m,
            OvertimeHours: 2m));

        Assert.AreEqual(430m, result.Hc);
        Assert.AreEqual(96m, result.Tc);
        Assert.AreEqual(526m, result.Total);
    }

    [TestMethod]
    public void ByShift_WithActualOvertimeQuantity_PrefersActualQuantity()
    {
        var result = ProductionCalculator.Calculate(new ProductionCalculationInput(
            ProductionEntryMode.ByShift,
            HcHours: 9m,
            Shift1Quantity: 310m,
            Shift2Quantity: 120m,
            OvertimeHours: 2m,
            OvertimeQuantity: 108m));

        Assert.AreEqual(430m, result.Hc);
        Assert.AreEqual(108m, result.Tc);
        Assert.AreEqual(538m, result.Total);
    }

    [TestMethod]
    public void Direct_PreservesEnteredHcAndTc()
    {
        var result = ProductionCalculator.Calculate(new ProductionCalculationInput(
            ProductionEntryMode.Direct,
            HcHours: 0m,
            DirectHcQuantity: 535m,
            DirectTcQuantity: 135m));

        Assert.AreEqual(535m, result.Hc);
        Assert.AreEqual(135m, result.Tc);
        Assert.AreEqual(670m, result.Total);
    }

    [TestMethod]
    public void TotalWithOvertime_SplitsTotalUsingConfiguredHcHours()
    {
        var result = ProductionCalculator.Calculate(new ProductionCalculationInput(
            ProductionEntryMode.TotalWithOvertime,
            HcHours: 8m,
            TotalQuantity: 620m,
            OvertimeHours: 1.5m));

        Assert.AreEqual(522m, result.Hc);
        Assert.AreEqual(98m, result.Tc);
        Assert.AreEqual(620m, result.Total);
    }

    [TestMethod]
    public void TotalWithOvertime_WithoutOvertime_UsesAllAsHc()
    {
        var result = ProductionCalculator.Calculate(new ProductionCalculationInput(
            ProductionEntryMode.TotalWithOvertime,
            HcHours: 0m,
            TotalQuantity: 400m));

        Assert.AreEqual(400m, result.Hc);
        Assert.AreEqual(0m, result.Tc);
    }

    [TestMethod]
    public void AutoCalculation_WithOvertimeAndZeroHcHours_Throws()
    {
        Assert.ThrowsExactly<ArgumentOutOfRangeException>(() =>
            ProductionCalculator.Calculate(new ProductionCalculationInput(
                ProductionEntryMode.TotalWithOvertime,
                HcHours: 0m,
                TotalQuantity: 400m,
                OvertimeHours: 2m)));
    }

    [TestMethod]
    public void NegativeQuantity_Throws()
    {
        Assert.ThrowsExactly<ArgumentOutOfRangeException>(() =>
            ProductionCalculator.Calculate(new ProductionCalculationInput(
                ProductionEntryMode.Direct,
                HcHours: 0m,
                DirectHcQuantity: -1m,
                DirectTcQuantity: 0m)));
    }
}
