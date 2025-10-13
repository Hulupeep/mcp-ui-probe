async function runAmazonTest() {
  const serverUrl = 'http://localhost:3000';
  const goal = 'Go to amazon.com, find a blue t-shirt, and add it to the shopping basket';
  const url = 'https://www.amazon.com';

  console.log(`🚀 Sending test to ${serverUrl}...`);
  console.log(`   Goal: ${goal}`);
  console.log(`   URL: ${url}`);

  try {
    const response = await fetch(`${serverUrl}/api/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tool: 'run_flow',
        arguments: {
          goal,
          url,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server responded with ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Test initiated successfully:', result);

  } catch (error) {
    console.error('❌ Failed to send test request:', error.message);
    process.exit(1);
  }
}

runAmazonTest();
