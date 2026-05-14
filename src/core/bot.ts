import { Bot, InputFile, InlineKeyboard } from 'grammy';
import { SwitchBot, SensorConfig } from './switchBot.js';
import { IStore } from './store.js';
import { ChartOg, Co2ChartOg, HumidityChartOg, SensorOg, TemperatureChartOg, TemperatureHumidityChartOg } from './og.js';
import { generalOgOptions } from './app.js';

export const createBot = (token: string, sensorsConfig: SensorConfig[], store?: IStore, baseUrl?: string, ImageResponse?: any) => {
  const bot = new Bot(token);

  // 初始化所有感測器
  const getSensors = () => sensorsConfig.map(cfg => new SwitchBot(cfg, store));

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp * 1000);
    const formatter = new Intl.DateTimeFormat('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'Asia/Taipei',
    });
    const parts = formatter.formatToParts(date);
    const p = (type: string) => parts.find(part => part.type === type)?.value;
    return `${p('year')}/${p('month')}/${p('day')} ${p('hour')}:${p('minute')}:${p('second')}`;
  };

  // 輔助函式：計算字串視覺顯示寬度，並向右補齊空白

  // 輔助函式：計算字串視覺顯示寬度，並向右補齊空白
  const padRight = (text: string, width: number = 22) => {
    let currentWidth = 0;
    for (const char of Array.from(text)) {
      // 如果是全形/中文字元或是 surrogate pair 的 emoji，大約佔用 2 的視覺寬度
      currentWidth += (char.match(/[^\x00-\xff]/) || char.length > 1) ? 2 : 1;
    }
    return text + ' '.repeat(Math.max(0, width - currentWidth));
  };

  // 指令：/co2 - 顯示所有資訊
  bot.command('co2', async (ctx) => {
    try {
      const sensors = getSensors();
      const messages = ['🏠 *摩茲工寮 空間目前資訊*'];
      const now = Math.floor(Date.now() / 1000);
      
      for (const s of sensors) {
        const data = await s.getAll();
        messages.push(`\n📍 *${s.name}*`);
        
        if (typeof data.temperature === 'number') {
          messages.push(`🌡 溫度：${data.temperature} °C`);
        }
        if (typeof data.humidity === 'number') {
          messages.push(`💧 濕度：${data.humidity} %`);
        }
        if (typeof data.co2 === 'number') {
          messages.push(`☁️ CO2：${data.co2} ppm`);
        }
        messages.push(`🕒 更新時間：${formatDate(s.lastchange || now)}`);
      }
      
      await ctx.reply(messages.join('\n'), { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('[Bot Error] /co2:', error);
      await ctx.reply('❌ 無法抓取空間資訊，請稍後再試。');
    }
  });

  bot.command('co2_help', async (ctx) => {
    const messages = ['🏠 <b>摩茲工寮 其他選項說明</b>'];
    messages.push('===================================');
    messages.push('/co2 - 目前的溫度、濕度、二氧化碳濃度');
    messages.push('/graph - 各項感測器的歷史圖表');
    messages.push('/co2_help - 查看所有選項');
    // 隱藏指令清單 (不顯示在選單上)
    messages.push('----------------------------------');
    messages.push('🔧 <b>隱藏指令 (直接輸入)：</b>');
    messages.push('/inside_temperature - 顯示「室內溫度」圖表');
    messages.push('/inside_humidity - 顯示「室內濕度」圖表');
    messages.push('/inside_co2 - 顯示「室內 CO2」圖表');
    messages.push('/balcony_temperature - 顯示「陽台溫度」圖表');
    messages.push('/balcony_humidity - 顯示「陽台濕度」圖表');
    messages.push('/corridor_temperature - 顯示「走廊溫度」圖表');
    messages.push('/corridor_humidity - 顯示「走廊濕度」圖表');
    await ctx.reply(messages.join('\n'), { parse_mode: 'HTML' });
  });

  const replyWithSensorChart = async (ctx: any, sensorId: string, type: 'temperature' | 'humidity' | 'co2'| 'temperature_humidity') => {
    try {
      const sensors = getSensors();
      const sensor = sensors.find((s: SwitchBot) => s.id === sensorId);
      if (!sensor) {
        await ctx.reply(`❌ Sensor ${sensorId} not found`);
        return;
      }

      const now = Math.floor(Date.now() / 1000);
      const data = await sensor.getAll();
      
      let valueStr = '';
      let chartComp: any;
      let typeLabel = '';

      if (type === 'temperature_humidity') {
        valueStr = `🌡 溫度：${data.temperature} °C 💧 濕度：${data.humidity} %`;
        chartComp = TemperatureHumidityChartOg;
        typeLabel = '溫度與濕度';
      } else if (type === 'temperature') {
        valueStr = `🌡 溫度：${data.temperature} °C`;
        chartComp = TemperatureChartOg;
        typeLabel = '溫度';
      } else if (type === 'humidity') {
        valueStr = `💧 濕度：${data.humidity} %`;
        chartComp = HumidityChartOg;
        typeLabel = '濕度';
      } else {
        valueStr = `☁️ CO2：${data.co2} ppm`;
        chartComp = Co2ChartOg;
        typeLabel = 'CO2';
      }

      const messages = [];
      messages.push(`📍 *${sensor.name}*`+'    '+ valueStr);
      messages.push(`🕒 更新時間：${formatDate(sensor.lastchange || now)}`);

      const historyData = await sensor.getHistoryByHours(6, 0);
      const title = `🏠摩茲工寮 ${sensor.name} 最近 6 小時內的 ${typeLabel}`;
      
      if (!ImageResponse) {
        return await ctx.reply('❌ 目前環境不支援直接生成圖片 (ImageResponse missing)');
      }
      
      const imgRes = new ImageResponse(chartComp({ datas: historyData, title }), generalOgOptions);

      await ctx.replyWithPhoto(new InputFile(imgRes.body), {
        caption: messages.join('\n'),
        parse_mode: "Markdown"
      });
    } catch (error) {
      console.error(`[Bot Error] /${type}:`, error);
      await ctx.reply('❌ 無法抓取空間資訊，請稍後再試。');
    }
  };

  // 指令：/graph - 顯示圖表選擇選單
  bot.command('graph', async (ctx) => {
    const keyboard = new InlineKeyboard()
      .text('🏠 室內', 'graph:inside:temperature_humidity')
      .text('🏠 室內溫度', 'graph:inside:temperature')
      .text('🏠 室內濕度', 'graph:inside:humidity')
      .text('🏠 室內 CO2', 'graph:inside:co2')
      .row()
      .text('🌳 陽台', 'graph:balcony:temperature_humidity')
      .text('🌳 陽台溫度', 'graph:balcony:temperature')
      .text('🌳 陽台濕度', 'graph:balcony:humidity')
      .row()
      .text('🚪 走廊', 'graph:corridor:temperature_humidity')
      .text('🚪 走廊溫度', 'graph:corridor:temperature')
      .text('🚪 走廊濕度', 'graph:corridor:humidity');

    await ctx.reply('📊 請選擇欲查看的圖表：', { reply_markup: keyboard });
  });

  // 處理圖表選擇的回呼
  bot.callbackQuery(/^graph:(.+):(.+)$/, async (ctx) => {
    const [, sensorId, type] = ctx.match;
    await ctx.answerCallbackQuery();
    // 移除選單訊息或更新它，這裡選擇直接發送圖表
    await replyWithSensorChart(ctx, sensorId, type as any);
  });

  // 隱藏指令：直接觸發特定圖表
  const hiddenCommands = [
    { command: 'inside_temperature_humidity', sensor: 'inside', type: 'temperature_humidity' },
    { command: 'inside_temperature', sensor: 'inside', type: 'temperature' },
    { command: 'inside_humidity', sensor: 'inside', type: 'humidity' },
    { command: 'inside_co2', sensor: 'inside', type: 'co2' },
    { command: 'balcony_temperature', sensor: 'balcony', type: 'temperature' },
    { command: 'balcony_humidity', sensor: 'balcony', type: 'humidity' },
    { command: 'corridor_temperature', sensor: 'corridor', type: 'temperature' },
    { command: 'corridor_humidity', sensor: 'corridor', type: 'humidity' },
  ];

  hiddenCommands.forEach(({ command, sensor, type }) => {
    bot.command(command, (ctx) => replyWithSensorChart(ctx, sensor, type as any));
  });


  bot.command('ogtest', async (ctx) => {
    try {
      const sensors = getSensors();
      const sensor = sensors.find(s => s.id === 'inside') || sensors[0];
      if (!sensor) return await ctx.reply('❌ 找不到感測器資訊');

      const domain = baseUrl || 'https://moztw-co2.yuaner.tw';
      const imageUrl = `${domain}/og/locations/${sensor.id}?t=${Date.now()}`;
      
      await ctx.replyWithPhoto(imageUrl, {
        caption: `✅ 圖片已生成 (URL 模式)\n📍 感測器：${sensor.name}\n🔗 網址：${imageUrl}`,
        parse_mode: "Markdown"
      });
    } catch (error) {
      console.error('[Bot Error] /ogtest:', error);
      await ctx.reply('❌ 產圖失敗，請稍後再試。');
    }
  });

  bot.command('ogtest2', async (ctx) => {
    try {
      if (!ImageResponse) {
        return await ctx.reply('❌ 目前環境不支援直接生成圖片 (ImageResponse missing)');
      }
      
      const sensors = getSensors();
      const sensor = sensors.find(s => s.id === 'inside') || sensors[0];
      if (!sensor) return await ctx.reply('❌ 找不到感測器資訊');

      const data = await sensor.getAll();
      const { id, name } = sensor;
      const { temperature, humidity, co2 } = data;

      const imgRes = new ImageResponse(SensorOg({id, name, temperature, humidity, co2}), generalOgOptions);

      await ctx.replyWithPhoto(new InputFile(imgRes.body), {
        caption: `✅ 圖片已生成 (直接渲染模式)\n📍 感測器：${sensor.name}\n🕒 資料時間：${formatDate(sensor.lastchange)}`,
        parse_mode: "Markdown"
      });
    } catch (error) {
      console.error('[Bot Error] /ogtest2:', error);
      await ctx.reply('❌ 直接產圖失敗，請稍後再試。');
    }
  });

  bot.command('ogtest3', async (ctx) => {
    try {
      if (!ImageResponse) {
        return await ctx.reply('❌ 目前環境不支援直接生成圖片 (ImageResponse missing)');
      }
      
      const sensors = getSensors();
      const sensor = sensors.find(s => s.id === 'inside') || sensors[0];
      if (!sensor) return await ctx.reply('❌ 找不到感測器資訊');

      const data = await sensor.getAll();
      const { id, name } = sensor;
      const { temperature, humidity, co2 } = data;

      const imgRes = new ImageResponse(ChartOg(), {
        width: 1280,
        height: 900,
        fonts: [{
          name: 'sans-serif',
          data: getFontData(),
          style: 'normal',
          weight: 400,
        }],
      });

      await ctx.replyWithPhoto(new InputFile(imgRes.body), {
        caption: `✅ 圖片已生成 (直接渲染模式)\n📍 感測器：${sensor.name}\n🕒 資料時間：${formatDate(sensor.lastchange)}`,
        parse_mode: "Markdown"
      });
    } catch (error) {
      console.error('[Bot Error] /ogtest2:', error);
      await ctx.reply('❌ 直接產圖失敗，請稍後再試。');
    }
  });

  // // 指令：/space_temperature - 僅顯示溫度
  // bot.command('space_temperature', async (ctx) => {
  //   try {
  //     const sensors = getSensors();
  //     let messages = [];
  //     for (const s of sensors) {
  //       const temp = await s.getTemperature();
  //       messages.push(`📍 *${s.name}*: 🌡 ${temp} °C`);
  //     }
  //     await ctx.reply(messages.join('\n'), { parse_mode: 'Markdown' });
  //   } catch (error) {
  //     console.error('[Bot Error] /space_temperature:', error);
  //     await ctx.reply('❌ 無法抓取溫度資訊。');
  //   }
  // });

  // // 指令：/space_humidity - 僅顯示濕度
  // bot.command('space_humidity', async (ctx) => {
  //   try {
  //     const sensors = getSensors();
  //     let messages = [];
  //     for (const s of sensors) {
  //       const humidity = await s.getHumidity();
  //       messages.push(`📍 *${s.name}*: 💧 ${humidity} %`);
  //     }
  //     await ctx.reply(messages.join('\n'), { parse_mode: 'Markdown' });
  //   } catch (error) {
  //     console.error('[Bot Error] /space_humidity:', error);
  //     await ctx.reply('❌ 無法抓取濕度資訊。');
  //   }
  // });

  // // 指令：/space_co2 - 僅顯示 CO2
  // bot.command('space_co2', async (ctx) => {
  //   try {
  //     const sensors = getSensors();
  //     let messages = [];
  //     for (const s of sensors) {
  //       const co2 = await s.getCo2();
  //       messages.push(`📍 *${s.name}*: ☁️ ${co2} ppm`);
  //     }
  //     await ctx.reply(messages.join('\n'), { parse_mode: 'Markdown' });
  //   } catch (error) {
  //     console.error('[Bot Error] /space_co2:', error);
  //     await ctx.reply('❌ 無法抓取 CO2 資訊。');
  //   }
  // });

  // // 過濾掉所有未被上方指令處理過的文字訊息
  // bot.on('message:text', async (ctx) => {
  //   // 只有在訊息不是指令時才提示
  //   if (!ctx.message.text.startsWith('/')) {
  //     await ctx.reply('請使用 /co2 指令');
  //   }
  // });

  return bot;
};
