'use strict';

const ONS = require('./lib/ons');

class AppBootHook {
  constructor(app) {
    app.ons = new ONS(app);
    this.app = app;
  }

  async didLoad() {
    await this.app.ons.init();
    this.app.coreLogger.info('[egg-ons] inited');
  }

  async didReady() {
    await new Promise((resolve, reject) => {
      setTimeout(() => {
        this.app.coreLogger.info('[egg-ons] initConsumer');
        this.app.ons.initConsumer().then(resolve).catch(reject);
      }, 1000);
    });
  }

  async beforeClose() {
    const { app } = this;
    app.coreLogger.info('[egg-ons] beforeClose');
    await Promise.all(app.ons.consumers.map(consumer => {
      return consumer.safeClose();
    }));
    app.coreLogger.info('[egg-ons] closed');
  }
}

module.exports = AppBootHook;
