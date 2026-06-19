import { SensorDataRecord } from './switchBot.js';

/**
 * 將單一感測器的 SensorDataRecord 轉換為 SpaceAPI 格式的物件
 */
export const formatSpaceApi = (id: string, name: string, data: SensorDataRecord) => {
  const now = Math.floor(Date.now() / 1000);
  const result: {
    temperature?: any;
    humidity?: any;
    carbondioxide?: any;
    door_locked?: any;
  } = {};

  if (typeof data.temperature === 'number') {
    result.temperature = {
      value: data.temperature,
      unit: '°C',
      location: id,
      name: name,
      lastchange: data.temperature_lastchange || data.lastchange || now,
    };
  }

  if (typeof data.humidity === 'number') {
    result.humidity = {
      value: data.humidity,
      unit: '%',
      location: id,
      name: name,
      lastchange: data.humidity_lastchange || data.lastchange || now,
    };
  }

  if (typeof data.co2 === 'number') {
    result.carbondioxide = {
      value: data.co2,
      unit: 'ppm',
      location: id,
      name: name,
      lastchange: data.co2_lastchange || data.lastchange || now,
    };
  }

  if (typeof data.isOpen === 'boolean') {
    result.door_locked = {
      value: !data.isOpen,
      location: id,
      name: name,
      lastchange: data.isOpen_lastchange || data.lastchange || now,
    };
  }

  return result;
};
