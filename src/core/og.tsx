/** @jsxImportSource react */
import React from 'react';
import { scaleLinear } from '@visx/scale';
import { line } from 'd3-shape';

/* ----------------------------------------------------
Helper區
---------------------------------------------------- */


/* ----------------------------------------------------
Page 區
---------------------------------------------------- */
const SensorOg = ({ id, name, temperature, humidity, co2 }: any) => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '80px', backgroundColor: '#f9fafb', width: '1200px', height: '630px', fontFamily: 'sans-serif' }}>
            <h1 style={{ display: 'flex', fontSize: '80px', color: '#111827', marginBottom: '40px' }}>Sensor: {id}</h1>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', fontSize: '50px' }}>🌡 溫度：{temperature} °C</div>
                <div style={{ display: 'flex', fontSize: '50pxs' }}>💧 濕度：{humidity} %</div>
                <div style={{ display: 'flex', fontSize: '50px' }}>☁️ CO2：{co2} ppm</div>
            </div>
        </div>
    );
}

const ChartOg = () => {
    // --- 🎨 樣式與顏色定義 (組件私有) ---
    const THEME = {
        background: '#ffffff',
        titleText: '#1e293b',
        frameBorder: '#e2e8f0',
        gridLine: '#f1f5f9',
        mainLine: '#2563eb',
        mainLineWeight: 5,
        dataDot: '#ef4444',
        dataDotStroke: '#ffffff',
        dataDotRadius: 10,
        axisText: '#64748b',
        axisFontSize: '24px',
        xAxisFontSize: '20px',
    };

    const styles = {
        pageWrapper: {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: THEME.background,
            width: '1200px',
            height: '630px',
            fontFamily: 'sans-serif',
        },
        title: {
            display: 'flex',
            fontSize: '48px',
            marginBottom: '40px',
            fontWeight: 'bold',
            color: THEME.titleText,
        },
        yAxisWrapper: {
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            marginRight: '15px',
            marginLeft: '-45px',
        },
        tickLabel: {
            display: 'flex',
            height: '0px',
            alignItems: 'center',
            justifyContent: 'flex-end',
            fontSize: THEME.axisFontSize,
            color: THEME.axisText,
        },
        xAxisWrapper: {
            display: 'flex',
            position: 'relative',
            marginTop: '5px',
        },
        xLabel: {
            display: 'flex',
            position: 'absolute',
            width: '100px',
            marginLeft: '-50px',
            justifyContent: 'center',
            fontSize: THEME.xAxisFontSize,
            color: THEME.axisText,
        }
    };

    // --- 📊 資料與運算邏輯 ---
    const now = Date.now();
    const formatTime = (ts: number) => {
        const d = new Date(ts);
        const mm = d.getMinutes().toString().padStart(2, '0');
        const ss = d.getSeconds().toString().padStart(2, '0');
        return `${mm}:${ss}`;
    };

    const data = [
        { x: now,               y: 0,   label: formatTime(now) },
        { x: now + 45000,       y: 45,  label: formatTime(now + 45000) },
        { x: now + 90000,       y: 35,  label: formatTime(now + 90000) },
        { x: now + 150000,      y: 75,  label: formatTime(now + 150000) },
        { x: now + 200000,      y: 60,  label: formatTime(now + 200000) },
        { x: now + 300000,      y: 100, label: formatTime(now + 300000) },
    ];

    const innerWidth = 1000;
    const innerHeight = 400;
    const padding = 20;

    const svgWidth = innerWidth + padding * 2;
    const svgHeight = innerHeight + padding * 2;
    const yAxisWidth = 80;

    const xScale = scaleLinear({
        domain: [Math.min(...data.map(d => d.x)), Math.max(...data.map(d => d.x))],
        range: [0, innerWidth], 
    });
    const yScale = scaleLinear({
        domain: [0, 100],
        range: [innerHeight, 0],
    });

    const pathGenerator = line<any>()
        .x(d => xScale(d.x))
        .y(d => yScale(d.y));

    const yTicks = [100, 75, 50, 25, 0];

    return (
        <div style={styles.pageWrapper}>
            <h1 style={styles.title}>Encapsulated Styles Chart</h1>
            
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start' }}>
                <div style={{ ...styles.yAxisWrapper, width: `${yAxisWidth}px`, height: `${innerHeight}px`, marginTop: `${padding}px` }}>
                    {yTicks.map(t => (
                        <div key={t} style={styles.tickLabel}>{t}</div>
                    ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
                    <div style={{ display: 'flex', width: `${svgWidth}px`, height: `${svgHeight}px`, marginLeft: `-${padding}px`, marginTop: `-${padding}px` }}>
                        <svg width={svgWidth} height={svgHeight}>
                            <g transform={`translate(${padding}, ${padding})`}>
                                <rect x={0} y={0} width={innerWidth} height={innerHeight} fill="none" stroke={THEME.frameBorder} strokeWidth="2" />
                                {[75, 50, 25].map(t => (
                                    <line key={t} x1={0} x2={innerWidth} y1={yScale(t)} y2={yScale(t)} stroke={THEME.gridLine} strokeWidth="2" />
                                ))}
                                <path d={pathGenerator(data) || ''} fill="none" stroke={THEME.mainLine} strokeWidth={THEME.mainLineWeight} />
                                {data.map((d, i) => (
                                    <circle key={i} cx={xScale(d.x)} cy={yScale(d.y)} r={THEME.dataDotRadius} fill={THEME.dataDot} stroke={THEME.dataDotStroke} strokeWidth="2" />
                                ))}
                            </g>
                        </svg>
                    </div>

                    <div style={{ ...styles.xAxisWrapper, width: `${innerWidth}px`, height: '60px' }}>
                        {data.map((d, i) => (
                            <div key={i} style={{ ...styles.xLabel, left: `${xScale(d.x)}px` }}>
                                {d.label}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ----------------------------------------------------
設定哪些組件要開放
---------------------------------------------------- */
export {SensorOg, ChartOg};