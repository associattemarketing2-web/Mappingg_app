// Day / time choices for forms (the app has no native date picker): the same
// values the website's <input type="date"> / "datetime-local" send.

export const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Today and the next `count - 1` days as { value: YYYY-MM-DD, label: "Sat, 25 Oct" }. */
export function dayOptions(count: number, from = new Date()): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
    const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    out.push({ value: isoDay(d), label });
  }
  return out;
}

/** Times of day every 30 minutes, 08:00 … 21:30, as { value: HH:MM, label: "9:30 AM" }. */
export const TIME_OPTIONS = Array.from({ length: 28 }, (_, i) => {
  const h = 8 + Math.floor(i / 2);
  const m = i % 2 ? 30 : 0;
  const value = `${String(h).padStart(2, '0')}:${m ? '30' : '00'}`;
  const label = `${h % 12 || 12}:${m ? '30' : '00'} ${h < 12 ? 'AM' : 'PM'}`;
  return { value, label };
});

/** Months from this one back `count - 1` months as { value: YYYY-MM, label: "Oct 2026" }. */
export function monthOptions(count: number, from = new Date()): { value: string; label: string }[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(from.getFullYear(), from.getMonth() - i, 1);
    return { value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) };
  });
}

/** Local day + HH:MM → ISO timestamp (null when either is missing). */
export function localToIso(day: string, time: string): string | null {
  if (!day || !time) return null;
  const d = new Date(`${day}T${time}:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** ISO timestamp → local { day, time } (time rounded down to the half hour). */
export function isoToLocal(iso?: string | null): { day: string; time: string } {
  if (!iso) return { day: '', time: '' };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { day: '', time: '' };
  return { day: isoDay(d), time: `${String(d.getHours()).padStart(2, '0')}:${d.getMinutes() >= 30 ? '30' : '00'}` };
}
