'use strict';

const Message = require('ali-ons').Message;
const Consumer = require('ali-ons').Consumer;
const Producer = require('ali-ons').Producer;
const path = require('path');
const assert = require('assert');

class CustomProducer extends Producer {
  async send(msg) {
    const { namespace } = this.options;
    if (namespace && !msg.topic.includes('%')) {
      msg.topic = `${namespace}%${msg.topic}`;
    }
    return super.send(msg);
  }
}

class CustomConsumer extends Consumer {
  subscribe(topic, subExpression, handler) {
    let reallyTopic = topic;
    const { namespace } = this.options;
    if (namespace && !topic.includes('%')) {
      reallyTopic = `${namespace}%${topic}`;
    }
    return super.subscribe(reallyTopic, subExpression, handler);
  }
}

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
    this.producerRealTopic = new Map();
    this.Message = Message;
  }

  async init() {
    const { app } = this;
    const { sub, pub } = this.config;
    const directory = path.join(app.config.baseDir, 'app/ons');
    app.loader.loadToApp(directory, 'ONSSubscribers', {
      caseStyle(filepath) {
        return filepath.substring(0, filepath.lastIndexOf('.')).split('/');
      },
    });
    for (const options of sub) {
      await this.createConsumer(options, app.ONSSubscribers);
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
      if (consumerGroup && !consumerGroup.includes('%')) {
        distConfig.consumerGroup = `${namespace}%${consumerGroup}`;
      }
      if (producerGroup && !producerGroup.includes('%')) {
        distConfig.producerGroup = `${namespace}%${producerGroup}`;
      }
    }
    return distConfig;
  }

  async createConsumer(options, Subscribers) {
    const { app, consumerMap, logger } = this;
    const consumer = new CustomConsumer(this._buildConfig(options));
    consumer.on('error', err => this._errorHandler(err));
    const key = `${consumer.consumerGroup}-${consumer.clientId}`;
    assert(!consumerMap.has(key), `[egg-ons] duplicate consumer, consumerGroup=${consumer.consumerGroup}, clientId=${consumer.clientId}`);
    consumerMap.set(key, consumer);

    await consumer.ready();
    logger.info('[egg-ons] consumer: %s is ready, messageModel: %s', consumer.consumerGroup, consumer.messageModel);

    const topics = options.topics || [];
    const { namespace } = consumer.options;
    for (const topic of topics) {
      const Subscriber = Subscribers[(namespace ? namespace + '_' : '') + topic] || Subscribers[topic];
      if (!Subscriber) {
        app.coreLogger.warn('[egg-ons] CANNOT find the subscription logic for topic=%s', topic);
        continue;
      }

      consumer.subscribe(topic, Subscriber.subExpression || '*', async function(msg) {
        const ctx = app.createAnonymousContext({
          url: '/ons/' + topic + '/' + msg.tags + '/' + (msg.body.length < 50 ? msg.body.toString() : ''),
        });
        const subscriber = new Subscriber(ctx);
        await subscriber.subscribe(msg);
      });
    }
  }

  async createProducer(key, options) {
    const { producerMap, producers, logger } = this;
    const producer = new CustomProducer(this._buildConfig(options));
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
};
