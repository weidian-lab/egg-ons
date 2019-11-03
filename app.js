'use strict';

const ONS = require('./lib/ons');

class AppBootHook {
  constructor(app) {
    app.ons = new ONS(app);
    this.app = app;
  }
  async didLoad() {
    await this.app.ons.init();
  }
  async beforeClose() {
    const { app } = this;
    app.ons.logger.info('[egg-ons] beforeClose');
    await Promise.all(app.ons.consumers.map(consumer => {
      return consumer.safeClose();
    }));
    app.ons.logger.info('[egg-ons] closed');
  }
}

module.exports = AppBootHook;
