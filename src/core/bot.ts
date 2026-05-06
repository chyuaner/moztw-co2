import { Bot } from 'grammy';

export const createBot = (token: string) => {
  const bot = new Bot(token);

  // 初步的指令與訊息處理
  bot.command('start', (ctx) => ctx.reply('Welcome to Space API Bot!'));
  
  bot.on('message:text', (ctx) => {
    ctx.reply(`You said: ${ctx.message.text}`);
  });

  // 可以將更多 middleware 或邏輯拆分到其他檔案並在這裡引入
  return bot;
};
