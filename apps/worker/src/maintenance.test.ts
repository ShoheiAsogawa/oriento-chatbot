import { describe, expect, it } from 'vitest';
import { isMonthlyMaintenance, nextMaintenanceTime, previousJapanMonth } from './maintenance-schedule';

describe('maintenance scheduling', () => {
  it('schedules 03:17 JST on the same day when it is still ahead', () => {
    const now = Date.parse('2026-08-09T02:00:00+09:00');
    expect(new Date(nextMaintenanceTime(now)).toISOString()).toBe('2026-08-08T18:17:00.000Z');
  });

  it('schedules the following day after the daily run time', () => {
    const now = Date.parse('2026-08-09T03:30:00+09:00');
    expect(new Date(nextMaintenanceTime(now)).toISOString()).toBe('2026-08-09T18:17:00.000Z');
  });

  it('generates the monthly report on day two in Japan', () => {
    expect(isMonthlyMaintenance(Date.parse('2026-08-01T18:17:00Z'))).toBe(true);
    expect(isMonthlyMaintenance(Date.parse('2026-08-02T18:17:00Z'))).toBe(false);
    expect(previousJapanMonth(Date.parse('2026-08-01T18:17:00Z'))).toBe('2026-07');
  });
});
