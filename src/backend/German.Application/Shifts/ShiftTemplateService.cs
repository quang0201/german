using German.Application.Abstractions;
using German.Application.Common;
using German.Domain.Shifts;
using Microsoft.EntityFrameworkCore;

namespace German.Application.Shifts;

public sealed class ShiftTemplateService(IGermanDbContext db)
{
    public async Task<IReadOnlyList<ShiftTemplateDto>> ListAsync(CancellationToken cancellationToken)
    {
        var templates = await db.ShiftTemplates.AsNoTracking().OrderBy(x => x.Name).ToListAsync(cancellationToken);
        var templateIds = templates.Select(x => x.Id).ToArray();
        var periods = await db.ShiftPeriods.AsNoTracking()
            .Where(x => templateIds.Contains(x.ShiftTemplateId))
            .OrderBy(x => x.SortOrder)
            .ToListAsync(cancellationToken);

        return templates.Select(template => ToDto(template, periods.Where(x => x.ShiftTemplateId == template.Id))).ToList();
    }

    public async Task<AppResult<ShiftTemplateDto>> CreateAsync(CreateShiftTemplateCommand command, CancellationToken cancellationToken)
    {
        var validation = Validate(command.Name, command.Periods);
        if (!validation.IsSuccess)
        {
            return AppResult<ShiftTemplateDto>.Failure(validation.Error!.Code, validation.Error.Message);
        }

        var template = new ShiftTemplate { Name = command.Name.Trim() };
        foreach (var period in command.Periods.OrderBy(x => x.SortOrder))
        {
            template.Periods.Add(new ShiftPeriod
            {
                ShiftTemplateId = template.Id,
                Name = period.Name.Trim(),
                StartTime = period.StartTime,
                EndTime = period.EndTime,
                SortOrder = period.SortOrder
            });
        }

        db.ShiftTemplates.Add(template);
        await db.SaveChangesAsync(cancellationToken);
        return AppResult<ShiftTemplateDto>.Success(ToDto(template, template.Periods));
    }

    public async Task<AppResult<ShiftTemplateDto>> UpdateAsync(Guid id, UpdateShiftTemplateCommand command, CancellationToken cancellationToken)
    {
        var validation = Validate(command.Name, command.Periods);
        if (!validation.IsSuccess)
        {
            return AppResult<ShiftTemplateDto>.Failure(validation.Error!.Code, validation.Error.Message);
        }

        var template = await db.ShiftTemplates.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (template is null)
        {
            return AppResult<ShiftTemplateDto>.Failure("shift.not_found", "Không tìm thấy bộ ca.");
        }

        var oldPeriods = await db.ShiftPeriods.Where(x => x.ShiftTemplateId == id).ToListAsync(cancellationToken);
        db.ShiftPeriods.RemoveRange(oldPeriods);

        template.Name = command.Name.Trim();
        template.IsActive = command.IsActive;
        template.UpdatedAt = DateTimeOffset.UtcNow;
        var newPeriods = command.Periods.OrderBy(x => x.SortOrder).Select(period => new ShiftPeriod
        {
            ShiftTemplateId = template.Id,
            Name = period.Name.Trim(),
            StartTime = period.StartTime,
            EndTime = period.EndTime,
            SortOrder = period.SortOrder
        }).ToList();
        db.ShiftPeriods.AddRange(newPeriods);
        await db.SaveChangesAsync(cancellationToken);
        return AppResult<ShiftTemplateDto>.Success(ToDto(template, newPeriods));
    }

    private static AppResult Validate(string name, IReadOnlyList<ShiftPeriodInput> periods)
    {
        if (string.IsNullOrWhiteSpace(name) || periods.Count == 0)
        {
            return AppResult.Failure("shift.invalid_input", "Tên bộ ca và ít nhất một khung giờ là bắt buộc.");
        }

        var ordered = periods.OrderBy(x => x.StartTime).ToList();
        for (var index = 0; index < ordered.Count; index++)
        {
            var period = ordered[index];
            if (string.IsNullOrWhiteSpace(period.Name) || period.EndTime <= period.StartTime)
            {
                return AppResult.Failure("shift.invalid_period", "Khung giờ ca không hợp lệ.");
            }

            if (index > 0 && period.StartTime < ordered[index - 1].EndTime)
            {
                return AppResult.Failure("shift.overlap", "Các khung giờ HC không được chồng lên nhau.");
            }
        }

        return AppResult.Success();
    }

    private static ShiftTemplateDto ToDto(ShiftTemplate template, IEnumerable<ShiftPeriod> source)
    {
        var periods = source.OrderBy(x => x.SortOrder)
            .Select(x => new ShiftPeriodDto(x.Id, x.Name, x.StartTime, x.EndTime, x.SortOrder))
            .ToList();
        var totalHours = periods.Sum(x => (decimal)(x.EndTime - x.StartTime).TotalHours);
        return new ShiftTemplateDto(template.Id, template.Name, template.IsActive, totalHours, periods);
    }
}
