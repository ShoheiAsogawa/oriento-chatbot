const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function nextMaintenanceTime(now = Date.now()) {
  const jst = new Date(now + JST_OFFSET_MS);
  let next = Date.UTC(
    jst.getUTCFullYear(),
    jst.getUTCMonth(),
    jst.getUTCDate(),
    3 - 9,
    17,
  );
  if (next <= now + 60_000) {
    next = Date.UTC(
      jst.getUTCFullYear(),
      jst.getUTCMonth(),
      jst.getUTCDate() + 1,
      3 - 9,
      17,
    );
  }
  return next;
}

export function isMonthlyMaintenance(scheduledTime: number) {
  return new Date(scheduledTime + JST_OFFSET_MS).getUTCDate() === 2;
}

export function previousJapanMonth(scheduledTime: number) {
  const jst = new Date(scheduledTime + JST_OFFSET_MS);
  return new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
}
