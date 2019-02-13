import { Fixture, sleep, extractLog } from '../../TestUtil';
import { HttpServerPatcher, MySQLPatcher, MySQLWrapper } from '../../../src/patchers';
import * as sinon from 'sinon';
import * as assert from 'assert';
import * as pedding from 'pedding';
import { SPAN_FINISHED } from 'pandora-component-trace';

export default class MySQLFixture extends Fixture {

  config() {

    return {
      patchers: {
        httpServer: {
          enabled: true,
          klass: HttpServerPatcher
        },
        mySQL: {
          enabled: true,
          klass: MySQLPatcher,
          kWrapper: MySQLWrapper,
          recordDatabaseName: true,
          recordInstance: true
        }
      }
    };
  }

  async case(done) {
    const http = require('http');
    const urllib = require('urllib');
    const mysql = require('mysql');
    const _done = pedding(done, 2);

    const stub = sinon.stub(this.componentTrace.traceManager, 'record').callsFake(function(span, isEntry) {
      const context = span.context();
      assert(context.traceId === '1234567890');

      span.once(SPAN_FINISHED, (s) => {
        assert(s.duration > 0);
        const logs = s.logs;
        const error = extractLog(logs, 'error');
        assert(!error);
        _done();
      });
    });

    const server = http.createServer(function(req, res) {
      setTimeout(() => {
        const connection = mysql.createConnection({
          port: 32893
        });

        connection.connect();

        connection.query('SELECT 1', function(err, row, fields) {
          connection.end();
          res.end('ok');
        });
      },  Math.floor(1 + Math.random() * 10) * 100);
    });

    server.listen(0);

    sleep(1000);

    const port = server.address().port;

    await urllib.request(`http://localhost:${port}/?test=query`, {
      headers: {
        'x-trace-id': '1234567890'
      }
    });

    stub.restore();
  }
}
