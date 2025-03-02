const oracleTimeline = document.getElementById('oracle-timeline');
const postgresTimeline = document.getElementById('postgres-timeline');
const ws = new WebSocket('ws://localhost:6868');

// Hàm tạo bảng từ dữ liệu before và after
function createTable(before, after) {
  const headers = new Set();
  if (before) Object.keys(before).forEach(key => headers.add(key));
  if (after) Object.keys(after).forEach(key => headers.add(key));
  const headerArray = Array.from(headers);

  let tableHTML = '<table><thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead><tbody>';

  headerArray.forEach(header => {
    const beforeValue = before && before[header] !== undefined ? before[header] : null;
    const afterValue = after && after[header] !== undefined ? after[header] : null;
    const isDifferent = JSON.stringify(beforeValue) !== JSON.stringify(afterValue);
    
    tableHTML += '<tr>';
    tableHTML += `<td>${header}</td>`;
    tableHTML += `<td${isDifferent ? ' class="highlight"' : ''}>${beforeValue != null ? JSON.stringify(beforeValue) : ''}</td>`;
    tableHTML += `<td${isDifferent ? ' class="highlight"' : ''}>${afterValue != null ? JSON.stringify(afterValue) : ''}</td>`;
    tableHTML += '</tr>';
  });

  tableHTML += '</tbody></table>';
  return tableHTML;
}

// Khi nhận được message từ WebSocket
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  const { before, after, source, op } = data;

  const eventDiv = document.createElement('div');
  eventDiv.className = 'event';

  const operation = op === 'c' ? 'INSERT' : op === 'u' ? 'UPDATE' : 'DELETE';
  const tableName = source?.table || 'Unknown Table';
  eventDiv.innerHTML = `<h3>${operation} on ${tableName} at ${new Date().toLocaleString()}</h3>`;
  eventDiv.innerHTML += createTable(before, after);

  // Phân loại dữ liệu vào timeline tương ứng
  if (source?.connector === 'oracle') {
    console.log('Adding to Oracle timeline:', data);
    oracleTimeline.insertBefore(eventDiv, oracleTimeline.firstChild);
  } else if (source?.connector === 'postgresql') {
    console.log('Adding to PostgreSQL timeline:', data);
    postgresTimeline.insertBefore(eventDiv, postgresTimeline.firstChild);
  } else {
    console.warn('Unknown connector:', source?.connector);
  }
};

// Xử lý kết nối WebSocket
ws.onopen = () => console.log('Connected to WebSocket server');
ws.onerror = (error) => console.error('WebSocket error:', error);
ws.onclose = () => console.log('WebSocket connection closed');