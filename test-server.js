import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 8888;

const server = http.createServer((req, res) => {
  console.log(`Request: ${req.method} ${req.url}`);

  // Special handling for 404 test
  if (req.url === '/real-404' || req.url === '/nonexistent') {
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end(`
      <!DOCTYPE html>
      <html>
      <head><title>404 Not Found</title></head>
      <body>
        <h1>404 - Page Not Found</h1>
        <p>This page returns a real 404 status code.</p>
      </body>
      </html>
    `);
    return;
  }

  // Map URLs to files
  let filePath = path.join(__dirname, 'test-pages');
  if (req.url === '/') {
    filePath = path.join(filePath, 'index.html');
  } else if (req.url === '/404') {
    // This serves the 404 page but with 200 status (mimicking the issue)
    filePath = path.join(filePath, '404.html');
  } else {
    filePath = path.join(filePath, req.url);
  }

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    // Return actual 404 for missing files
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end('<h1>404 - File Not Found</h1>');
    return;
  }

  // Read and serve file
  const ext = path.extname(filePath);
  let contentType = 'text/html';
  if (ext === '.js') contentType = 'text/javascript';
  if (ext === '.css') contentType = 'text/css';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500);
      res.end('Server Error');
      return;
    }

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log(`Test server running at http://localhost:${PORT}`);
  console.log('Test URLs:');
  console.log(`  http://localhost:${PORT}/ - Main test page`);
  console.log(`  http://localhost:${PORT}/success.html - Success page`);
  console.log(`  http://localhost:${PORT}/404 - 404 page content with 200 status`);
  console.log(`  http://localhost:${PORT}/real-404 - Real 404 with 404 status`);
});