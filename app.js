'use strict';

const assert = require('assert');
const ONS = require('./lib/ons');
const { unSubscribe, getProcessCount } = require('./lib/utils');
const { sleep } = require('pure-func/promise');

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
    const consumers = [ ...app.ons.consumerMap.values() ];
    const producers = [ ...app.ons.producerMap.values() ];
    unSubscribe(consumers);
    await sleep(1000);
    let processCount = getProcessCount(consumers);
    while (processCount > 0) {
      await sleep(processCount * 100);
      processCount = getProcessCount(consumers);
    }
    await Promise.all(consumers.map(async consumer => {
      await consumer.close();
      app.ons.logger.info('[egg-ons] consumer: %s is closed, messageModel: %s', consumer.consumerGroup, consumer.messageModel);
    }));
    await Promise.all(producers.map(async producer => {
      await producer.close();
      app.ons.logger.info('[egg-ons] producer: %s is closed', producer.producerGroup);
    }));
  }
}

module.exports = AppBootHook;
