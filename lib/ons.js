'use strict';

const Message = require('ali-ons').Message;
const Consumer = require('./consumer');
const Producer = require('./producer');
const assert = require('assert');

module.exports = class ONS {
  constructor(app) {
    this.app = app;
    this.logger = app.getLogger('onsLogger');
    this.config = app.config.ons;
    app.ready(() => {
      this.appReady = true;
    });

    this.consumerMap = new Map();
    this.producerMap = new Map();
    this.producers = Object.create(null);
    this.consumers = Object.create(null);
    this.producerRealTopic = new Map();
    this.Message = Message;
    this.consumedMsgs = Object.create(null);
  }

  isDuplicateMsg(msgId) {
    if (this.consumedMsgs[msgId]) {
      return true;
    }
    this.consumedMsgs[msgId] = true;
    setTimeout(() => { delete this.consumedMsgs[msgId]; }, 60000);
    return false;
  }

  async init() {
    const { sub, pub } = this.config;
    for (const [ key, options ] of Object.entries(sub)) {
      await this.createConsumer(key, options);
    }

    for (const [ key, options ] of Object.entries(pub)) {
      await this.createProducer(key, options);
    }
  }

  _errorHandler(err) {
    // avoid output error message into stderr before app get ready
    this.appReady ? this.logger.error(err) : this.logger.warn(err);
  }

  _buildConfig(options) {
    const { app, logger, config } = this;
    const distConfig = {
      httpclient: app.httpclient,
      logger,
      ...config.default,
      ...options,
    };
    const { namespace, nameSrv, consumerGroup, producerGroup } = distConfig;
    if (namespace) {
      if (!nameSrv) {
        distConfig.nameSrv = `${namespace}.mq-internet-access.mq-internet.aliyuncs.com:80`;
      }
      if (consumerGroup) {
        distConfig.consumerGroup = `${namespace}%${consumerGroup}`;
      }
      if (producerGroup) {
        distConfig.producerGroup = `${namespace}%${producerGroup}`;
      }
    }
    return distConfig;
  }

  async createConsumer(customKey, options) {
    const { app, consumerMap, consumers, logger } = this;
    const consumer = new Consumer(this._buildConfig(options));
    consumer.on('error', err => this._errorHandler(err));
    const key = `${consumer.consumerGroup}-${consumer.clientId}`;
    assert(!consumerMap.has(key), `[egg-ons] duplicate consumer, consumerGroup=${consumer.consumerGroup}, clientId=${consumer.clientId}`);
    consumerMap.set(key, consumer);
    consumers[customKey] = consumer;

    await consumer.ready();
    logger.info('[egg-ons] consumer: %s is ready, messageModel: %s', consumer.consumerGroup, consumer.messageModel);

    const topics = options.topics || [];
    for (const topic of topics) {
      consumer.subscribe(topic, options.subExpression || '*', async function(msg) {
        if (this.isDuplicateMsg(msg)) {
          logger.warn('[egg-ons] duplicate msg ' + msg.msgId);
          return;
        }
        this.consumedMsgs[msg.msgId] = true;
        const ctx = app.createAnonymousContext({
          url: '/ons/' + topic + '/' + msg.tags + '/' + msg.body.toString().substr(0, 50) + '/' + msg.msgId,
        });
        await ctx.service[customKey].onMsg(msg);
      });
    }
  }

  async createProducer(key, options) {
    const { producerMap, producers, logger } = this;
    const producer = new Producer(this._buildConfig(options));
    producer.on('error', err => this._errorHandler(err));
    assert(!producerMap.has(producer.producerGroup), `[egg-ons] duplicate producer, producerGroup=${producer.producerGroup}`);
    producerMap.set(producer.producerGroup, producer);
    producers[key] = producer;
    await producer.ready();
    logger.info('[egg-ons] producer: %s is ready', producer.producerGroup);
  }

  getProducer(key) {
    return this.producers[key];
  }

  async send(producerId, topic, tag, body, opts = {}) {
    return this.getProducer(producerId).sendMsg(topic, tag, body, opts);
  }
};
