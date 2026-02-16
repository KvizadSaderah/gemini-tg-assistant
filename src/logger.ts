import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return `${timestamp} [${level.toUpperCase()}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ""}`;
  })
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: process.env.LOG_FORMAT === "json" ? winston.format.json() : logFormat,
  transports: [
    new winston.transports.Console(),
    new DailyRotateFile({
      filename: "logs/application-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxSize: "5m",
      maxFiles: "14d",
    }),
  ],
});

export default logger;
