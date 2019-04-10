'use strict';

const ons = require('ali-ons');
const assert = require('assert');

const { Message } = ons;

class Producer extends ons.Producer {
  async send(msg) {
    const { namespace } = this.options;
    if (namespace && !msg.topic.includes(namespace + '%')) {
      msg.topic = `${namespace}%${msg.topic}`;
    }
    return super.send(msg);
  }
  async sendMsg(topic, tag, body, opts = {}) {
    const { startDeliverTime, properties = {} } = opts;
    const msg = new Message(topic, tag, body);
    if (startDeliverTime) {
      msg.setStartDeliverTime(startDeliverTime);
    }
    Object.assign(msg.properties, properties);
    const sendResult = await this.send(msg);
    assert.equal(sendResult.sendStatus, 'SEND_OK', 'send failed ' + [ sendResult.msgId, sendResult.sendStatus ].join(' '));
    return sendResult;
  }
}


module.exports = Producer;
