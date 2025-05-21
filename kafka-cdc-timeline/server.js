const express = require('express');
const { Kafka } = require('kafkajs');
const WebSocket = require('ws');

const app = express();
const port = 3000;

// Cấu hình Kafka
const kafka = new Kafka({
  clientId: 'cdc-timeline-app',
  brokers: ['192.168.1.252:19092'] // Thay đổi nếu Kafka broker của bạn khác
});

// Tạo consumer riêng cho Oracle và PostgreSQL
const oracleConsumer = kafka.consumer({ groupId: 'cdc-timeline-group-oracle' });
const postgresConsumer = kafka.consumer({ groupId: 'cdc-timeline-group-postgres' });

// Thiết lập WebSocket server
const wss = new WebSocket.Server({ port: 6868 });

// Phục vụ file tĩnh từ thư mục public
app.use(express.static('public'));

// Hàm chuyển đổi microseconds sang định dạng yyyy-MM-dd HH:mm:ss.SSSSSS
const convertMicrosToDateTime = (micros) => {
  if (!micros || isNaN(micros)) return micros;
  const millis = Math.floor(micros / 1000); // Lấy milliseconds
  const remainingMicros = micros % 1000; // Lấy 3 chữ số cuối của microseconds
  const date = new Date(millis);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  const milliseconds = String(date.getUTCMilliseconds()).padStart(3, '0');
  const microseconds = String(remainingMicros).padStart(3, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}${microseconds}`;
};
// Hàm kiểm tra giá trị có phải là microseconds datetime
const isMicrosDatetime = (value, key) => {
  if (typeof value !== 'number' || isNaN(value)) return false;
  const minMicros = 0;
  const maxMicros = 2147483647000000;
  const isDateKey = /DATETIME|TIMESTAMP|DATE/i.test(key);
  return value >= minMicros && value <= maxMicros && isDateKey;
};

// Hàm chuyển đổi tất cả cột datetime trong object
const convertDatetimeFields = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  const newObj = { ...obj };
  for (const key in newObj) {
    if (isMicrosDatetime(newObj[key], key)) {
      newObj[key] = convertMicrosToDateTime(newObj[key]);
    }
  }
  return newObj;
};

// Hàm chạy consumer với regex pattern
const runConsumer = async (consumer, topicPattern, sourceType) => {
  try {
    await consumer.connect();
    await consumer.subscribe({ topics: [topicPattern], fromBeginning: false });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        if (message.value) {
          let value;
          try {
            value = JSON.parse(message.value.toString());
          } catch (e) {
            console.error(`Failed to parse message from ${topic}:`, e);
            return;
          }

          // Xử lý dữ liệu CDC
          let processedValue = { ...value };

          // Xử lý cho create (c), update (u), delete (d)
          if (value.op === 'c' || value.op === 'u') {
            processedValue.after = convertDatetimeFields(value.after);
            processedValue.before = convertDatetimeFields(value.before);
          } else if (value.op === 'd') {
            processedValue.before = convertDatetimeFields(value.before);
            processedValue.after = value.after;
          }

          console.log(`${sourceType} - Received message from ${topic}:`, processedValue);

          // Gửi message qua WebSocket tới tất cả client
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify(processedValue));
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
  runConsumer(oracleConsumer, /^oracle\.AIPDEV\..+$/, 'Oracle');

  // Chạy consumer cho PostgreSQL với pattern khớp tất cả table
  runConsumer(postgresConsumer, /^postgres\.public\..+$/, 'postgresql');
};

run().catch(console.error);

// Khởi động server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});