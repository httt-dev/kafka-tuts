const express = require('express');
const { Kafka } = require('kafkajs');
const WebSocket = require('ws');

const app = express();
const port = 3000;

// Cấu hình Kafka
const kafka = new Kafka({
  clientId: 'cdc-timeline-app',
  brokers: ['192.168.1.5:19092'] // Thay đổi nếu Kafka broker của bạn khác
});

// Tạo consumer riêng cho Oracle và PostgreSQL
const oracleConsumer = kafka.consumer({ groupId: 'cdc-timeline-group-oracle' });
const postgresConsumer = kafka.consumer({ groupId: 'cdc-timeline-group-postgres' });

// Thiết lập WebSocket server
const wss = new WebSocket.Server({ port: 6868 });

// Phục vụ file tĩnh từ thư mục public
app.use(express.static('public'));

// Hàm chạy consumer với regex pattern
const runConsumer = async (consumer, topicPattern, sourceType) => {
  try {
    await consumer.connect();
    // Sử dụng regex để subscribe vào tất cả topic khớp với pattern
    await consumer.subscribe({ topics: [topicPattern], fromBeginning: true });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        if (message.value) {
          const value = JSON.parse(message.value.toString());
          console.log(`${sourceType} - Received message from ${topic}:`, value);

          // Gửi message qua WebSocket tới tất cả client
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify(value));
            }
          });
        }
      },
    });
  } catch (error) {
    console.error(`Error in ${sourceType} consumer:`, error);
  }
};

// Kết nối Kafka và chạy consumer với pattern
const run = async () => {
  wss.on('connection', (ws) => {
    console.log('Client connected to WebSocket');
    ws.on('close', () => console.log('Client disconnected'));
  });

  // Chạy consumer cho Oracle với pattern khớp tất cả table
  runConsumer(oracleConsumer, /^oracle\.TEST_USER\..+$/, 'Oracle');

  // Chạy consumer cho PostgreSQL với pattern khớp tất cả table
  runConsumer(postgresConsumer, /^postgres\.public\..+$/, 'postgresql');
};

run().catch(console.error);

// Khởi động server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});