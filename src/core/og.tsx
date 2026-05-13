/** @jsxImportSource react */
import React from 'react';
import { scaleLinear } from '@visx/scale';
import { line } from 'd3-shape';

export const OgSensor = ({ id, name, temperature, humidity, co2 }: any) => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '80px', backgroundColor: '#f9fafb', width: '1200px', height: '630px', fontFamily: 'sans-serif' }}>
            <h1 style={{ display: 'flex', fontSize: '80px', color: '#111827', marginBottom: '40px' }}>Sensor: {id}</h1>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', fontSize: '50px' }}>🌡 溫度：{temperature} °C</div>
                <div style={{ display: 'flex', fontSize: '50px' }}>💧 濕度：{humidity} %</div>
                <div style={{ display: 'flex', fontSize: '50px' }}>☁️ CO2：{co2} ppm</div>
            </div>
        </div>
    );
}

export const OgChart = () => {
    // --- 1. 資料準備 ---
    const now = Date.now();
    const formatTime = (ts: number) => {
        const d = new Date(ts);
        const mm = d.getMinutes().toString().padStart(2, '0');
        const ss = d.getSeconds().toString().padStart(2, '0');
        return `${mm}:${ss}`;
    };

    // x: 決定物理位置, y: 決定數值高度, label: 下方顯示文字
    const data = [
        { x: now,               y: 0,   label: formatTime(now) },
        { x: now + 45000,       y: 45,  label: formatTime(now + 45000) },
        { x: now + 90000,       y: 35,  label: formatTime(now + 90000) },
        { x: now + 150000,      y: 75,  label: formatTime(now + 150000) },
        { x: now + 200000,      y: 60,  label: formatTime(now + 200000) },
        { x: now + 300000,      y: 100, label: formatTime(now + 300000) },
    ];

    // --- 2. 佈局尺寸定義 ---
    const innerWidth = 1000;  // 灰色框框的寬度
    const innerHeight = 400; // 灰色框框的高度
    const padding = 20;      // 預留給圓點的安全空間 (防止邊界 clipping)

    const svgWidth = innerWidth + padding * 2;
    const svgHeight = innerHeight + padding * 2;

    const yAxisWidth = 80;   // Y 軸文字區域寬度
    const xAxisHeight = 60;  // X 軸文字區域高度

    // --- 3. 比例尺換算 (將數據轉換為像素座標) ---
    const xScale = scaleLinear({
        domain: [Math.min(...data.map(d => d.x)), Math.max(...data.map(d => d.x))],
        range: [0, innerWidth], 
    });
    const yScale = scaleLinear({
        domain: [0, 100],
        range: [innerHeight, 0], // SVG 0 在上方，所以 100 對應 0, 0 對應 innerHeight
    });

    // 折線路徑生成器
    const pathGenerator = line<any>()
        .x(d => xScale(d.x))
        .y(d => yScale(d.y));

    const yTicks = [100, 75, 50, 25, 0];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'white', width: '1200px', height: '630px', fontFamily: 'sans-serif' }}>
            <h1 style={{ display: 'flex', fontSize: '48px', marginBottom: '40px', fontWeight: 'bold' }}>Custom Manual Chart</h1>
            
            {/* 圖表主容器 (橫向 Flex) */}
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start' }}>
                
                {/* Y 軸數字欄 (利用 flex 的 space-between 自動垂直對齊) */}
                <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    justifyContent: 'space-between', 
                    width: `${yAxisWidth}px`, 
                    height: `${innerHeight}px`,
                    marginLeft: '-45px',
                    marginRight: '15px',
                    marginTop: `${padding}px` // 抵消 SVG 的 Padding 確保對齊
                }}>
                    {yTicks.map(t => (
                        <div key={t} style={{ display: 'flex', height: '0px', alignItems: 'center', justifyContent: 'flex-end', fontSize: '24px', color: '#64748b' }}>
                            {t}
                        </div>
                    ))}
                </div>

                {/* 繪圖與 X 軸容器 */}
                <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
                    
                    {/* SVG 繪圖層 (寬高包含 Padding 以容納邊界圓點) */}
                    <div style={{ 
                        display: 'flex', 
                        width: `${svgWidth}px`, 
                        height: `${svgHeight}px`, 
                        marginLeft: `-${padding}px`, 
                        marginTop: `-${padding}px`
                    }}>
                        <svg width={svgWidth} height={svgHeight}>
                            <g transform={`translate(${padding}, ${padding})`}>
                                {/* 灰色參考框框 (精準 0-100 範圍) */}
                                <rect x={0} y={0} width={innerWidth} height={innerHeight} fill="none" stroke="#e2e8f0" strokeWidth="2" />

                                {/* 內部水平格線 */}
                                {[75, 50, 25].map(t => (
                                    <line key={t} x1={0} x2={innerWidth} y1={yScale(t)} y2={yScale(t)} stroke="#f1f5f9" strokeWidth="2" />
                                ))}

                                {/* 藍色路徑線 */}
                                <path d={pathGenerator(data) || ''} fill="none" stroke="#2563eb" strokeWidth="5" />
                                
                                {/* 紅色數據圓點 */}
                                {data.map((d, i) => (
                                    <circle key={i} cx={xScale(d.x)} cy={yScale(d.y)} r="10" fill="#ef4444" stroke="white" strokeWidth="2" />
                                ))}
                            </g>
                        </svg>
                    </div>

                    {/* X 軸標籤 (直接對齊數據點的 x 座標) */}
                    <div style={{ display: 'flex', position: 'relative', width: `${innerWidth}px`, height: `${xAxisHeight}px`, marginTop: `5px` }}>
                        {data.map((d, i) => (
                            <div key={i} style={{ 
                                display: 'flex', 
                                position: 'absolute', 
                                left: `${xScale(d.x)}px`, 
                                width: '100px', 
                                marginLeft: '-50px', 
                                justifyContent: 'center', 
                                fontSize: '20px', 
                                color: '#64748b' 
                            }}>
                                {d.label}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}