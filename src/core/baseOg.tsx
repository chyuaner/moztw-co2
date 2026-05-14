/** @jsxImportSource react */
import React from 'react';
import { scaleLinear } from '@visx/scale';
import { line, area } from 'd3-shape';

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
    yTicksRight = [],
    xLabels = [],
    theme,
    yAxisStyle = {},
    yAxisStyleRight = {},
    chartStyle = {},
    yAxisTextColor = null,
    yAxisTextColorRight = null,
    yAxisLabel = null,
    yAxisLabelRight = null,
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

    const yScaleRight = yTicksRight.length > 0 ? scaleLinear({
        domain: domain.yRight || [0, 100],
        range: [height, 0],
    }) : null;

    const gridTicks = yTicks.filter((t: number) => t !== domain.y[0] && t !== domain.y[1]);

    return (
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start' }}>
            {/* Left Y Axis Label */}
            {yAxisLabel ? (
                <div style={{
                    display: 'flex',
                    width: '40px', // 從 40px 增加到 60px
                    height: `${height}px`,
                    marginTop: `${padding}px`,
                    marginRight: '8px', // 增加與刻度的間距
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <div style={{
                        display: 'flex',
                        transform: 'rotate(-90deg)',
                        whiteSpace: 'nowrap',
                        fontSize: theme.axisFontSize,
                        color: yAxisTextColor || theme.axisText,
                        fontWeight: 'bold',
                    }}>{yAxisLabel}</div>
                </div>
            ) : null}

            {/* Left Y Axis Ticks */}
            <div style={{ 
                display: 'flex',
                position: 'relative',
                width: `${yAxisWidth}px`, 
                height: `${height}px`, 
                marginTop: `${padding}px`,
                ...yAxisStyle
            }}>
                {yTicks.map((t: number) => (
                    <div key={t} style={{
                        display: 'flex',
                        position: 'absolute',
                        top: `${yScale(t)}px`,
                        width: '100%',
                        height: '0px',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        fontSize: theme.axisFontSize,
                        color: yAxisTextColor || theme.axisText,
                        fontWeight: yAxisTextColor ? 'bold' : 'normal',
                    }}>{t}</div>
                ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', ...chartStyle }}>
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

                {xLabels.length > 0 ? (
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
                ) : null}
            </div>

            {/* Right Y Axis Ticks */}
            {yScaleRight ? (
                <div style={{ 
                    display: 'flex',
                    position: 'relative',
                    width: `${yAxisWidth}px`, 
                    height: `${height}px`, 
                    marginTop: `${padding}px`,
                    ...yAxisStyleRight
                }}>
                    {yTicksRight.map((t: number) => (
                        <div key={t} style={{
                            display: 'flex',
                            position: 'absolute',
                            top: `${yScaleRight(t)}px`,
                            width: '100%',
                            height: '0px',
                            alignItems: 'center',
                            justifyContent: 'flex-start',
                            fontSize: theme.axisFontSize,
                            color: yAxisTextColorRight || theme.axisText,
                            fontWeight: yAxisTextColorRight ? 'bold' : 'normal',
                        }}>{t}</div>
                    ))}
                </div>
            ) : null}

            {/* Right Y Axis Label */}
            {yAxisLabelRight ? (
                <div style={{
                    display: 'flex',
                    width: '40px', // 從 40px 增加到 60px
                    height: `${height}px`,
                    marginTop: `${padding}px`,
                    marginLeft: '8px', // 增加與刻度的間距
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <div style={{
                        display: 'flex',
                        transform: 'rotate(90deg)',
                        whiteSpace: 'nowrap',
                        fontSize: theme.axisFontSize,
                        color: yAxisTextColorRight || theme.axisText,
                        fontWeight: 'bold',
                    }}>{yAxisLabelRight}</div>
                </div>
            ) : null}
        </div>
    );
};
