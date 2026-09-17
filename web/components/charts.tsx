'use client';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const COLORS = ['var(--brand)', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9', '#64748b'];

export function AttendanceTrend({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--brand)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--brand)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => d.slice(5)} />
        <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} unit="%" />
        <Tooltip />
        <Area
          type="monotone"
          dataKey="rate"
          name="Attendance %"
          stroke="var(--brand)"
          fill="url(#g1)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
export function BarSeries({
  data,
  x,
  bars,
  height = 220,
  stacked,
}: {
  data: any[];
  x: string;
  bars: Array<{ key: string; name?: string; color?: string }>;
  height?: number;
  stacked?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey={x} tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {bars.map((b, i) => (
          <Bar
            key={b.key}
            dataKey={b.key}
            name={b.name ?? b.key}
            fill={b.color ?? COLORS[i % COLORS.length]}
            radius={[4, 4, 0, 0]}
            stackId={stacked ? 'a' : undefined}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
export function LineSeries({
  data,
  x,
  lines,
  height = 220,
}: {
  data: any[];
  x: string;
  lines: Array<{ key: string; name?: string; color?: string }>;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey={x} tick={{ fontSize: 11 }} tickFormatter={(d) => String(d).slice(5)} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        {lines.map((l, i) => (
          <Line
            key={l.key}
            type="monotone"
            dataKey={l.key}
            name={l.name ?? l.key}
            stroke={l.color ?? COLORS[i % COLORS.length]}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
export function Donut({ data, height = 200 }: { data: Array<{ name: string; value: number }>; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
