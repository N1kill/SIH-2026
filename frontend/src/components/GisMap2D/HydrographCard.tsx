import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  type Plugin,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import type { FloodProgressionData } from '../../types/simulation';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler);

interface HydrographCardProps {
  floodData: FloodProgressionData;
  currentTime: number;
}

export const HydrographCard: React.FC<HydrographCardProps> = ({ floodData, currentTime }) => {
  const { labels, data } = useMemo(() => {
    return {
      labels: floodData.steps.map((step) => step.time_hours),
      data: floodData.steps.map((step) => step.discharge_m3s),
    };
  }, [floodData]);

  // Current Q calculation
  let currentQ = data[0] ?? 0;
  for (let i = 0; i < labels.length - 1; i++) {
    if (currentTime >= labels[i] && currentTime <= labels[i + 1]) {
      const frac = (currentTime - labels[i]) / (labels[i + 1] - labels[i]);
      currentQ = Math.round(data[i] + frac * (data[i + 1] - data[i]));
      break;
    }
  }
  if (labels.length && currentTime >= labels[labels.length - 1]) currentQ = data[data.length - 1];

  // Scrubber vertical line plugin
  const scrubberPlugin: Plugin<'line'> = {
    id: 'scrubberPlugin',
    afterDraw: (chart) => {
      const ctx = chart.ctx;
      const xAxis = chart.scales.x;
      const yAxis = chart.scales.y;

      const xPixel = xAxis.getPixelForValue(currentTime);
      if (xPixel < xAxis.left || xPixel > xAxis.right) return;

      ctx.save();
      // Scrubber line
      ctx.beginPath();
      ctx.moveTo(xPixel, yAxis.top);
      ctx.lineTo(xPixel, yAxis.bottom);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#38bdf8';
      ctx.shadowColor = 'rgba(56, 189, 248, 0.8)';
      ctx.shadowBlur = 6;
      ctx.stroke();

      // Time Tag
      const label = `T+${currentTime.toFixed(1)}hr`;
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      const textWidth = ctx.measureText(label).width;

      ctx.fillStyle = '#0284c7';
      ctx.fillRect(xPixel - textWidth / 2 - 4, yAxis.bottom - 16, textWidth + 8, 14);

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, xPixel, yAxis.bottom - 9);

      ctx.restore();
    },
  };

  const chartData = {
    datasets: [
      {
        data: labels.map((x, index) => ({ x, y: data[index] })),
        borderColor: '#0284c7',
        borderWidth: 2,
        backgroundColor: 'rgba(2, 132, 199, 0.18)',
        fill: true,
        tension: 0.35,
        pointRadius: 0,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: { parsed: { y: number | null } }) =>
            ` ${(ctx.parsed.y ?? 0).toLocaleString()} m³/s`,
        },
      },
    },
    scales: {
      x: {
        type: 'linear' as const,
        min: 0,
        max: floodData.max_time_hours,
        title: {
          display: true,
          text: 'Time',
          color: '#94a3b8',
          font: { size: 9, family: 'Inter' },
        },
        ticks: {
          font: { size: 8, family: 'JetBrains Mono' },
          color: '#64748b',
          maxTicksLimit: 5,
          callback: (value: string | number) => `${Number(value).toFixed(1)}h`,
        },
        grid: { color: 'rgba(255, 255, 255, 0.04)' },
      },
      y: {
        min: 0,
        suggestedMax: Math.max(...data, 1) * 1.1,
        title: {
          display: true,
          text: 'Discharge (m³/s)',
          color: '#94a3b8',
          font: { size: 9, family: 'Inter' },
        },
        ticks: {
          stepSize: 1000,
          font: { size: 8, family: 'JetBrains Mono' },
          color: '#64748b',
        },
        grid: { color: 'rgba(255, 255, 255, 0.04)' },
      },
    },
  };

  return (
    <div className="hud-card" id="card-hydrograph">
      <div className="card-header">
        <div className="card-title">Hydrograph</div>
        <span className="source-tag" style={{ color: '#38bdf8' }}>{currentQ.toLocaleString()} m³/s</span>
      </div>
      <div className="hydrograph-box">
        <Line data={chartData} options={options} plugins={[scrubberPlugin]} />
      </div>
    </div>
  );
};
