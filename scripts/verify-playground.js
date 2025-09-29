const http = require('http');

const port = process.env.PORT || process.env.TEST_PORT || 8081;

console.log(`\n🔍 Checking if playground is accessible at http://localhost:${port}/\n`);

const options = {
  hostname: 'localhost',
  port: port,
  path: '/',
  method: 'GET'
};

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode === 200) {
      if (data.includes('UI-Probe Playground')) {
        console.log('✅ Playground page is working correctly!');
        console.log(`   Visit: http://localhost:${port}/`);
        console.log('\nThe page contains:');
        console.log('- UI-Probe Playground title');
        console.log('- Feature cards');
        console.log('- Test page links');
        console.log('- Journey system documentation');
      } else {
        console.log('⚠️  Page loads but doesn\'t contain playground content');
        console.log('First 200 chars:', data.substring(0, 200));
      }
    } else {
      console.log(`❌ Server returned status: ${res.statusCode}`);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Could not connect to test server:', error.message);
  console.log('\n📝 To start the test server:');
  console.log('   npm run test:server');
  console.log('\n📝 Or if running from source:');
  console.log('   npm run build && npm run test:server');
});

req.end();