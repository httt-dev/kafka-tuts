module.exports = {
  server: {
    port: process.env.SERVER_PORT || 3000,
    websocketPort: process.env.WEBSOCKET_PORT || 6868
  },
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || '192.168.1.199:19092').split(','),
    clientId: process.env.KAFKA_CLIENT_ID || 'cdc-timeline-app',
    consumerGroups: {
      oracle: process.env.KAFKA_CONSUMER_GROUP_ORACLE || 'cdc-timeline-group-oracle',
      postgres: process.env.KAFKA_CONSUMER_GROUP_POSTGRES || 'cdc-timeline-group-postgres'
    }
  },
  kafkaConnect: {
    connectorHost: (process.env.KAFKA_CONNECT_HOST || '192.168.1.199:8083').split(','),
  },
  topics: {
    oracle: new RegExp(process.env.KAFKA_TOPIC_ORACLE || '^oracle\\.AIPDEV\\..+$'),
    postgres: new RegExp(process.env.KAFKA_TOPIC_POSTGRES || '^postgres\\.public\\..+$')
  }
};
