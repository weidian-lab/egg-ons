const { MQClient } = require('mq-http-sdk');
const assert = require('assert');
const shortId = require('shortid');

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
    const key = `${endpoint}_${accessKey}`;
    if (!this.clients[key]) {
      this.clients[key] = new MQClient(endpoint, accessKey, secretKey, null, {
        logger: this.logger,
      });
    }
    return this.clients[key];
  }

  async init() {
    const { pub } = this.config;
    for (const [ key, options ] of Object.entries(pub)) {
      await this.createProducer(key, { ...this.config.default, ...options });
    }
  }

  async initConsumer() {
    const { sub } = this.config;
    for (const [ key, options ] of Object.entries(sub)) {
      await this.createConsumer(key, { ...this.config.default, ...options });
    }
  }

  async createConsumer(key, options) {
    const { consumers, app } = this;
    const {
      endpoint, accessKey, secretKey, instanceId, topics, subExpression = '', consumerGroup,
    } = options;
    assert(endpoint, 'required endpoint');
    const client = this.getClient(endpoint, accessKey, secretKey);
    this.logger.debug(endpoint, accessKey, secretKey);
    topics.forEach(topic => {
      const consumer = client.getConsumer(instanceId, topic, consumerGroup, subExpression);
      consumer.app = app;
      consumers.push(consumer);
      consumer.subscribe(async msg => {
        if (app.als) {
          app.als.scope();
        }
        const ctx = app.createAnonymousContext({
          url: `/ons/${topic}/${msg.tag}/${msg.body.length > 20 ? '*' : msg.body.toString()}/${msg.msgId}`,
        });
        if (ctx.service.ons[key].checkSendDelayMsg) {
          const sendedDelayMsg = await ctx.service.ons[key].checkSendDelayMsg(msg);
          if (sendedDelayMsg) {
            return;
          }
        }
        ctx.logger.info('onMsg', msg);
        const startedAt = Date.now();
        try {
          const ret = await ctx.service.ons[key].onMsg(msg);
          ctx.logger.info('done', Date.now() - startedAt, ret);
        } catch (err) {
          ctx.logger.error(err, Date.now() - startedAt);
        }
      }, options);
    });
  }

  async createProducer(key, options) {
    const { producerMap } = this;
    const {
      endpoint, accessKey, secretKey, instanceId, topics,
    } = options;
    const client = this.getClient(endpoint, accessKey, secretKey);
    producerMap[key] = Object.create(null);
    topics.forEach(topic => {
      producerMap[key][topic] = client.getProducer(instanceId, topic);
      producerMap[key].default = producerMap[key][topic];
    });
  }

  getProducer(key, topic) {
    return this.producerMap[key][topic || 'default'];
  }

  async send(producerId, topic, tag, body, opts = {}) {
    return this.getProducer(producerId, topic).sendMsg(body, tag, opts);
  }

  async sendObject(producerId, topic, tag, body, opts = {}) {
    return this.getProducer(producerId, topic).sendMsg(JSON.stringify({
      id: shortId.generate(),
      ...body,
    }), tag, opts);
  }
};
