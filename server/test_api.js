import fetch from 'node-fetch';

async function testAPI() {
  const baseUrl = 'http://localhost:3006';
  
  console.log('Testing dictionary API...\n');
  
  // Test 1: Hauses
  console.log('=== Testing /api/dictionary/query/de/Hauses ===');
  try {
    const response1 = await fetch(`${baseUrl}/api/dictionary/query/de/Hauses`);
    const data1 = await response1.json();
    console.log('Status:', response1.status);
    console.log('Success:', data1.success);
    console.log('Entries:', data1.entries?.length || 0);
    if (data1.entries && data1.entries.length > 0) {
      data1.entries.forEach((entry, i) => {
        console.log(`  ${i+1}. ${entry.word} (${entry.partOfSpeech}) - ${entry.entryType}`);
        if (entry.inflectionAnalysis) {
          console.log(`     inflection: ${entry.inflectionAnalysis.inflectionType}`);
        }
      });
    }
  } catch (error) {
    console.log('Error:', error.message);
  }
  
  console.log('\n=== Testing /api/dictionary/query/de/Haus ===');
  try {
    const response2 = await fetch(`${baseUrl}/api/dictionary/query/de/Haus`);
    const data2 = await response2.json();
    console.log('Status:', response2.status);
    console.log('Success:', data2.success);
    console.log('Entries:', data2.entries?.length || 0);
    if (data2.entries && data2.entries.length > 0) {
      data2.entries.forEach((entry, i) => {
        console.log(`  ${i+1}. ${entry.word} (${entry.partOfSpeech}) - ${entry.entryType}`);
        if (entry.inflectionAnalysis) {
          console.log(`     inflection: ${entry.inflectionAnalysis.inflectionType}`);
        }
      });
    }
  } catch (error) {
    console.log('Error:', error.message);
  }
}

testAPI().catch(console.error);