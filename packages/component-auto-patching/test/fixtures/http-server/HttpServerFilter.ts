import { Fixture, sleep } from '../../TestUtil';
import { HttpServerPatcher } from '../../../src/patchers';
import * as sinon from 'sinon';
import * as assert from 'assert';
import { SPAN_FINISHED } from '@pandorajs/component-trace';
import { consoleLogger } from '@pandorajs/dollar';

export default class HttpServerFixture extends Fixture {

  config() {

    return {
      patchers: {
        httpServer: {
          enabled: true,
          klass: HttpServerPatcher,
          requestFilter: function requestFilter(req) {
            const url = req.url;
            return url.indexOf('ignore') > -1;
          }
        }
      }
    };
  }

  async case(done) {
    const http = require('http');
    const urllib = require('urllib');

    const stub = sinon.stub(this.componentTrace.traceManager, 'record').callsFake(function(span, isEntry) {
      assert(span);
      assert(isEntry);

      span.on(SPAN_FINISHED, (s) => {
        assert(s.duration >= 100);
        done();
      });
    });

    const spy = sinon.spy(consoleLogger, 'info');

    const server = http.createServer(function(req, res) {
      setTimeout(() => {
        assert(spy.calledWith(sinon.match('[HttpServerPatcher] request filter by requestFilter, skip trace.')));
        spy.restore();
        res.end('OK');
      },  Math.floor(1 + Math.random() * 10) * 100);
    });

    server.listen(0);

    sleep(1000);

    const port = server.address().port;
    await urllib.request(`http://localhost:${port}/ignore`);
    await urllib.request(`http://localhost:${port}`);

    stub.restore();
  }
}
