#!/usr/bin/env node
/**
 * Test AI API call with the user's API key
 */

const API_KEY = 'unt_live_ce86_2edab26d236a';
const BASE_URL = 'https://touched-ebon.vercel.app';

async function testAPICall() {
  console.log('🧪 Testing AI API call...\n');
  console.log('API Key:', API_KEY);
  console.log('Base URL:', BASE_URL);
  console.log('─'.repeat(80));

  try {
    const response = await fetch(`${BASE_URL}/api/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        messages: [
          { role: 'user', content: 'Say "Hello from Arc Testnet!" in exactly 5 words.' }
        ],
      }),
    });

    console.log('\n📡 Response Status:', response.status, response.statusText);
    console.log('─'.repeat(80));

    const data = await response.json();
    console.log('\n📦 Response Body:');
    console.log(JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log('\n✅ API call successful!');
      if (data.choices && data.choices[0]) {
        console.log('\n🤖 AI Response:');
        console.log(data.choices[0].message.content);
      }
      if (data.executionTrace) {
        console.log('\n📊 Execution Trace:');
        data.executionTrace.steps.forEach((step) => {
          console.log(`  ${step.status === 'success' ? '✓' : '✗'} ${step.name}: ${step.durationMs}ms`);
        });
      }
    } else {
      console.log('\n❌ API call failed!');
      if (data.error) {
        console.log('Error:', data.error);
      }
    }
  } catch (error) {
    console.error('\n❌ Request failed:', error.message);
  }
}

testAPICall();
