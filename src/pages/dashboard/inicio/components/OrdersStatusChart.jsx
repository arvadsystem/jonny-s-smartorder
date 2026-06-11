import React from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const tooltipStyle = {
  borderRadius: 14,
  border: '1px solid rgba(219, 202, 179, 0.9)',
  boxShadow: '0 14px 30px rgba(66, 40, 20, 0.12)'
};

const OrdersStatusChart = ({ data = [] }) => (
  <section className="inicio-panel inicio-panel--chart">
    <header className="inicio-panel__head">
      <h2>Estado de pedidos</h2>
      <p>Seguimiento rápido de pendientes, cocina y listos para entrega.</p>
    </header>

    <div className="inicio-chart-card">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(194, 177, 153, 0.35)" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: '#6f6258', fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fill: '#6f6258', fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: 'rgba(140, 86, 47, 0.08)' }}
            contentStyle={tooltipStyle}
            formatter={(value) => [`${value}`, 'Pedidos']}
          />
          <Bar dataKey="value" radius={[10, 10, 4, 4]}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  </section>
);

export default OrdersStatusChart;
