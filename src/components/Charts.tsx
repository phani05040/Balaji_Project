import React from 'react';
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const FONT_FAMILY = "'DM Sans', system-ui, sans-serif";

export const AgroBarChart: React.FC<{
  labels: string[];
  values: number[];
  datasetLabel: string;
  horizontal?: boolean;
  unit?: string;
  colors?: string[];
}> = ({ labels, values, datasetLabel, horizontal = false, unit = '', colors }) => {
  return (
    <Bar
      data={{
        labels,
        datasets: [
          {
            label: datasetLabel,
            data: values,
            backgroundColor: colors || '#15803D',
            borderRadius: 6,
            maxBarThickness: 36,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: horizontal ? 'y' : 'x',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${datasetLabel}: ${ctx.raw}${unit ? ` ${unit}` : ''}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: horizontal, color: '#E5EFE9' },
            ticks: { color: '#3F5E4D', font: { family: FONT_FAMILY, size: 11 } },
          },
          y: {
            grid: { display: !horizontal, color: '#E5EFE9' },
            ticks: { color: '#3F5E4D', font: { family: FONT_FAMILY, size: 11 } },
          },
        },
      }}
    />
  );
};

export const AgroDoughnutChart: React.FC<{
  labels: string[];
  values: number[];
  colors?: string[];
}> = ({ labels, values, colors }) => {
  return (
    <Doughnut
      data={{
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: colors || ['#15803D', '#D97706', '#DC2626', '#0F766E', '#65A30D'],
            borderWidth: 2,
            borderColor: '#FFFFFF',
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        cutout: '64%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 12,
              padding: 14,
              color: '#1E3A2B',
              font: { family: FONT_FAMILY, size: 12 },
            },
          },
        },
      }}
    />
  );
};

export const AgroLineChart: React.FC<{
  labels: string[];
  datasets: Array<{ label: string; data: number[]; borderColor: string; backgroundColor?: string }>;
}> = ({ labels, datasets }) => {
  return (
    <Line
      data={{
        labels,
        datasets: datasets.map((d) => ({
          ...d,
          tension: 0.3,
          borderWidth: 2.2,
          pointRadius: 4,
          pointBackgroundColor: d.borderColor,
          fill: false,
        })),
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 12,
              color: '#1E3A2B',
              font: { family: FONT_FAMILY, size: 12 },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#3F5E4D', font: { family: FONT_FAMILY, size: 11 } },
          },
          y: {
            grid: { color: '#E5EFE9' },
            ticks: { color: '#3F5E4D', font: { family: FONT_FAMILY, size: 11 } },
          },
        },
      }}
    />
  );
};
