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
  async willReady() {
    const { app } = this;
    const consumerKeys = [ ...app.ons.consumerMap.keys() ];
    for (const sub of app.config.ons.sub) {
      for (const topic of sub.topics) {
        if (!topic.indexOf('%')) {
          continue;
        }
        const consumer = app.ons.consumerMap.get(
          consumerKeys.find(key => key.includes(sub.consumerGroup))
        );
        if (!consumer) {
          continue;
        }
        await consumer.ready();
        const subscribeKey = topic.split('%')[1];
        const Subscriber = app.ONSSubscribers[subscribeKey];
        assert.ok(Subscriber);
        app.logger.info('subscribe ', topic, Subscriber.subExpression || '*');
        consumer.subscribe(topic, Subscriber.subExpression || '*', async msg => {
          const subscriber = new Subscriber(app);
          subscriber.ctx = app.createAnonymousContext({
            url: '/ons/' + topic + '/' + msg.tags + '/' + (msg.body.length < 50 ? msg.body.toString() : ''),
          });
          await subscriber.subscribe(msg);
        });
      }
    }
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
    await Promise.all(consumers.map(consumer => {
      return consumer.close();
    }));
    await Promise.all(producers.map(producer => {
      return producer.close();
    }));
  }
}

module.exports = AppBootHook;
