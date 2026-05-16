/* @jsxImportSource react */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { VictoryChart, VictoryLine, VictoryAxis, VictoryGroup, VictoryArea, VictoryContainer } from 'victory';
import { api } from './api';
import { CONFIG } from '../chartConfig';

const ChartComponent = ({ hasCo2, history }: { hasCo2: boolean, history: any[] }) => {
  const tempDomain = [10, 40];
  const humDomain = [30, 80];
  const co2Domain = [0, 2500];

  const normalizeTemp = (v: number) => (v - tempDomain[0]) / (tempDomain[1] - tempDomain[0]);
  const normalizeHum = (v: number) => (v - humDomain[0]) / (humDomain[1] - humDomain[0]);
  const normalizeCo2 = (v: number) => v / co2Domain[1];

  const chartDataTemp = history
    .filter(d => typeof d.temperature === 'number')
    .map(d => ({ x: new Date(d.lastchange * 1000), y: normalizeTemp(d.temperature) }));
  const chartDataHum = history
    .filter(d => typeof d.humidity === 'number')
    .map(d => ({ x: new Date(d.lastchange * 1000), y: normalizeHum(d.humidity) }));
  const chartDataCo2 = hasCo2 
    ? history
        .filter(d => typeof d.co2 === 'number')
        .map(d => ({ x: new Date(d.lastchange * 1000), y: normalizeCo2(d.co2) })) 
    : [];

  return (
    <VictoryChart 
      width={800} height={260} 
      padding={{top: 30, bottom: 40, left: 60, right: hasCo2 ? 120 : 60}}
      containerComponent={<VictoryContainer responsive={true} />}
    >
      {hasCo2 && history.length > 0 && (
        <VictoryGroup>
          <VictoryArea 
            data={[
              {x: new Date(history[0].lastchange * 1000), y: normalizeCo2(800)}, 
              {x: new Date(history[history.length-1].lastchange * 1000), y: normalizeCo2(800)}
            ]} 
            style={{data: {fill: '#dcfce7', opacity: 0.5, stroke: 'none'}}} 
          />
          <VictoryArea 
            data={[
              {x: new Date(history[0].lastchange * 1000), y: normalizeCo2(1200)}, 
              {x: new Date(history[history.length-1].lastchange * 1000), y: normalizeCo2(1200)}
            ]} 
            y0={normalizeCo2(800)} 
            style={{data: {fill: '#fef08a', opacity: 0.5, stroke: 'none'}}} 
          />
          <VictoryArea 
            data={[
              {x: new Date(history[0].lastchange * 1000), y: normalizeCo2(2000)}, 
              {x: new Date(history[history.length-1].lastchange * 1000), y: normalizeCo2(2000)}
            ]} 
            y0={normalizeCo2(1200)} 
            style={{data: {fill: '#fed7aa', opacity: 0.5, stroke: 'none'}}} 
          />
          <VictoryArea 
            data={[
              {x: new Date(history[0].lastchange * 1000), y: 1}, 
              {x: new Date(history[history.length-1].lastchange * 1000), y: 1}
            ]} 
            y0={normalizeCo2(2000)} 
            style={{data: {fill: '#fecaca', opacity: 0.5, stroke: 'none'}}} 
          />
        </VictoryGroup>
      )}

      <VictoryAxis 
        scale="time"
        style={{
          axis: {stroke: '#e5e7eb'},
          tickLabels: {fontSize: 10, fill: '#6b7280', padding: 5},
          grid: {stroke: '#f3f4f6', strokeDasharray: '4,4'}
        }}
      />

      <VictoryAxis dependentAxis
        tickValues={[0, 0.2, 0.4, 0.6, 0.8, 1]}
        tickFormat={t => Math.round(t * (tempDomain[1]-tempDomain[0]) + tempDomain[0])}
        style={{
          axis: {stroke: 'transparent'},
          tickLabels: {fontSize: 10, fill: CONFIG.mainLine_temperature, padding: 5},
          grid: {stroke: '#f3f4f6', strokeDasharray: '4,4'}
        }}
      />

      <VictoryAxis dependentAxis offsetX={800 - (hasCo2 ? 120 : 60)}
        tickValues={[0, 0.2, 0.4, 0.6, 0.8, 1]}
        tickFormat={t => Math.round(t * (humDomain[1]-humDomain[0]) + humDomain[0])}
        style={{
          axis: {stroke: 'transparent'},
          tickLabels: {fontSize: 10, fill: CONFIG.mainLine_humidity, padding: 5}
        }}
      />

      {hasCo2 && (
        <VictoryAxis dependentAxis offsetX={800 - 60}
          tickValues={[0, 0.2, 0.4, 0.6, 0.8, 1]}
          tickFormat={t => Math.round(t * co2Domain[1])}
          style={{
            axis: {stroke: 'transparent'},
            tickLabels: {fontSize: 10, fill: CONFIG.mainLine_co2, padding: 5}
          }}
        />
      )}

      <VictoryLine data={chartDataTemp} style={{data: {stroke: CONFIG.mainLine_temperature, strokeWidth: 2}}} />
      <VictoryLine data={chartDataHum} style={{data: {stroke: CONFIG.mainLine_humidity, strokeWidth: 2, strokeDasharray: '4,4'}}} />
      {hasCo2 && <VictoryLine data={chartDataCo2} style={{data: {stroke: CONFIG.mainLine_co2, strokeWidth: 2}}} />}
    </VictoryChart>
  );
};

// 儲存已建立的 React Roots，避免重複建立
const roots: Record<string, any> = {};

const updateUI = (locId: string, history: any[]) => {
  const card = document.getElementById(`room-card-${locId}`);
  if (!card) return;

  if (history.length > 0) {
    const last = history[history.length - 1];
    const time = new Date(last.lastchange * 1000).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
    
    const timeEl = card.querySelector('.current-time');
    if (timeEl) timeEl.textContent = `(${time})`;
    
    const tempEl = card.querySelector('.val-temp');
    if (tempEl) tempEl.textContent = last.temperature?.toFixed(1) || '--';
    
    const humEl = card.querySelector('.val-hum');
    if (humEl) humEl.textContent = last.humidity?.toFixed(0) || '--';
    
    const co2El = card.querySelector('.val-co2');
    if (co2El) co2El.textContent = last.co2 || '--';
  }
};

const renderChart = (locId: string, hasCo2: boolean, history: any[]) => {
  const container = document.getElementById(`chart-container-${locId}`);
  if (!container) return;

  if (!roots[locId]) {
    roots[locId] = createRoot(container);
  }
  
  roots[locId].render(<ChartComponent hasCo2={hasCo2} history={history} />);
};

const loadDataForTimeframe = async (timeframe: string) => {
  const containers = document.querySelectorAll('[id^="chart-container-"]');
  const locIds = Array.from(containers).map(el => ({
    id: el.getAttribute('data-location') as string,
    hasCo2: el.getAttribute('data-has-co2') === 'true'
  }));

  for (const { id, hasCo2 } of locIds) {
    try {
      const history = await api.getHistory(id, timeframe);
      if (!Array.isArray(history)) throw new Error('Invalid history data');
      
      // 依時間排序
      history.sort((a: any, b: any) => a.lastchange - b.lastchange);
      
      updateUI(id, history);
      renderChart(id, hasCo2, history);
    } catch (err) {
      console.error(`Failed to load data for ${id}:`, err);
    }
  }
};

const init = () => {
  const buttons = document.querySelectorAll('.timeframe-btn');
  
  buttons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      // Update Active State
      buttons.forEach(b => {
        b.classList.remove('bg-white', 'text-gray-900', 'shadow', 'font-semibold');
        b.classList.add('text-gray-500');
      });
      const target = e.currentTarget as HTMLElement;
      target.classList.remove('text-gray-500');
      target.classList.add('bg-white', 'text-gray-900', 'shadow', 'font-semibold');
      
      // Fetch and Update
      const timeframe = target.getAttribute('data-timeframe') || '6h';
      loadDataForTimeframe(timeframe);
    });
  });

  // Initial load
  loadDataForTimeframe('6h');
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
