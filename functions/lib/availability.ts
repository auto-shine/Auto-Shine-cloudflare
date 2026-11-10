export const BUFFER_MS = 60 * 60 * 1000;

export function conflictsWithBusy(start: number, end: number, events: Array<{ start: string; end: string }>) {
  return events.some((event) => start < Date.parse(event.end) + BUFFER_MS && end > Date.parse(event.start) - BUFFER_MS);
}
