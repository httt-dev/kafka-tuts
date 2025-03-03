#!/bin/bash

# Chạy Kafka Connect ở background
/etc/confluent/docker/run &

# Chạy script khởi tạo connector (đã có cơ chế chờ REST API)
bash /connectors/init-connector.sh

# Giữ container sống bằng cách đợi Kafka Connect
wait