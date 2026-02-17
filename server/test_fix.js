import { sqliteDictionaryService } from './sqliteDictionaryService.js';

async function test() {
  console.log('Testing fixed dictionary service...');
  
  const language = { id: 'de', name: 'German' };
  
  // Test 1: Hauses
  console.log('\n=== Test 1: Query "Hauses" ===');
  const result1 = await sqliteDictionaryService.queryDictionary('Hauses', language);
  console.log('Success:', result1.success);
  console.log('Entries:', result1.entries?.length || 0);
  if (result1.entries && result1.entries.length > 0) {
    result1.entries.forEach((entry, i) => {
      console.log(`  Entry ${i+1}: ${entry.word} (${entry.partOfSpeech})`);
      console.log(`    entryType: ${entry.entryType}`);
      console.log(`    isInflection: ${entry.isInflection}`);
      console.log(`    inflectionAnalysis: ${JSON.stringify(entry.inflectionAnalysis)}`);
      console.log(`    definitions: ${entry.definitions.slice(0, 1).join(', ')}`);
    });
  }
  
  // Test 2: Haus
  console.log('\n=== Test 2: Query "Haus" ===');
  const result2 = await sqliteDictionaryService.queryDictionary('Haus', language);
  console.log('Success:', result2.success);
  console.log('Entries:', result2.entries?.length || 0);
  if (result2.entries && result2.entries.length > 0) {
    result2.entries.forEach((entry, i) => {
      console.log(`  Entry ${i+1}: ${entry.word} (${entry.partOfSpeech})`);
      console.log(`    entryType: ${entry.entryType}`);
      console.log(`    isInflection: ${entry.isInflection}`);
      console.log(`    inflectionAnalysis: ${JSON.stringify(entry.inflectionAnalysis)}`);
      console.log(`    definitions: ${entry.definitions.slice(0, 1).join(', ')}`);
    });
  }
  
  // Clean up
  await sqliteDictionaryService.closeConnections();
}

test().catch(console.error);