/** @jsxImportSource react */
import React from 'react';
import { scaleLinear } from '@visx/scale';
import { line, area } from 'd3-shape';

/* ----------------------------------------------------
Helper區
---------------------------------------------------- */

// CTArea: 繪製折線下方的填色區域 (通常用來表示累積量或強調範圍，如 CO2 濃度底下的綠色半透明區塊)
export const CTArea = ({ data, xKey = 'x', yKey = 'y', xScale, yScale, fill }: any) => {
    if (!xScale || !yScale) return null;
    const pathGenerator = area<any>()
        .x(d => xScale(d[xKey]))
        .y0(yScale.range()[0])
        .y1(d => yScale(d[yKey]));

    return <path d={pathGenerator(data) || ''} fill={fill} stroke="none" />;
};

// CTLine: 繪製主要的折線 (負責將所有的資料點連起來的那條線)
export const CTLine = ({ data, xKey = 'x', yKey = 'y', xScale, yScale, stroke, strokeWidth }: any) => {
    if (!xScale || !yScale) return null;
    const pathGenerator = line<any>()
        .x(d => xScale(d[xKey]))
        .y(d => yScale(d[yKey]));

    return <path d={pathGenerator(data) || ''} fill="none" stroke={stroke} strokeWidth={strokeWidth} />;
};

// CTScatter: 繪製散佈資料點 (也就是折線轉折處的那一顆顆小圓點，讓使用者清楚看出每個時間點的確切位置)
export const CTScatter = ({ data, xKey = 'x', yKey = 'y', xScale, yScale, r, fill, stroke, strokeWidth }: any) => {
    if (!xScale || !yScale) return null;
    return (
        <g>
            {data.map((d: any, i: number) => (
                <circle 
                    key={i} 
                    cx={xScale(d[xKey])} 
                    cy={yScale(d[yKey])} 
                    r={r} 
                    fill={fill} 
                    stroke={stroke} 
                    strokeWidth={strokeWidth} 
                />
            ))}
        </g>
    );
};

// CTChart: 處理座標軸、背景網格線與圖表外框的基礎容器 (負責把 X軸 和 Y軸 畫好，然後把線條與點包在裡面)
export const CTChart = ({
    width = 1000,
    height = 400,
    padding = 20,
    yAxisWidth = 80,
    domain,
    yTicks = [],
    xLabels = [],
    theme,
    children
}: any) => {
    const svgWidth = width + padding * 2;
    const svgHeight = height + padding * 2;

    const xScale = scaleLinear({
        domain: domain.x,
        range: [0, width],
    });
    
    const yScale = scaleLinear({
        domain: domain.y,
        range: [height, 0],
    });

    const gridTicks = yTicks.filter((t: number) => t !== domain.y[0] && t !== domain.y[1]);

    return (
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start' }}>
            <div style={{ 
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                marginRight: '15px',
                marginLeft: '-45px',
                width: `${yAxisWidth}px`, 
                height: `${height}px`, 
                marginTop: `${padding}px` 
            }}>
                {yTicks.map((t: number) => (
                    <div key={t} style={{
                        display: 'flex',
                        height: '0px',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        fontSize: theme.axisFontSize,
                        color: theme.axisText,
                    }}>{t}</div>
                ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
                <div style={{ display: 'flex', width: `${svgWidth}px`, height: `${svgHeight}px`, marginLeft: `-${padding}px`, marginTop: `-${padding}px` }}>
                    <svg width={svgWidth} height={svgHeight}>
                        <g transform={`translate(${padding}, ${padding})`}>
                            <rect x={0} y={0} width={width} height={height} fill="none" stroke={theme.frameBorder} strokeWidth="2" />
                            {gridTicks.map((t: number) => (
                                <line key={t} x1={0} x2={width} y1={yScale(t)} y2={yScale(t)} stroke={theme.gridLine} strokeWidth="2" />
                            ))}
                            {children}
                        </g>
                    </svg>
                </div>

                {xLabels.length > 0 && (
                    <div style={{ 
                        display: 'flex',
                        position: 'relative',
                        marginTop: '5px',
                        width: `${width}px`, 
                        height: '60px' 
                    }}>
                        {xLabels.map((d: any, i: number) => (
                            <div key={i} style={{ 
                                display: 'flex',
                                position: 'absolute',
                                width: '100px',
                                marginLeft: '-50px',
                                justifyContent: 'center',
                                fontSize: theme.xAxisFontSize,
                                color: theme.axisText,
                                left: `${xScale(d.x)}px` 
                            }}>
                                {d.label}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

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
        mainLine: '#2563eb', // Blue for Humidity
        mainLineWeight: 5,
        dataDot: '#ef4444',
        dataDotStroke: '#ffffff',
        dataDotRadius: 10,
        axisText: '#64748b',
        axisFontSize: '24px',
        xAxisFontSize: '20px',
        co2Line: '#10b981', // Green for CO2
        co2Area: 'rgba(16, 185, 129, 0.2)',
        tempLine: '#ef4444', // Red for Temp
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
    };

    // --- 📊 資料與運算邏輯 ---
    const now = Date.now();
    const formatTime = (ts: number) => {
        const d = new Date(ts);
        const mm = d.getMinutes().toString().padStart(2, '0');
        const ss = d.getSeconds().toString().padStart(2, '0');
        return `${mm}:${ss}`;
    };

    // 模擬分離出來的各指標資料 (比照 Victory series 的多組設計)
    // 註：CO2 因為範圍較大，這裡先模擬已除以 10 (co2Norm) 以適應 0-100 的 Y 軸
    const seriesData = [
        {
            name: "CO2",
            data: [
                { x: now,               y: 40, label: formatTime(now) },
                { x: now + 45000,       y: 45, label: formatTime(now + 45000) },
                { x: now + 90000,       y: 50, label: formatTime(now + 90000) },
                { x: now + 150000,      y: 80, label: formatTime(now + 150000) },
                { x: now + 200000,      y: 75, label: formatTime(now + 200000) },
                { x: now + 300000,      y: 60, label: formatTime(now + 300000) },
            ],
            stroke: THEME.co2Line,
            fill: THEME.co2Area,
            isArea: true,
        },
        {
            name: "Humidity",
            data: [
                { x: now,               y: 45, label: formatTime(now) },
                { x: now + 45000,       y: 50, label: formatTime(now + 45000) },
                { x: now + 90000,       y: 48, label: formatTime(now + 90000) },
                { x: now + 150000,      y: 60, label: formatTime(now + 150000) },
                { x: now + 200000,      y: 55, label: formatTime(now + 200000) },
                { x: now + 300000,      y: 50, label: formatTime(now + 300000) },
            ],
            stroke: THEME.mainLine,
            fill: THEME.mainLine,
            isArea: false,
        },
        {
            name: "Temperature",
            data: [
                { x: now,               y: 24, label: formatTime(now) },
                { x: now + 45000,       y: 25, label: formatTime(now + 45000) },
                { x: now + 90000,       y: 26, label: formatTime(now + 90000) },
                { x: now + 150000,      y: 25, label: formatTime(now + 150000) },
                { x: now + 200000,      y: 24, label: formatTime(now + 200000) },
                { x: now + 300000,      y: 23, label: formatTime(now + 300000) },
            ],
            stroke: THEME.tempLine,
            fill: THEME.tempLine,
            isArea: false,
        }
    ];

    const innerWidth = 1000;
    const innerHeight = 400;

    // 取得所有 x 座標以計算 domain
    const allX = seriesData.flatMap(s => s.data.map(d => d.x));
    const xDomain = [Math.min(...allX), Math.max(...allX)];

    const xScale = scaleLinear({
        domain: xDomain,
        range: [0, innerWidth],
    });
    
    const yScale = scaleLinear({
        domain: [0, 100],
        range: [innerHeight, 0],
    });

    // 從第一組資料取出時間標籤 (假設大家的 X 軸時間點對齊)
    const xLabels = seriesData[0].data.map(d => ({ x: d.x, label: d.label }));

    return (
        <div style={styles.pageWrapper}>
            <h1 style={styles.title}>History Mixed Chart</h1>
            
            <CTChart
                width={innerWidth}
                height={innerHeight}
                domain={{ x: xDomain, y: [0, 100] }}
                yTicks={[100, 75, 50, 25, 0]}
                xLabels={xLabels}
                theme={THEME}
            >
                {seriesData.map((s, i) => (
                    <g key={s.name}>
                        {s.isArea && CTArea({ data: s.data, xKey: "x", yKey: "y", fill: s.fill, xScale, yScale })}
                        {CTLine({ data: s.data, xKey: "x", yKey: "y", stroke: s.stroke, strokeWidth: THEME.mainLineWeight, xScale, yScale })}
                        {!s.isArea && CTScatter({ data: s.data, xKey: "x", yKey: "y", r: THEME.dataDotRadius, fill: s.fill, stroke: THEME.dataDotStroke, strokeWidth: 2, xScale, yScale })}
                    </g>
                ))}
            </CTChart>
        </div>
    );
}

/* ----------------------------------------------------
設定哪些組件要開放
---------------------------------------------------- */
export {SensorOg, ChartOg};