import { createLogger, format, transports } from "winston";
import chalk from "chalk";
import { getContext } from "../trpc/contextList";

export const loggerInfo = (message: string) => {
  const ctx = getContext();

  logger.info(message, ctx && { ...ctx, step: ctx.step++ });
}

export const loggerDebug = (message: string) => {
  const ctx = getContext();

  logger.debug(message, ctx && { ...ctx, step: ctx.step++ });
}

export const loggerError = (message: string) => {
  const ctx = getContext();

  logger.error(message, ctx && { ...ctx, step: ctx.step++ });
}

export const loggerWarn = (message: string) => {
  const ctx = getContext();

  logger.warn(message, ctx && { ...ctx, step: ctx.step++ });
}

export const logger = createLogger({
  level: 'debug',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.json()
  ),
  transports: [
    new transports.Console({
      format: format.combine(
        format.printf(({ level, message, timestamp, ...metadata }) => {
          const {
            requestId,
            userAgent,
            ipAddress,
            type,
            path,
            input,
            step
          } = metadata;

          // Prefix process
          const finnalTimestamp = chalk.cyan(`[${timestamp}]`);

          let finnalLevel: string | null | undefined = level;

          finnalLevel = `[${finnalLevel.toUpperCase()}]`;

          finnalLevel = {
            error: chalk.red(finnalLevel),
            warn: chalk.yellow(finnalLevel),
            info: chalk.green(finnalLevel),
            debug: chalk.blue(finnalLevel)
          }[level];

          const finnalType = chalk.bgBlue(`[${(type as string)?.toUpperCase() ?? null}]`);

          const finnalPath = chalk.bgBlue(`[${(path as string) ?? null}]`);

          const finnalRequestId = chalk.bgBlue(`[${requestId ?? null}]`);

          const finnalStep = step ? chalk.bgBlueBright(`[${step}]`) + ' ' : '';

          const finnalPrefix = `${finnalTimestamp} ${finnalLevel} ${finnalType} ${finnalPath} ${finnalRequestId} ${finnalStep}`;

          // Message process
          let finnalMessage = message;

          if (level === "error") {
            const code = metadata.code;

            const name = metadata.name;

            finnalMessage = `${name ? chalk.red(`${name}`) : ''} ${code ? chalk.red(`${code}`) : ''} ${message}`;
          }

          // Metadata process
          const finnalMetaObj = JSON.stringify({
            input: input ?? null,
            ctx: {
              userAgent: userAgent ?? null,
              ipAddress: ipAddress ?? null,
            }
          }, null, 2);

          const coloredMetadata = chalk.gray(`[Metadata] ${finnalMetaObj}`);

          const finnalMetadata = metadata ? `\n${coloredMetadata}` : '';

          // Additional process

          let finnalAdditional = null;

          if (level === "error") {
            const cause = metadata.cause;

            const coloredCause = chalk.gray(`[Cause] ${JSON.stringify(cause, null, 2) ?? "null"}`);

            const stack = metadata.stack;

            const coloredStack = chalk.gray(`[Stack] ${stack ?? "null"}`);

            finnalAdditional = `${`\n${coloredCause}`}${`\n${coloredStack}`}`;
          }

          finnalAdditional = finnalAdditional ?? '';


          return `${finnalPrefix}${finnalMessage}${finnalMetadata}${finnalAdditional}`;
        })
      ),
    })
  ],
});