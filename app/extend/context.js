'use strict';

module.exports = {
  get ons() {
    return this.app.ons;
  },

  async sendJsonToOns(producerId, json, opts = {}) {
    const { topic, tag = producerId, ...msgOpts } = opts;
    const distTag = tag || '';
    const msg = JSON.stringify({
      id: shortId.generate(),
      ...json,
    });
    const ret = await this.app.ons.getProducer(producerId, topic)
      .sendMsg(msg, distTag, msgOpts);
    this.logger.info('[ons.send]', producerId, topic || '', distTag, msg);
    return ret;
  },
};
