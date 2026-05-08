import { Bot } from 'grammy';
import { SwitchBot, SensorConfig } from './switchBot.js';
import { IStore } from './store.js';

export const createBot = (token: string, sensorsConfig: SensorConfig[], store?: IStore) => {
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
    return ` （${p('year')}/${p('month')}/${p('day')} ${p('hour')}:${p('minute')}:${p('second')}）`;
  };

  // 輔助函式：計算字串視覺顯示寬度，並向右補齊空白
  const padRight = (text: string, width: number = 22) => {
    let currentWidth = 0;
    for (const char of Array.from(text)) {
      // 如果是全形/中文字元或是 surrogate pair 的 emoji，大約佔用 2 的視覺寬度
      currentWidth += (char.match(/[^\x00-\xff]/) || char.length > 1) ? 2 : 1;
    }
    return text + ' '.repeat(Math.max(0, width - currentWidth));
  };

  // 指令：/space - 顯示所有資訊
  bot.command('co2', async (ctx) => {
    try {
      const sensors = getSensors();
      const messages = ['🏠 *空間目前資訊*'];
      const now = Math.floor(Date.now() / 1000);
      
      for (const s of sensors) {
        const data = await s.getAll();
        messages.push(`\n📍 *${s.name}*`);
        
        if (typeof data.temperature === 'number') {
          messages.push(`${padRight(`🌡 溫度：${data.temperature} °C`)}${formatDate(s.lastchangeTemperature || now)}`);
        }
        if (typeof data.humidity === 'number') {
          messages.push(`${padRight(`💧 濕度：${data.humidity} %`)}${formatDate(s.lastchangeHumidity || now)}`);
        }
        if (typeof data.co2 === 'number') {
          messages.push(`${padRight(`☁️ CO2：${data.co2} ppm`)}${formatDate(s.lastchangeCo2 || now)}`);
        }
      }
      
      await ctx.reply(messages.join('\n'), { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('[Bot Error] /co2:', error);
      await ctx.reply('❌ 無法抓取空間資訊，請稍後再試。');
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

  // 過濾掉所有未被上方指令處理過的文字訊息
  bot.on('message:text', async (ctx) => {
    // 只有在訊息不是指令時才提示
    if (!ctx.message.text.startsWith('/')) {
      await ctx.reply('請使用 /co2 指令');
    }
  });

  return bot;
};
