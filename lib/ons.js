'use strict';

const { MQClient } = require('mq-http-sdk');
const assert = require('assert');

module.exports = class ONS {
  constructor(app) {
    this.app = app;
    this.logger = app.getLogger('onsLogger');
    this.config = app.config.ons;
    app.ready(() => {
      this.appReady = true;
    });
    this.clients = Object.create(null);
    this.producerMap = Object.create(null);
    this.consumers = [];
  }

  getClient(endpoint, accessKey, secretKey) {
    const key = endpoint + '_' + accessKey;
    if (!this.clients[key]) {
      this.clients[key] = new MQClient(endpoint, accessKey, secretKey, null, {
        logger: this.logger
      });
    }
    return this.clients[key];
  }

  async init() {
    const { sub, pub } = this.config;
    for (const [ key, options ] of Object.entries(pub)) {
      await this.createProducer(key, { ...this.config.default, ...options });
    }
    for (const [ key, options ] of Object.entries(sub)) {
      await this.createConsumer(key, { ...this.config.default, ...options });
    }
  }

  async createConsumer(key, options) {
    const { consumers, app } = this;
    const {
      endpoint, accessKey, secretKey, instanceId, topics, subExpression = '', consumerGroup,
      pullThresholdForQueue, pullTimeDelayMillsWhenFlowControl, pullBatchSize, pullInterval,
    } = options;
    assert(endpoint, 'required endpoint');
    const client = this.getClient(endpoint, accessKey, secretKey);
    this.logger.debug(endpoint, accessKey, secretKey);
    topics.forEach(topic => {
      subExpression.split('||').forEach(tag => {
        const consumer = client.getConsumer(instanceId, topic, consumerGroup, tag);
        consumers.push(consumer);
        consumer.subscribe(async msg => {
          const ctx = app.createAnonymousContext({
            url: '/ons/' + topic + '/' + tag + '/' + (msg.body.length > 20 ? '*' : msg.body.toString()) + '/' + msg.msgId,
          });
          await ctx.service.ons[key].onMsg(msg);
        }, {
          pullThresholdForQueue, pullTimeDelayMillsWhenFlowControl, pullBatchSize, pullInterval,
        });
      });
    });
  }

  async createProducer(key, options) {
    const { producerMap } = this;
    const { endpoint, accessKey, secretKey, instanceId, topics } = options;
    const client = this.getClient(endpoint, accessKey, secretKey);
    producerMap[key] = Object.create(null);
    topics.forEach(topic => {
      producerMap[key][topic] = client.getProducer(instanceId, topic);
      producerMap[key].default = producerMap[key][topic];
    });
  }

  getProducer(key, topic = 'default') {
    return this.producerMap[key][topic];
  }

  async send(producerId, topic, tag, body, opts = {}) {
    return this.getProducer(producerId, topic).sendMsg(body, tag, opts);
  }
};
