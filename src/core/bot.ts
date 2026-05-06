import { Bot } from 'grammy';
import { SwitchBot, SensorConfig } from './switchBot.js';

export const createBot = (token: string, sensorsConfig: SensorConfig[]) => {
  const bot = new Bot(token);

  // 初始化所有感測器
  const getSensors = () => sensorsConfig.map(cfg => new SwitchBot(cfg));

  // 指令：/space - 顯示所有資訊
  bot.command('co2', async (ctx) => {
    try {
      const sensors = getSensors();
      const messages = ['🏠 *空間目前資訊*'];
      
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
