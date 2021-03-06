'use strict';

const path = require('path');

module.exports = appInfo => {
  return {
    /**
     * egg-ons default config
     * @member Config#ons
     */
    ons: {
      default: {
        accessKey: '',
        secretKey: '',
        instanceId: '',
        endpoint: '',
        pullInterval: 2000,
        pullBatchSize: 16,
        pullTimeDelayMillsWhenFlowControl: 3000,
        pullThresholdForQueue: 20,
        // 公有云生产环境：http://onsaddr-internal.aliyun.com:8080/rocketmq/nsaddr4client-internal
        // 公有云公测环境：http://onsaddr-internet.aliyun.com/rocketmq/nsaddr4client-internet
        // 杭州金融云环境：http://jbponsaddr-internal.aliyun.com:8080/rocketmq/nsaddr4client-internal
        // 杭州深圳云环境：http://mq4finance-sz.addr.aliyun.com:8080/rocketmq/nsaddr4client-internal
        // accessKey: 'your-accesskey',
        // secretKey: 'your-secretkey',
      },
      sub: {
        // default: {
        //   consumerGroup: 'your-group',
        //   accessKey: 'your-accesskey',
        //   secretKey: 'your-secretkey',
        //   topics: [
        //     'your-topic-2',
        //   ],
        // }
      },
      pub: {
        // default: {
        //   producerGroup: 'your-group',
        //   accessKey: 'your-accesskey',
        //   secretKey: 'your-secretkey',
        //   topics: [
        //     'your-topic-3',
        //   ],
        // }
      },
    },
    customLogger: {
      onsLogger: {
        consoleLevel: 'INFO',
        file: path.join(appInfo.root, 'logs', appInfo.name, 'ons.log'),
      },
    },
  };
};
