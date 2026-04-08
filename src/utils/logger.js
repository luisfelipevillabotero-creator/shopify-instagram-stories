function timestamp() {
  return new Date().toISOString();
}

export const logger = {
  info(message, ...args) {
    console.log(`[${timestamp()}] [INFO] ${message}`, ...args);
  },
  warn(message, ...args) {
    console.warn(`[${timestamp()}] [WARN] ${message}`, ...args);
  },
  error(message, ...args) {
    console.error(`[${timestamp()}] [ERROR] ${message}`, ...args);
  },
};
