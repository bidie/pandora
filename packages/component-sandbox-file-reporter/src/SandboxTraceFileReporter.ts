import {
  FileLoggerManager,
  ILogger,
} from '@pandorajs/component-file-logger-service';
import * as tracing from '@opentelemetry/tracing';
import { hrTimeToMilliseconds } from './util';

export class SandboxTraceFileReporter implements tracing.SpanExporter {
  type = 'trace';
  logger: ILogger;
  constructor(private ctx: any) {
    const { sandboxFileReporter: config } = ctx.config;
    const fileLoggerManager: FileLoggerManager = this.ctx.fileLoggerManager;
    this.logger = fileLoggerManager.createLogger('sandbox-traces', {
      ...config.trace,
      dir: config.logsDir,
    });
  }

  /**
   * @param spans
   */
  export(spans: tracing.ReadableSpan[]) {
    const globalTags = this.getGlobalTags();
    for (const it of spans) {
      this.logger.log(
        'INFO',
        [
          JSON.stringify({
            traceId: it.spanContext.traceId,
            spanId: it.spanContext.spanId,
            parentId: it.parentSpanId,
            name: it.name,
            status: it.status,
            startTime: hrTimeToMilliseconds(it.startTime),
            duration: hrTimeToMilliseconds(it.duration),
            kind: it.kind,
            links: it.links,
            attributes: it.attributes,
            events: it.events,
            // TODO: User data
            ...globalTags,
          }),
        ],
        { raw: true }
      );
    }
  }

  shutdown() {}

  getGlobalTags() {
    const { sandboxFileReporter: config } = this.ctx.config;
    return config.globalTags;
  }
}
