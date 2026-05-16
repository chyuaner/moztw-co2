import { scaleLinear } from "@visx/scale";
import { CTArea, CTChart, CTLine, CTScatter } from "./baseOg";
import { SensorDataRecord } from "./switchBot";
import { CSSProperties } from "hono/jsx";
import { CONFIG } from "./chartConfig";

/* ----------------------------------------------------
Helper區
---------------------------------------------------- */
const formatTime = (ts: number) => {
    // 加上 8 小時的毫秒數 (UTC+8 台灣時間)
    const d = new Date(ts + 8 * 3600 * 1000);
    // 改為顯示 HH:mm，並使用 getUTC* 避免 Cloudflare Worker 伺服器所在時區影響
    const hh = d.getUTCHours().toString().padStart(2, '0');
    const mm = d.getUTCMinutes().toString().padStart(2, '0');
    return `${hh}:${mm}`;
};

const ChartTemperatureLine = ({ data, xScale, yScale }: any) => {
    const THEME = {
        mainLine: CONFIG.mainLine_temperature, // Red for Temperature
        mainLineWeight: CONFIG.mainLineWeight,
        ...(CONFIG.mainLineArea_temperature ? { mainLineArea: CONFIG.mainLineArea_temperature } : {}),
        dataDot: CONFIG.mainLine_temperature,
        dataDotStroke: CONFIG.dotStroke,
        dataDotRadius: CONFIG.dotRadius,
    };

    return (
        <g>
            {THEME.mainLineArea && CTArea({ data, xKey: "x", yKey: "y", fill: THEME.mainLineArea, xScale, yScale })}
            {CTLine({ data, xKey: "x", yKey: "y", stroke: THEME.mainLine, strokeWidth: THEME.mainLineWeight, xScale, yScale })}
            {CTScatter({ data, xKey: "x", yKey: "y", r: THEME.dataDotRadius, fill: THEME.mainLine, stroke: THEME.dataDotStroke, strokeWidth: 2, xScale, yScale })}
        </g>
    );
}

const ChartHumidityLine = ({ data, xScale, yScale }: any) => {
    const THEME = {
        mainLine: CONFIG.mainLine_humidity, // Blue for Humidity
        mainLineWeight: CONFIG.mainLineWeight,
        ...(CONFIG.mainLineArea_humidity ? { mainLineArea: CONFIG.mainLineArea_humidity } : {}),
        dataDot: CONFIG.mainLine_humidity,
        dataDotStroke: CONFIG.dotStroke,
        dataDotRadius: CONFIG.dotRadius,
    };

    return (
        <g>
            {THEME.mainLineArea && CTArea({ data, xKey: "x", yKey: "y", fill: THEME.mainLineArea, xScale, yScale })}
            {CTLine({ data, xKey: "x", yKey: "y", stroke: THEME.mainLine, strokeWidth: THEME.mainLineWeight, xScale, yScale })}
            {CTScatter({ data, xKey: "x", yKey: "y", r: THEME.dataDotRadius, fill: THEME.mainLine, stroke: THEME.dataDotStroke, strokeWidth: 2, xScale, yScale })}
        </g>
    );
}

const ChartCo2Line = ({ data, xScale, yScale }: any) => {
    const THEME = {
        mainLine: CONFIG.mainLine_co2, // Green for CO2
        mainLineWeight: CONFIG.mainLineWeight,
        mainLineArea: CONFIG.mainLineArea_co2,
        dataDot: CONFIG.mainLine_co2,
        dataDotStroke: CONFIG.dotStroke,
        dataDotRadius: CONFIG.dotRadius,
    };

    return (
        <g>
            {THEME.mainLineArea && CTArea({ data, xKey: "x", yKey: "y", fill: THEME.mainLineArea, xScale, yScale })}
            {CTLine({ data, xKey: "x", yKey: "y", stroke: THEME.mainLine, strokeWidth: THEME.mainLineWeight, xScale, yScale })}
            {CTScatter({ data, xKey: "x", yKey: "y", r: THEME.dataDotRadius, fill: THEME.mainLine, stroke: THEME.dataDotStroke, strokeWidth: 2, xScale, yScale })}
        </g>
    );
}

/* ----------------------------------------------------
Page 區
---------------------------------------------------- */
const SensorOg = ({ id, name, temperature, humidity, co2 }: any) => {
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

const ErrorElement = ({
    statusCode,
    title,
    style = {},
} : {
    statusCode: Number,
    title: String,
    style?: CSSProperties
}) => {
    return (
        <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'center', 
            padding: '80px', 
            backgroundColor: '#f9fafb', 
            width: '1200px', 
            height: '630px', 
            fontFamily: 'sans-serif',
            ...style 
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '30px', marginBottom: '40px' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" /><path d="M12 17v.01" /><path d="M12 14a1.5 1.5 0 1 0 -1.14 -2.474" /></svg>
                <h1 style={{ display: 'flex', fontSize: '80px', color: '#111827', margin: 0 }}>{statusCode} Error</h1>
            </div>
            <div style={{ display: 'flex', fontSize: '50px', color: '#4b5563', lineHeight: '1.4' }}>
                {title}
            </div>
        </div>
    );
};

// Basechart: 共用的圖表版面框架與資料處理邏輯
const BaseChart = ({ title, datas = [], yKey, yBuffer = [0, 0], yRange = null, yColor, yLabel, renderChart }: any) => {
    // 1. 資料解析與預處理
    const parsedData = datas.map((d: any) => {
        const ts = d.lastchange;
        const lastchange = ts ? ts * 1000 : Date.now();
        return {
            x: lastchange,
            y: d[yKey],
            label: formatTime(lastchange)
        };
    });

    // 2. X 軸範圍 (保底 1 小時)
    const allX = parsedData.map((d: any) => d.x);
    let minX = allX.length > 0 ? Math.min(...allX) : Date.now() - 3600000;
    let maxX = allX.length > 0 ? Math.max(...allX) : Date.now();
    if (maxX - minX < 3600000) {
        minX = maxX - 3600000;
    }
    const innerWidth = 1000;
    const innerHeight = 400;
    const xDomain = [minX, maxX];

    // 3. Y 軸範圍與動態緩衝
    const allY = parsedData.map((d: any) => d.y);
    const yDomain = yRange || [
        allY.length > 0 ? Math.floor(Math.min(...allY) - (yBuffer ? yBuffer[0] : 0)) : 0,
        allY.length > 0 ? Math.ceil(Math.max(...allY) + (yBuffer ? yBuffer[1] : 0)) : 100
    ];

    // 4. 建立比例尺
    const xScale = scaleLinear({
        domain: xDomain,
        range: [0, innerWidth],
    });
    
    const yScale = scaleLinear({
        domain: yDomain,
        range: [innerHeight, 0],
    });

    // 5. 刻度計算
    const yTicks = yScale.ticks(5);
    const xLabels = xScale.ticks(5).map(t => ({ x: t, label: formatTime(t) }));

    // --- 🎨 樣式與顏色定義 (組件私有) ---
    const THEME = {
        background: '#ffffff',
        titleText: '#1e293b',
        frameBorder: '#e2e8f0',
        gridLine: '#f1f5f9',
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
        yAxis: {
            marginLeft: '-45px',
            marginRight: '15px',
        }
    };

    return (
        <div style={styles.pageWrapper as any}>
            <h1 style={styles.title as any}>{title}</h1>
            <CTChart
                width={innerWidth}
                height={innerHeight}
                domain={{ x: xDomain, y: yDomain }}
                yTicks={yTicks}
                xLabels={xLabels}
                theme={THEME}
                yAxisStyle={styles.yAxis}
                yAxisTextColor={yColor}
                yAxisLabel={yLabel}
            >
                {renderChart({ data: parsedData, xScale, yScale })}
            </CTChart>
        </div>
    );
};

// DualAxisBaseChart: 支援雙 Y 軸的圖表框架
const DualAxisBaseChart = ({ title, datas = [], yKey1, yBuffer1, yRange1 = null, yColor1, yLabel1, yKey2, yBuffer2, yRange2 = null, yColor2, yLabel2, renderChart }: any) => {
    // 1. 資料解析與預處理
    const parsedData = datas.map((d: any) => {
        const ts = d.lastchange;
        const lastchange = ts ? ts * 1000 : Date.now();
        return {
            x: lastchange,
            y1: d[yKey1],
            y2: d[yKey2],
            label: formatTime(lastchange)
        };
    });

    // 2. X 軸範圍 (保底 1 小時)
    const allX = parsedData.map((d: any) => d.x);
    let minX = allX.length > 0 ? Math.min(...allX) : Date.now() - 3600000;
    let maxX = allX.length > 0 ? Math.max(...allX) : Date.now();
    if (maxX - minX < 3600000) {
        minX = maxX - 3600000;
    }
    const innerWidth = 1000;
    const innerHeight = 400;
    const xDomain = [minX, maxX];

    // 3. Y1 軸範圍 (Left)
    const allY1 = parsedData.map((d: any) => d.y1);
    const yDomain1 = yRange1 || [
        allY1.length > 0 ? Math.floor(Math.min(...allY1) - (yBuffer1 ? yBuffer1[0] : 0)) : 0,
        allY1.length > 0 ? Math.ceil(Math.max(...allY1) + (yBuffer1 ? yBuffer1[1] : 0)) : 100
    ];

    // 4. Y2 軸範圍 (Right)
    const allY2 = parsedData.map((d: any) => d.y2);
    const yDomain2 = yRange2 || [
        allY2.length > 0 ? Math.floor(Math.min(...allY2) - (yBuffer2 ? yBuffer2[0] : 0)) : 0,
        allY2.length > 0 ? Math.ceil(Math.max(...allY2) + (yBuffer2 ? yBuffer2[1] : 0)) : 100
    ];

    // 5. 建立比例尺
    const xScale = scaleLinear({ domain: xDomain, range: [0, innerWidth] });
    const yScale1 = scaleLinear({ domain: yDomain1, range: [innerHeight, 0] });
    const yScale2 = scaleLinear({ domain: yDomain2, range: [innerHeight, 0] });

    // 6. 刻度計算
    const yTicks1 = yScale1.ticks(5);
    const yTicks2 = yScale2.ticks(5);
    const xLabels = xScale.ticks(5).map(t => ({ x: t, label: formatTime(t) }));

    const THEME = {
        background: '#ffffff',
        titleText: '#1e293b',
        frameBorder: '#e2e8f0',
        gridLine: '#f1f5f9',
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
        yAxisLeft: {
            marginLeft: '-45px',
            marginRight: '15px',
        },
        yAxisRight: {
            marginLeft: '15px',
            marginRight: '-45px',
        }
    };

    return (
        <div style={styles.pageWrapper as any}>
            <h1 style={styles.title as any}>{title}</h1>
            <CTChart
                width={innerWidth}
                height={innerHeight}
                domain={{ x: xDomain, y: yDomain1, yRight: yDomain2 }}
                yTicks={yTicks1}
                yTicksRight={yTicks2}
                xLabels={xLabels}
                theme={THEME}
                yAxisStyle={styles.yAxisLeft}
                yAxisStyleRight={styles.yAxisRight}
                yAxisTextColor={yColor1}
                yAxisTextColorRight={yColor2}
                yAxisLabel={yLabel1}
                yAxisLabelRight={yLabel2}
            >
                {renderChart({ data: parsedData, xScale, yScale1, yScale2 })}
            </CTChart>
        </div>
    );
};


const ChartTemperatureHumidityLine = ({ data, xScale, yScale1, yScale2 }: any) => {
    return (
        <g>
            {/* 濕度畫在底層 */}
            {ChartHumidityLine({ data: data.map((d: any) => ({ x: d.x, y: d.y2 })), xScale, yScale: yScale2 })}
            {/* 溫度畫在頂層 */}
            {ChartTemperatureLine({ data: data.map((d: any) => ({ x: d.x, y: d.y1 })), xScale, yScale: yScale1 })}
        </g>
    );
};

const TemperatureChartOg = ({ datas = [], title = "Temperature History" }: any) => {
    return <BaseChart title={title} datas={datas} yKey="temperature" yBuffer={CONFIG.buffer_temperature} yRange={CONFIG.range_temperature} yColor={CONFIG.mainLine_temperature} yLabel="溫度 (°C)" renderChart={ChartTemperatureLine} />;
}

const HumidityChartOg = ({ datas = [], title = "Humidity History" }: any) => {
    return <BaseChart title={title} datas={datas} yKey="humidity" yBuffer={CONFIG.buffer_humidity} yRange={CONFIG.range_humidity} yColor={CONFIG.mainLine_humidity} yLabel="濕度 (%)" renderChart={ChartHumidityLine} />;
}

const Co2ChartOg = ({ datas = [], title = "CO2 History" }: any) => {
    return <BaseChart title={title} datas={datas} yKey="co2" yBuffer={CONFIG.buffer_co2} yRange={CONFIG.range_co2} yColor={CONFIG.mainLine_co2} yLabel="CO2 (ppm)" renderChart={ChartCo2Line} />;
}

const TemperatureHumidityChartOg = ({ datas = [], title = "Temperature and Humidity History" }: any) => {
    return (
        <DualAxisBaseChart 
            title={title} 
            datas={datas} 
            yKey1="temperature" 
            yBuffer1={CONFIG.buffer_temperature} 
            yRange1={CONFIG.range_temperature}
            yColor1={CONFIG.mainLine_temperature}
            // yLabel1="溫度 (°C)"
            yKey2="humidity" 
            yBuffer2={CONFIG.buffer_humidity} 
            yRange2={CONFIG.range_humidity}
            yColor2={CONFIG.mainLine_humidity}
            // yLabel2="濕度 (%)"
            renderChart={ChartTemperatureHumidityLine} 
        />
    );
}

/* ----------------------------------------------------
測試用
---------------------------------------------------- */
const ChartTestOg = () => {
    // --- 🎨 樣式與顏色定義 (組件私有) ---
    const THEME = {
        background: '#ffffff',
        titleText: '#1e293b',
        frameBorder: '#e2e8f0',
        gridLine: '#f1f5f9',
        mainLine: CONFIG.mainLine_humidity, // Blue for Humidity
        mainLineWeight: CONFIG.mainLineWeight,
        dataDot: CONFIG.mainLine_temperature,
        dataDotStroke: CONFIG.dotStroke,
        dataDotRadius: CONFIG.dotRadius,
        axisText: '#64748b',
        axisFontSize: '24px',
        xAxisFontSize: '20px',
        co2Line: CONFIG.mainLine_co2, // Green for CO2
        co2Area: CONFIG.mainLineArea_co2,
        tempLine: CONFIG.mainLine_temperature, // Red for Temp
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
export {SensorOg, TemperatureChartOg, Co2ChartOg, HumidityChartOg, TemperatureHumidityChartOg, ChartTestOg as ChartOg, ErrorElement};