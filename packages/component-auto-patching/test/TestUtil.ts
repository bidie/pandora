import * as path from 'path';
import * as childProcess from 'child_process';
import ComponentTrace from '@pandorajs/component-trace';
import ComponentAutoPatching from '../src/ComponentAutoPatching';
import ComponentErrorLog from '@pandorajs/component-error-log';
import { PandoraTracer } from '@pandorajs/tracer';
import { find } from 'lodash';
import { consoleLogger } from '@pandorajs/dollar';

export function fork(name, done) {
  const filePath = require.resolve(path.join(__dirname, `fixtures/${name}`));
  const worker = childProcess.fork(path.join(__dirname, 'fixtures/FixtureRunner'), <any>{
    env: {
      ...process.env,
      NODE_ENV: 'test',
      fixturePath: filePath
    },
    execArgv: [
      '-r', 'ts-node/register',
      '-r', 'nyc-ts-patch'
    ]
  });
  worker.on('message', (data) => {
    if (data === 'done') {
      worker.kill();
      done();
    }
  });
}

export class Fixture {
  static instance = null;
  componentTrace = null;
  autoPatching = null;
  componentErrorLog = null;

  static async run() {
    if (!this.instance) {
      this.instance = new this;
      await this.instance.init();
    }

    try {
      await this.instance.case(this.done);
    } catch (error) {
      console.error(error);
      process.send(error.toString());
    }
  }

  static done() {
    process.send('done');
  }

  async init() {
    const ctx: any = {
      logger: consoleLogger,
      endPointManager: { register() {} },
      indicatorManager: { register() {} },
      config: {
        trace: {
          kTracer: PandoraTracer
        },
        errorLog: {}
      }
    };

    this.componentErrorLog = new ComponentErrorLog(ctx);
    ctx.errorLogManager = this.componentErrorLog.errorLogManager;
    this.componentTrace = new ComponentTrace(ctx);
    Object.assign(ctx.config, {
      autoPatching: this.config()
    });
    this.autoPatching = new ComponentAutoPatching(ctx);

    await this.componentTrace.start();
    await this.autoPatching.start();
  }

  config() {
    throw new Error('config is need.');
  }

  async case(done: Function) {}
}

export async function sleep(ms: number) {

  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function request(agent, options) {
  return new Promise((resolve, reject) => {
    const req = agent.request(options, (res) => {
      let data = '';

      res.on('data', (d) => {
        data += d;
      });

      res.on('end', () => {
        resolve([res, data]);
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.end();
  });
}

export function requestUrl(agent, url, options) {
  return new Promise((resolve, reject) => {
    const req = agent.request(url, options, (res) => {
      let data = '';

      res.on('data', (d) => {
        data += d;
      });

      res.on('end', () => {
        resolve([res, data]);
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.end();
  });
}

export function extractLog(logs: [], key: string): string {
  let i = 0;
  logs = logs || [];

  for (i; i < logs.length; i++) {
    const log = find((<any>logs[i]).fields, ['key', key]);

    if (log) {
      return log.value;
    }
  }

  return null;
}
