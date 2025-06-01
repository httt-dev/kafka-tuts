const express = require('express');
const { Kafka } = require('kafkajs');
const WebSocket = require('ws');
const config = require('./config');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const KAFKA_CONNECT_URL = String(config.kafkaConnect.connectorHost)?.startsWith('http')
                                                                                ? config.kafkaConnect.connectorHost
                                                                                : `http://${config.kafkaConnect.connectorHost}`;

const app = express();

console.log('Starting CDC Timeline App...');
// Kiểm tra các topic
console.log('Broker:', config.kafka.brokers);
// Kiểm tra cấu hình Kafka Connect
console.log('Kafka Connect Host:', KAFKA_CONNECT_URL);

// check connecor status
const checkAndRecoveryConnectorStatus = async (connectorName, configFilePath) => {
  try {
    const statusRes = await fetch(`${KAFKA_CONNECT_URL}/connectors/${connectorName}/status`);
    if (!statusRes.ok) throw new Error(`Status code ${statusRes.status}`);

    const status = await statusRes.json();
    const connectorState = status.connector?.state;
    const tasksState = status.tasks?.map(t => t.state || 'UNKNOWN');

    if (connectorState !== 'RUNNING' || tasksState.some(s => s !== 'RUNNING')) {
      throw new Error(`Connector ${connectorName} not running`);
    }

    console.log(`[OK] ${connectorName} is running.`);
  } catch (err) {
    console.warn(`[WARN] ${connectorName} error: ${err.message}`);
    // Xóa connector nếu tồn tại
    try {
      const deleteRes = await fetch(`${KAFKA_CONNECT_URL}/connectors/${connectorName}`, {
        method: 'DELETE'
      });
      console.log(`[INFO] Deleted ${connectorName} connector.`);
    } catch (delErr) {
      console.error(`[ERROR] Failed to delete ${connectorName}: ${delErr.message}`);
    }

    // Đọc lại file và tạo mới
    try {
      const config = JSON.parse(fs.readFileSync(path.resolve(configFilePath), 'utf8'));
      const createRes = await fetch(`${KAFKA_CONNECT_URL}/connectors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });

      if (createRes.ok) {
        console.log(`[INFO] Recreated ${connectorName} successfully.`);
      } else {
        const text = await createRes.text();
        console.error(`[ERROR] Failed to recreate ${connectorName}: ${createRes.status} - ${text}`);
      }
    } catch (createErr) {
      console.error(`[ERROR] Failed to recreate ${connectorName} from file: ${createErr.message}`);
    }
  }
};

// Gọi định kỳ mỗi 30 giây
setInterval(() => {
  checkAndRecoveryConnectorStatus('oracle-connector', './connectors/oracle-connector.json');
  checkAndRecoveryConnectorStatus('postgres-connector', './connectors/postgres-connector.json');
}, 30000);

// ✅ Hàm dùng chung để check status
const checkConnectorStatus = async () => {
  const connectors = ['oracle-connector', 'postgres-connector'];

  const results = await Promise.all(connectors.map(async (name) => {
    try {
      const response = await fetch(`${KAFKA_CONNECT_URL}/connectors/${name}/status`);
      if (!response.ok) throw new Error(`Status ${response.status}`);
      const data = await response.json();
      return { name, status: 'RUNNING', details: data };
    } catch (err) {
      return { name, status: 'ERROR', error: err.message };
    }
  }));

  return results;
};

// ✅ Route API: gọi lại hàm trên
app.get('/connector-status', async (req, res) => {
  try {
    const status = await checkConnectorStatus();
    res.json({ success: true, connectors: status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});



// Cấu hình Kafka
const kafka = new Kafka({
  clientId: config.kafka.clientId,
  brokers: config.kafka.brokers
});

// Tạo consumer riêng cho Oracle và PostgreSQL
const oracleConsumer = kafka.consumer({ groupId: config.kafka.consumerGroups.oracle });
const postgresConsumer = kafka.consumer({ groupId: config.kafka.consumerGroups.postgres });

// Thiết lập WebSocket server
const wss = new WebSocket.Server({ port: config.server.websocketPort });

// Phục vụ file tĩnh từ thư mục public
app.use(express.static('public'));

// Route động để phục vụ index.html cho /:userId
app.get('/:userId', (req, res) => {
  res.sendFile('index.html', { root: './public' });
});


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
  const isDateKey = /DATETIME|TIMESTAMP|DATE|ALLOCATED_YMD|POST_TERM_TO|POST_TERM_FROM/i.test(key);
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

// Hàm tìm key case-insensitive trong object
const findOperationUserId = (obj) => {
  if (!obj || typeof obj !== 'object') return '';
  const targetFields = ['update_user_id', 'delete_user_id'].map(field => field.toLowerCase());
  for (const key in obj) {
    if (targetFields.includes(key.toLowerCase())) {
      const value = obj[key];
      // Chỉ trả về giá trị nếu nó là chuỗi và không phải null/undefined
      if (typeof value === 'string' && value !== '') {
        console.log(`Found user ID in object: ${key} = ${value}`);
        return value.toLowerCase();
      }
      // Tiếp tục kiểm tra field tiếp theo nếu giá trị là null hoặc undefined
    }
  }
  console.warn(`No matching user ID found in object:`, obj);
  return '';
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

          // Gửi message qua WebSocket tới các client phù hợp
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              // Kiểm tra update_user_id từ before hoặc after, bỏ qua hoa thường
              const messageUpdateUserId = findOperationUserId(processedValue.after) || findOperationUserId(processedValue.before);
              // Gửi message cho tất cả client nếu messageUpdateUserId rỗng, hoặc chỉ cho client có updateUserId khớp
              if (!messageUpdateUserId || (client.userId && messageUpdateUserId === client.userId)) {
                client.send(JSON.stringify(processedValue));
              }
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
  wss.on('connection', (ws, req) => {
    // Lấy update_user_id từ URL path của WebSocket và chuyển thành lowercase
    const url = new URL(req.url, `http://${req.headers.host}`);
    const userId = (url.pathname.split('/')[1] || '').toLowerCase();
    ws.userId = userId; // Lưu update_user_id vào WebSocket client
    console.log(`Client connected to WebSocket with update_user_id: ${userId || 'none'}`);
    ws.on('close', () => console.log(`Client disconnected with update_user_id: ${userId || 'none'}`));
  });

  // // Chạy consumer cho Oracle với pattern khớp tất cả table
  // runConsumer(oracleConsumer, /^oracle\.AIPDEV\..+$/, 'Oracle');
  // // Chạy consumer cho PostgreSQL với pattern khớp tất cả table
  // runConsumer(postgresConsumer, /^postgres\.public\..+$/, 'postgresql');
  
  runConsumer(oracleConsumer, config.topics.oracle, 'Oracle');
  runConsumer(postgresConsumer, config.topics.postgres, 'PostgreSQL');

};

run().catch(console.error);

// Khởi động server
app.listen(config.server.port, () => {
  console.log(`Server running at http://localhost:${config.server.port}`);
});