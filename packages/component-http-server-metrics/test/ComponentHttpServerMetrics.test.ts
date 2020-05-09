import {expect} from 'chai';
import {ComponentReflector, IComponentConstructor} from '@pandorajs/component-decorator';
import ComponentHttpServerMetrics, {MetricsStat} from '../src/ComponentHttpServerMetrics';
import { MetricsServerManager } from 'metrics-common';
import * as mm from 'mm';

describe('ComponentHttpServerMetrics', () => {

  it('should have correct meta info', () => {
    expect(ComponentReflector.getComponentName(<IComponentConstructor> ComponentHttpServerMetrics)).to.be.equal('httpServerMetrics');
    expect(ComponentReflector.getDependencies(<IComponentConstructor> ComponentHttpServerMetrics)).to.deep.equal(['metrics']);
  });

  it('should recordRequest() be ok', () => {
    const fakeMetricsManager = new MetricsServerManager;
    const ctx: any = {
      metricsManager: fakeMetricsManager,
      mode: 'worker',
    };
    const componentHttpServerMetrics: ComponentHttpServerMetrics = new ComponentHttpServerMetrics(ctx);
    componentHttpServerMetrics.recordRequest({
      resultCode: '200',
      rt: 50
    });
    componentHttpServerMetrics.recordRequest({
      resultCode: '200',
      rt: 25
    });
    componentHttpServerMetrics.recordRequest({
      resultCode: '500',
      rt: 25
    });
    componentHttpServerMetrics.recordRequest({
      resultCode: '500',
      rt: 60
    });
    const globalCompass = fakeMetricsManager.getFastCompass(MetricsStat.HTTP_GROUP, MetricsStat.HTTP_REQUEST);
    const value = globalCompass.getMethodRtPerCategory();
    const success = value.get('success');
    const rtTotalSucc = success.get(Array.from(success.keys())[0]);
    expect(rtTotalSucc.toString()).to.be.equal('75');
    const error = value.get('error');
    const rtTotalErr = error.get(Array.from(error.keys())[0]);
    expect(rtTotalErr.toString()).to.be.equal('85');
  });

  it('should skip pandora-agent and agent_worker', () => {
    const fakeMetricsManager = new MetricsServerManager;
    let componentHttpServerMetrics: ComponentHttpServerMetrics = new ComponentHttpServerMetrics({
      metricsManager: fakeMetricsManager,
      mode: 'supervisor',
    });
    expect(componentHttpServerMetrics.globalCompass).to.be.undefined;
    mm(process, 'argv', ['', '/path/to/executable/agent_worker.js']);
    componentHttpServerMetrics = new ComponentHttpServerMetrics({
      metricsManager: fakeMetricsManager,
      mode: 'worker',
    });
    expect(componentHttpServerMetrics.globalCompass).to.be.undefined;
    mm.restore();
  });
});
