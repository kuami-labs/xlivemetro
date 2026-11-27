import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  it('répond ok', () => {
    expect(new HealthController().check()).toEqual({ status: 'ok' });
  });
});
