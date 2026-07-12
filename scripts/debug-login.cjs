const http = require('http');
const payload = JSON.stringify({ username: 'admin', password: 'admin123' });

const req = http.request({
  hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': payload.length },
}, (res) => {
  console.log('Status:', res.statusCode);
  console.log('Headers:', JSON.stringify(res.headers, null, 2));
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => console.log('Body:', data));
});
req.write(payload);
req.end();
