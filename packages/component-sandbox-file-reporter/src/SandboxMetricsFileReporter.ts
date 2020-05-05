import {FileLoggerManager} from 'pandora-component-file-logger-service';
import {join} from 'path';
import {FileReporterUtil} from './FileReporterUtil';


export class SandboxMetricsFileReporter {
  type = 'metrics';
  ctx: any;
  logger: any;
  constructor(ctx: any) {
    this.ctx = ctx;
    const {appName} = ctx;
    const {sandboxFileReporter: config} = ctx.config;
    const fileLoggerManager: FileLoggerManager = this.ctx.fileLoggerManager;
    this.logger = fileLoggerManager.createLogger('sandbox-metrics', {
      ...config.metrics,
      dir: join(config.logsDir, appName)
    });
  }
  async report (data: any[]): Promise<void> {
    const globalTags = this.getGlobalTags();
    for(const metricObject of data) {
      this.logger.log('INFO', [JSON.stringify({
        ...metricObject,
        ...globalTags,
        tags: {
          ...metricObject.tags,
          ...globalTags
        },
        unix_timestamp: FileReporterUtil.unix(metricObject.timestamp),
      })], { raw: true });
    }
  }
  getGlobalTags() {
    const {sandboxFileReporter: config} = this.ctx.config;
    return config.globalTags;
  }
}
