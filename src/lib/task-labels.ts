export function addTaskLabel(current: string, label: string): string {
  const parts = current
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.includes(label)) return current;
  return [...parts, label].join(', ');
}

export function removeTaskLabel(current: string, label: string): string {
  const parts = current
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.filter((p) => p !== label).join(', ');
}
