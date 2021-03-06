import { AsyncStorage } from 'react-native';

export enum LogLevel {
  Off = 0,
  Critical,
  Warning,
  Info,
  Debug,
}

let logLevel = (__DEV__) ? LogLevel.Debug : LogLevel.Off;

export function setLogLevel(level: LogLevel) {
  if (!__DEV__) {
    logLevel = level;
  }
}

function shouldLog(messageLevel: LogLevel) {
  return messageLevel <= logLevel;
}

function logPrint(messageLevel: LogLevel, message: any) {
  if (!shouldLog(messageLevel)) {
    return;
  }

  switch (messageLevel) {
    case LogLevel.Critical:
    case LogLevel.Warning:
      console.warn(message);
      break;
    default:
      console.log(message);
  }
}

const logPrefix = '__logging_';

function logToBuffer(messageLevel: LogLevel, message: any) {
  if (!shouldLog(messageLevel)) {
    return;
  }

  AsyncStorage.setItem(`${logPrefix}${new Date().toISOString()}`, `[${LogLevel[messageLevel].substr(0, 1)}] ${message}`);
}

async function getLogKeys() {
  const keys = await AsyncStorage.getAllKeys();
  return keys.filter((key) => key.startsWith(logPrefix));
}

export async function getLogs() {
  const wantedKeys = await getLogKeys();
  if (wantedKeys.length === 0) {
    return [];
  }

  const wantedItems = await AsyncStorage.multiGet(wantedKeys);
  return wantedItems.sort(([a], [b]) => {
    const idxA = parseInt(a.substring(a.lastIndexOf('_') + 1, a.length));
    const idxB = parseInt(b.substring(b.lastIndexOf('_') + 1, b.length));
    return idxA - idxB;
  }).map(([_key, value]) => value);
}

export async function clearLogs() {
  const wantedKeys = await getLogKeys();
  if (wantedKeys.length === 0) {
    return;
  }
  await AsyncStorage.multiRemove(wantedKeys);
}

const logHandler = (__DEV__) ? logPrint : logToBuffer;

class Logger {
  public debug(message: any) {
    logHandler(LogLevel.Debug, message);
  }

  public info(message: any) {
    logHandler(LogLevel.Info, message);
  }

  public warn(message: any) {
    logHandler(LogLevel.Warning, message);
  }

  public critical(message: any) {
    logHandler(LogLevel.Critical, message);
  }
}

export const logger = new Logger();
