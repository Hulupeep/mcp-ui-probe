import { OpenAI } from 'openai';

console.log('Testing OpenAI API connection...\n');
console.log('API Key:', process.env.OPENAI_API_KEY ? `${process.env.OPENAI_API_KEY.substring(0, 10)}...` : 'NOT SET');

try {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  const completion = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: [
      { role: 'system', content: 'You are a helpful assistant. Respond with a simple JSON object.' },
      { role: 'user', content: 'Parse this: "Click the Login button". Return JSON: {"action": "click", "target": "Login"}' }
    ],
    max_tokens: 100,
    temperature: 0.3
  });

  console.log('✅ Success!');
  console.log('Response:', completion.choices[0]?.message?.content);

} catch (error) {
  console.error('❌ Error:', error.message);
  console.error('Full error:', error);
}