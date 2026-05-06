import { Bot } from 'grammy';
import { SwitchBot } from './switchBot.js';

export interface SwitchBotConfig {
  deviceId: string;
  token: string;
  secret: string;
}

export const createBot = (token: string, config: SwitchBotConfig) => {
  const bot = new Bot(token);

  // 初始化 SwitchBot
  const getSwitchBot = () => new SwitchBot(config.deviceId, config.token, config.secret);

  // 指令：/space - 顯示所有資訊
  bot.command('space', async (ctx) => {
    try {
      const sb = getSwitchBot();
      const data = await sb.getAll();
      const message = [
        '🏠 *空間目前資訊*',
        '------------------',
        `🌡 溫度：${data.temperature} °C`,
        `💧 濕度：${data.humidity} %`,
        `☁️ CO2：${data.co2} ppm`,
      ].join('\n');
      
      await ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (error) {
      await ctx.reply('❌ 無法抓取空間資訊，請稍後再試。');
    }
  });

  // 指令：/space_temperature - 僅顯示溫度
  bot.command('space_temperature', async (ctx) => {
    try {
      const sb = getSwitchBot();
      const temp = await sb.getTemperature();
      await ctx.reply(`🌡 目前溫度：${temp} °C`);
    } catch (error) {
      await ctx.reply('❌ 無法抓取溫度資訊。');
    }
  });

  // 指令：/space_humidity - 僅顯示濕度
  bot.command('space_humidity', async (ctx) => {
    try {
      const sb = getSwitchBot();
      const humidity = await sb.getHumidity();
      await ctx.reply(`💧 目前濕度：${humidity} %`);
    } catch (error) {
      await ctx.reply('❌ 無法抓取濕度資訊。');
    }
  });

  // 指令：/space_co2 - 僅顯示 CO2
  bot.command('space_co2', async (ctx) => {
    try {
      const sb = getSwitchBot();
      const co2 = await sb.getCo2();
      await ctx.reply(`☁️ 目前 CO2 濃度：${co2} ppm`);
    } catch (error) {
      await ctx.reply('❌ 無法抓取 CO2 資訊。');
    }
  });

  return bot;
};
