const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const filePath = 'c:\\Users\\vikash kumar\\Desktop\\ai-dost\\calculator_live_preview.html';

const server = http.createServer((req, res) => {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error loading preview file');
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Live Preview Server running at http://localhost:${PORT}`);
});
