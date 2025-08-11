const fs = require('fs');
const path = require('path');

// Define log levels
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

class Logger {
  constructor() {
    this.logLevel = this.getLogLevel();
    this.logDir = path.join(process.cwd(), 'logs');
    this.ensureLogDirectory();
  }

  getLogLevel() {
    const level = (process.env.LOG_LEVEL || 'info').toUpperCase();
    return LOG_LEVELS[level] !== undefined ? LOG_LEVELS[level] : LOG_LEVELS.INFO;
  }

  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...meta
    };

    return JSON.stringify(logEntry);
  }

  writeToFile(level, formattedMessage) {
    if (process.env.NODE_ENV === 'production') {
      const filename = `${level.toLowerCase()}-${new Date().toISOString().split('T')[0]}.log`;
      const filepath = path.join(this.logDir, filename);

      fs.appendFile(filepath, formattedMessage + '\n', (err) => {
        if (err) console.error('Failed to write log:', err);
      });
    }
  }

  log(level, message, meta = {}) {
    const levelValue = LOG_LEVELS[level];

    if (levelValue <= this.logLevel) {
      const formattedMessage = this.formatMessage(level, message, meta);

      // Console output with colors
      this.consoleLog(level, message, meta);

      // File output for production
      this.writeToFile(level, formattedMessage);
    }
  }

  consoleLog(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const colors = {
      ERROR: '\x1b[31m', // Red
      WARN: '\x1b[33m',  // Yellow
      INFO: '\x1b[36m',  // Cyan
      DEBUG: '\x1b[37m'  // White
    };

    const resetColor = '\x1b[0m';
    const color = colors[level] || colors.INFO;

    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    const logMessage = `${color}[${timestamp}] ${level}:${resetColor} ${message}${metaStr}`;

    console.log(logMessage);
  }

  error(message, meta = {}) {
    this.log('ERROR', message, meta);
  }

  warn(message, meta = {}) {
    this.log('WARN', message, meta);
  }

  info(message, meta = {}) {
    this.log('INFO', message, meta);
  }

  debug(message, meta = {}) {
    this.log('DEBUG', message, meta);
  }

  // HTTP request logging
  logRequest(req, res, responseTime) {
    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      responseTime: `${responseTime}ms`,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    };

    if (res.statusCode >= 400) {
      this.error('HTTP Request Error', logData);
    } else {
      this.info('HTTP Request', logData);
    }
  }

  // Database operation logging
  logDatabaseOperation(operation, table, duration, success = true, error = null) {
    const logData = {
      operation,
      table,
      duration: `${duration}ms`,
      success
    };

    if (error) {
      logData.error = error.message;
      this.error('Database Operation Failed', logData);
    } else {
      this.debug('Database Operation', logData);
    }
  }
}

module.exports = new Logger();
