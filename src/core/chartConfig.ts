export const CONFIG = {
    // Data Series Colors
    mainLine: '#424242ff',
    mainLine_temperature: '#ef4444',
    mainLineArea_temperature: null,
    mainLine_humidity: '#7494daff',
    mainLineArea_humidity: 'rgba(116, 148, 218, 0.2)',
    mainLine_co2: '#10b981',
    mainLineArea_co2: 'rgba(16, 185, 129, 0.2)',

    // Markers & Lines
    mainLineWeight: 5,
    dotRadius: 8,
    dotStroke: '#ffffff',

    // Y-Axis Buffers (動態縮放時的上下緩衝)
    buffer_temperature: [1, 1],
    buffer_humidity: [5, 5],
    buffer_co2: [50, 50],

    // Y-Axis Ranges (固定範圍，若設定則優先於 buffer)
    range_temperature: null as [number, number] | null,
    range_humidity: [0, 100] as [number, number] | null,
    range_co2: null as [number, number] | null,
};
