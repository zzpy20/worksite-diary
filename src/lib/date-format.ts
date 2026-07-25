export function formatDateDisplay(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function formatTimeDisplay(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function parseTimeString(s: string): Date | null {
  const match = s.trim().match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const isPM = match[3].toLowerCase() === 'pm';
  if (hours === 12) hours = 0;
  if (isPM) hours += 12;
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d;
}

/** Hours between two "h:mm AM/PM" strings, treating a negative span as crossing midnight. */
export function hoursBetween(start: string | null, finish: string | null): number {
  if (!start || !finish) return 0;
  const startDate = parseTimeString(start);
  const finishDate = parseTimeString(finish);
  if (!startDate || !finishDate) return 0;
  let minutes = (finishDate.getTime() - startDate.getTime()) / 60000;
  if (minutes < 0) minutes += 24 * 60;
  return minutes / 60;
}

export function startOfWeek(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  return date;
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function formatSavedAt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
