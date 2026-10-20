import { getNodeSensorDB } from '../src/core/db/node.js';

async function main() {
  console.log('🔍 正在測試 SQLite 查詢功能...');
  const db = getNodeSensorDB();

  // 1. 測試讀取當前快照
  const indoor = await db.getCurrent('B0E9FEF087CD');
  console.log('✅ 室內當前快照:', {
    temperature: indoor?.temperature,
    humidity: indoor?.humidity,
    co2: indoor?.co2,
    lastchange: indoor?.lastchange,
  });

  // 2. 測試歷史分頁
  const history = await db.getHistory('B0E9FEF087CD', { limit: 3 });
  console.log(`✅ 歷史紀錄 (前 ${history.length} 筆):`);
  history.forEach((h, i) => {
    console.log(`  [${i + 1}] 時間: ${h.lastchange}, 溫度: ${h.temperature}°C, CO2: ${h.co2}ppm`);
  });

  // 3. 測試時間範圍查詢
  const rangeHistory = await db.getHistory('B0E9FEF087CD', {
    minTimestamp: 1778400000,
    maxTimestamp: 1778600000,
  });
  console.log(`✅ 時間範圍查詢 (1778400000 ~ 1778600000): 找到 ${rangeHistory.length} 筆`);

  console.log('🎉 SQLite 驅動測試完全通過！');
}

main().catch(err => {
  console.error('❌ 測試失敗:', err);
  process.exit(1);
});
