import { Bot, InputFile } from 'grammy';
import { SwitchBot, SensorConfig } from './switchBot.js';
import { IStore } from './store.js';
import { ChartOg, SensorOg } from './og.js';

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

      const imgRes = new ImageResponse(SensorOg({id, name, temperature, humidity, co2}), 
      {
        width: 1200,
        height: 630,
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

      const imgRes = new ImageResponse(ChartOg(), 
      {
        width: 1200,
        height: 630,
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
