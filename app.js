
const ONS = require('./lib/ons')

class AppBootHook {
  constructor (app) {
    app.ons = new ONS(app)
    this.app = app
  }

  async didLoad () {
    await this.app.ons.init()
  }

  async didReady () {
    await this.app.ons.initConsumer()
  }

  async beforeClose () {
    const { app } = this
    app.coreLogger.info('[egg-ons] beforeClose')
    await Promise.all(app.ons.consumers.map(consumer => {
      return consumer.safeClose()
    }))
    app.coreLogger.info('[egg-ons] closed')
  }
}

module.exports = AppBootHook
