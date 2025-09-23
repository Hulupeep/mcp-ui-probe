#!/usr/bin/env node

/**
 * Direct test of navigation functionality
 * This will show us EXACTLY what the navigation tool returns
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function testNavigation(url, description) {
  console.log(`\n📍 Testing: ${description}`);
  console.log(`   URL: ${url}`);

  try {
    // Call the MCP tool directly using Claude Code's MCP integration
    const command = `echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"navigate","arguments":{"url":"${url}"}},"id":1}' | nc -U /tmp/mcp-*.sock 2>/dev/null || echo "Socket not found"`;

    // We'll use curl to test the actual HTTP status
    const curlResult = await execAsync(`curl -s -o /dev/null -w "%{http_code}" "${url}"`);
    const httpStatus = curlResult.stdout.trim();

    console.log(`   HTTP Status: ${httpStatus}`);

    // Fetch page content to check for 404 indicators
    const contentResult = await execAsync(`curl -s "${url}" | head -100`);
    const content = contentResult.stdout;

    const has404InContent = content.includes('404') ||
                            content.includes('Not Found') ||
                            content.includes('not found') ||
                            content.includes('doesn\'t exist');

    console.log(`   Has 404 in content: ${has404InContent}`);

    // What SHOULD happen
    const shouldFail = httpStatus === '404' || has404InContent;
    console.log(`   Should navigation fail? ${shouldFail ? 'YES' : 'NO'}`);

    return {
      url,
      httpStatus,
      has404InContent,
      shouldFail
    };
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return { error: error.message };
  }
}

async function main() {
  console.log('🧪 Direct Navigation Testing');
  console.log('=' .repeat(50));

  const tests = [
    { url: 'http://localhost:8888/success.html', description: 'Valid page (should succeed)' },
    { url: 'http://localhost:8888/404', description: '404 content with 200 status' },
    { url: 'http://localhost:8888/real-404', description: 'Real 404 with 404 status' },
    { url: 'http://localhost:8888/nonexistent', description: 'Non-existent page' },
  ];

  const results = [];
  for (const test of tests) {
    const result = await testNavigation(test.url, test.description);
    results.push(result);
  }

  console.log('\n' + '=' .repeat(50));
  console.log('📊 Summary:');
  console.log('What the navigation tool SHOULD detect as failures:');

  results.forEach(r => {
    if (!r.error) {
      const status = r.shouldFail ? '❌ SHOULD FAIL' : '✅ SHOULD PASS';
      console.log(`  ${status}: ${r.url} (HTTP ${r.httpStatus})`);
    }
  });
}

main().catch(console.error);