import { scaleLinear } from "@visx/scale";
import { CTArea, CTChart, CTLine, CTScatter } from "./baseOg";
import { SensorDataRecord } from "./switchBot";

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
        mainLine: '#ef4444', // Red for Temperature
        mainLineWeight: 5,
        // MainArea: 'rgba(16, 185, 129, 0.2)',
        dataDot: '#ef4444',
        dataDotStroke: '#ffffff',
        dataDotRadius: 10,
    };

    return (
        <g>
            {CTLine({ data, xKey: "x", yKey: "y", stroke: THEME.mainLine, strokeWidth: THEME.mainLineWeight, xScale, yScale })}
            {CTScatter({ data, xKey: "x", yKey: "y", r: THEME.dataDotRadius, fill: THEME.mainLine, stroke: THEME.dataDotStroke, strokeWidth: 2, xScale, yScale })}
        </g>
    );
}

const ChartHumidityLine = ({ data, xScale, yScale }: any) => {
    const THEME = {
        mainLine: '#2563eb', // Blue for Humidity
        mainLineWeight: 5,
        // MainArea: 'rgba(16, 185, 129, 0.2)',
        dataDot: '#2563eb',
        dataDotStroke: '#ffffff',
        dataDotRadius: 10,
    };

    return (
        <g>
            {CTLine({ data, xKey: "x", yKey: "y", stroke: THEME.mainLine, strokeWidth: THEME.mainLineWeight, xScale, yScale })}
            {CTScatter({ data, xKey: "x", yKey: "y", r: THEME.dataDotRadius, fill: THEME.mainLine, stroke: THEME.dataDotStroke, strokeWidth: 2, xScale, yScale })}
        </g>
    );
}

const ChartCo2Line = ({ data, xScale, yScale }: any) => {
    const THEME = {
        mainLine: '#10b981', // Green for CO2
        mainLineWeight: 5,
        MainArea: 'rgba(16, 185, 129, 0.2)',
        dataDot: '#10b981',
        dataDotStroke: '#ffffff',
        dataDotRadius: 10,
    };

    return (
        <g>
            {CTArea({ data, xKey: "x", yKey: "y", fill: THEME.MainArea, xScale, yScale })}
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

// Basechart: 共用的圖表版面框架與資料處理邏輯
const BaseChart = ({ title, datas = [], yKey, yBuffer = [0, 0], renderChart }: any) => {
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
    const minY = allY.length > 0 ? Math.floor(Math.min(...allY) - yBuffer[0]) : 0;
    const maxY = allY.length > 0 ? Math.ceil(Math.max(...allY) + yBuffer[1]) : 100;
    const yDomain = [minY, maxY];

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
            >
                {renderChart({ data: parsedData, xScale, yScale })}
            </CTChart>
        </div>
    );
};

const TemperatureChartOg = ({ datas = [], title = "Temperature History" }: any) => {
    return <BaseChart title={title} datas={datas} yKey="temperature" yBuffer={[2, 2]} renderChart={ChartTemperatureLine} />;
}

const Co2ChartOg = ({ datas = [], title = "CO2 History" }: any) => {
    return <BaseChart title={title} datas={datas} yKey="co2" yBuffer={[50, 50]} renderChart={ChartCo2Line} />;
}

const HumidityChartOg = ({ datas = [], title = "Humidity History" }: any) => {
    return <BaseChart title={title} datas={datas} yKey="humidity" yBuffer={[5, 5]} renderChart={ChartHumidityLine} />;
}

const ChartTestOg = () => {
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
export {SensorOg, TemperatureChartOg, Co2ChartOg, HumidityChartOg, ChartTestOg as ChartOg};