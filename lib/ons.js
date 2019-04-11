'use strict';

const Message = require('ali-ons').Message;
const Consumer = require('./consumer');
const Producer = require('./producer');
const path = require('path');
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
    for (const [ key, options ] of Object.entries(sub)) {
      await this.createConsumer(key, options, app.ONSSubscribers);
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

  async createConsumer(customKey, options, Subscribers) {
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
        const subscriber = new Subscriber();
        subscriber.ctx = ctx;
        await subscriber.subscribe(msg);
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
};
