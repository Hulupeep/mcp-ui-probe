import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || process.env.TEST_PORT || 8081;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Disable automatic index.html serving for root
app.use(express.static(path.join(__dirname, 'pages'), { index: false }));

// Log requests for debugging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Test form handler
app.post('/test/submit', (req, res) => {
  console.log('Form submission received:', req.body);
  res.json({
    success: true,
    message: 'Form submitted successfully!',
    data: req.body
  });
});

// Serve playground as root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'playground.html'));
});

// Serve test pages
app.get('/test', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'index.html'));
});

app.get('/test/forms', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'forms.html'));
});

app.get('/test/navigation', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'navigation.html'));
});

app.get('/test/dynamic', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'dynamic.html'));
});

app.get('/test/validation', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'validation.html'));
});

// New test pages
app.get('/test/react-components', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'react-components.html'));
});

app.get('/test/file-upload', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'file-upload.html'));
});

app.get('/test/dropdowns', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'dropdowns.html'));
});

// Start server with error handling
const server = app.listen(PORT, () => {
  console.log(`✅ Test server running at http://localhost:${PORT}`);
  console.log('');
  console.log('🎯 UI-Probe Playground:');
  console.log(`   http://localhost:${PORT}/               - Playground Home (Start Here!)`);
  console.log('');
  console.log('📚 Available test pages:');
  console.log(`   http://localhost:${PORT}/test          - Main test page`);
  console.log(`   http://localhost:${PORT}/test/forms    - Form testing`);
  console.log(`   http://localhost:${PORT}/test/navigation - Navigation testing`);
  console.log(`   http://localhost:${PORT}/test/dynamic  - Dynamic content`);
  console.log(`   http://localhost:${PORT}/test/validation - Validation scenarios`);
  console.log(`   http://localhost:${PORT}/test/react-components - React components`);
  console.log(`   http://localhost:${PORT}/test/file-upload - File upload testing`);
  console.log(`   http://localhost:${PORT}/test/dropdowns - Custom dropdowns`);
  console.log('');
  console.log('🧪 Test in Claude with:');
  console.log(`   analyze_ui "http://localhost:${PORT}/test/forms"`);
  console.log(`   run_flow(goal="Sign up as new user", url="http://localhost:${PORT}/test")`);
  console.log(`   journey_record_start {"name": "My Test Journey"}`);
});

// Handle server errors
server.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
    console.error('Try one of these options:');
    console.error('1. Stop the other service using this port');
    console.error('2. Use a different port: npx mcp-ui-probe test-server --port 3000');
    process.exit(1);
  } else {
    console.error('❌ Server error:', err);
    process.exit(1);
  }
});