#!/bin/bash

# Đợi Kafka Connect sẵn sàng
echo "Waiting for Kafka Connect to be ready..."
while ! curl -s http://localhost:8083/connectors >/dev/null; do
  sleep 5
done
echo "Kafka Connect is ready!"

sleep 45

# Tạo connector bằng REST API
curl -X POST -H "Content-Type: application/json" \
  --data @/connectors/oracle-connector-debezium-sink.json \
  http://localhost:8083/connectors


curl -X POST -H "Content-Type: application/json" \
  --data @/connectors/postgresql-connector-debezium-sink.json \
  http://localhost:8083/connectors

echo "Connector initialized!"