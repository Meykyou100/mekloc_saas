import Card from './Card';

export function BarChart({
  title,
  data,
  suffix = '',
}: {
  title: string;
  data: { label: string; value: number }[];
  suffix?: string;
}) {
  const max = Math.max(...data.map((item) => item.value));

  return (
    <Card className="p-5">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="font-semibold text-[var(--app-text)]">{title}</h3>
        <span className="rounded-full border border-gold-300/20 bg-[var(--app-gold-soft)] px-3 py-1 text-xs font-semibold text-[var(--app-gold-text)]">
          Live
        </span>
      </div>
      <div className="flex h-64 items-end gap-3">
        {data.map((item) => (
          <div key={item.label} className="flex flex-1 flex-col items-center gap-3">
            <div className="flex h-48 w-full items-end rounded-t-xl bg-[var(--app-surface-soft)] p-1">
              <div
                className="w-full rounded-t-lg bg-gradient-to-t from-gold-600 via-gold-400 to-gold-200 shadow-gold transition-all duration-500"
                style={{ height: `${Math.max(8, (item.value / max) * 100)}%` }}
                title={`${item.value}${suffix}`}
              />
            </div>
            <span className="text-xs text-[var(--app-text-muted)]">{item.label}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function DonutChart({
  title,
  data,
}: {
  title: string;
  data: { label: string; value: number }[];
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let start = 0;
  const gradient = data
    .map((item, index) => {
      const color = ['#f7bd13', '#2dd4a3', '#38bdf8', '#a78bfa'][index % 4];
      const end = start + (item.value / total) * 100;
      const segment = `${color} ${start}% ${end}%`;
      start = end;
      return segment;
    })
    .join(', ');

  return (
    <Card className="p-5">
      <h3 className="font-semibold text-[var(--app-text)]">{title}</h3>
      <div className="mt-6 grid gap-6 sm:grid-cols-[180px_1fr] sm:items-center">
        <div
          className="mx-auto h-44 w-44 rounded-full p-5"
          style={{ background: `conic-gradient(${gradient})` }}
        >
          <div className="grid h-full w-full place-items-center rounded-full bg-[var(--app-card)] text-center">
            <div>
              <p className="text-3xl font-bold text-[var(--app-text)]">{total}%</p>
              <p className="text-xs text-[var(--app-text-muted)]">channels</p>
            </div>
          </div>
        </div>
        <div className="grid gap-3">
          {data.map((item, index) => (
            <div key={item.label} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-[var(--app-text-soft)]">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: ['#f7bd13', '#2dd4a3', '#38bdf8', '#a78bfa'][index % 4] }}
                />
                {item.label}
              </span>
              <strong className="text-[var(--app-text)]">{item.value}%</strong>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
