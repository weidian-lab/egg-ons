'use strict';

const BaseConsumer = require('ali-ons').Consumer;

class Consumer extends BaseConsumer {
  subscribe(topic, subExpression, handler) {
    let reallyTopic = topic;
    const { namespace } = this.options;
    if (namespace && !topic.includes(namespace + '%')) {
      reallyTopic = `${namespace}%${topic}`;
    }
    return super.subscribe(reallyTopic, subExpression, handler);
  }
}

module.exports = Consumer;
