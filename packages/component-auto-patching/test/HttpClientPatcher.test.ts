import { expect } from 'chai';
import * as sinon from 'sinon';
import ComponentTrace from '@pandorajs/component-trace';
import ComponentAutoPatching from '../src/ComponentAutoPatching';
import { HttpClientPatcher } from '../src/patchers';
import { DEFAULT_PROTOCOL } from '../src/constants';
import { PandoraTracer } from '@pandorajs/tracer';
import { fork } from './TestUtil';
import * as semver from 'semver';
import { consoleLogger } from '@pandorajs/dollar';
import { URL } from 'url';

describe('ComponentAutoPatching -> HttpClientPatcher', function () {
  let autoPatching, componentTrace;

  before(async () => {
    const ctx = {
      logger: consoleLogger,
      config: {
        trace: {
          kTracer: PandoraTracer
        }
      }
    };
    componentTrace = new ComponentTrace(ctx);
    await componentTrace.start();
    Object.assign(ctx.config, {
      autoPatching: {
        patchers: {
          httpClient: {
            enabled: true,
            klass: HttpClientPatcher,
            forcePatchHttps: true
          }
        }
      }
    });
    autoPatching = new ComponentAutoPatching(ctx);
    await autoPatching.start();
  });

  it('should only load httpClient patcher', () => {
    const instances = autoPatching.instances;

    expect(instances.size).to.equal(1);
  });

  it('should not load httpClient patcher when enabled=false', async () => {
    await autoPatching.stop();

    const stub = sinon.stub(autoPatching, 'patchers').value({
      httpClient: {
        enabled: false,
        klass: HttpClientPatcher
      }
    });

    await autoPatching.start();

    let instances = autoPatching.instances;
    expect(instances.size).to.equal(0);

    await autoPatching.stop();
    stub.restore();
    await autoPatching.start();

    instances = autoPatching.instances;
    expect(instances.size).to.equal(1);
  });

  it('should create tracing span when request', (done) => {
    fork('http-client/HttpClient', done);
  });

  it('should create tracing span when request with string url in node.js v10', (done) => {
    if (semver.satisfies(process.version, '10')) {
      fork('http-client/HttpClientWithStringUrl', done);
    } else {
      console.log('skip http-client args test for node.js v10');
      done();
    }
  });

  it('should create tracing span when request with URL in node.js v10', (done) => {
    if (semver.satisfies(process.version, '10')) {
      fork('http-client/HttpClientWithUrl', done);
    } else {
      console.log('skip http-client args test for node.js v10');
      done();
    }
  });

  it('should work well when parse string url use URL error', () => {
    const httpClientPatcher = autoPatching.instances.get('httpClient');

    const spy = sinon.spy(consoleLogger, 'info');
    httpClientPatcher.argsCompatible('abc');
    expect(spy.calledWith(sinon.match('[HttpClientPatcher] URL parse failed, use origin parse.'))).to.be.true;
    spy.restore();
  });

  it('should argsCompatible work well with URL instance', () => {
    const httpClientPatcher = autoPatching.instances.get('httpClient');

    const options = httpClientPatcher.argsCompatible(new URL('http://www.taobao.com/'));
    expect(options.hostname).to.equal('www.taobao.com');
  });

  it('should use _defaultAgent port when port undefined and agent exist', () => {
    const httpClientPatcher = autoPatching.instances.get('httpClient');

    const tags = httpClientPatcher.staticTags({
      _defaultAgent: {
        defaultPort: 8080
      }
    });

    expect(tags['http.port']).to.equal(8080);
  });

  it('should get remoteIp use socket', () => {
    const httpClientPatcher = autoPatching.instances.get('httpClient');
    const tags = {};

    httpClientPatcher._handleResponse({
      setTag(key, value) {
        tags[key] = value;
      }
    }, {
      socket: {
        remoteAddress: '127.0.0.1',
        remotePort: 80
      }
    });

    expect(tags[httpClientPatcher.tagName('remote_ip')]).to.equal('127.0.0.1:80');
  });

  it('should not get remoteIp when socket is null', () => {
    const httpClientPatcher = autoPatching.instances.get('httpClient');
    const tags = {};

    httpClientPatcher._handleResponse({
      setTag(key, value) {
        tags[key] = value;
      }
    }, {});

    expect(tags[httpClientPatcher.tagName('remote_ip')]).to.equal('');
  });

  it('should getFullUrl work well', () => {
    const httpClientPatcher = autoPatching.instances.get('httpClient');

    let res = httpClientPatcher.getFullUrl(new URL('http://www.taobao.com/'), DEFAULT_PROTOCOL);
    expect(res).to.equal('http://www.taobao.com/');

    res = httpClientPatcher.getFullUrl({
      _defaultAgent: {
        protocol: 'https:'
      }
    }, DEFAULT_PROTOCOL);

    expect(res).to.equal('https://localhost/');

    res = httpClientPatcher.getFullUrl({
      _defaultAgent: {}
    }, DEFAULT_PROTOCOL);

    expect(res).to.equal('http://localhost/');

    res = httpClientPatcher.getFullUrl(new URL('http://www.taobao.com:8080/'), DEFAULT_PROTOCOL);

    expect(res).to.equal('http://www.taobao.com:8080/');
  });

  it('should work well without span', () => {
    const httpClientPatcher = autoPatching.instances.get('httpClient');

    expect(httpClientPatcher.handleRequestError(null)).not.throw;

    const stub = sinon.stub(httpClientPatcher, 'options').value({
      recordResponse: false
    });

    expect(httpClientPatcher.recordResponse(null)).not.throw;

    stub.restore();
  });

  it('should remote tracing work', (done) => {
    fork('http-client/HttpClientTracing', done);
  });

  it('should record full url', (done) => {
    fork('http-client/HttpClientFullUrl', done);
  });

  it('should work well when remote tracing throw error', (done) => {
    fork('http-client/HttpClientTracingError', done);
  });

  it('should handle request error', (done) => {
    fork('http-client/HttpClientError', done);
  });

  it('should handle response data event', (done) => {
    fork('http-client/HttpClientResponse', done);
  });

  it('should handle response data event with custom transformer', (done) => {
    fork('http-client/HttpClientCustomResponse', done);
  });

  it('should handle response data event with max size limit', (done) => {
    fork('http-client/HttpClientResponseSizeMax', done);
  });

  it('should work well when custom transformer throw error', (done) => {
    fork('http-client/HttpClientCustomResponseError', done);
  });

  it('should use header content-length as response size', (done) => {
    fork('http-client/HttpClientResponseSize', done);
  });

  it('should not create span when no tracer', (done) => {
    fork('http-client/HttpClientNoTracer', done);
  });

  it('should work with https', (done) => {
    fork('http-client/HttpClientWithHttps', done);
  });
});
