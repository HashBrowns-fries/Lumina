import { sqliteDictionaryService } from './sqliteDictionaryService.js';

async function test() {
  console.log('Testing fixed display logic...\n');
  
  const language = { id: 'de', name: 'German' };
  
  // Test 1: Hauses
  console.log('=== Query "Hauses" ===');
  const result1 = await sqliteDictionaryService.queryDictionary('Hauses', language);
  console.log('Entries:', result1.entries?.length || 0);
  if (result1.entries && result1.entries.length > 0) {
    result1.entries.forEach((entry, i) => {
      console.log(`  ${i+1}. ${entry.word} (${entry.partOfSpeech})${entry.inflectionAnalysis ? ' · ' + entry.inflectionAnalysis.inflectionType : ''}`);
      if (entry.inflectionAnalysis) {
        console.log(`     description: ${entry.inflectionAnalysis.description}`);
      }
    });
  }
  
  // Test 2: Haus
  console.log('\n=== Query "Haus" ===');
  const result2 = await sqliteDictionaryService.queryDictionary('Haus', language);
  console.log('Entries:', result2.entries?.length || 0);
  if (result2.entries && result2.entries.length > 0) {
    result2.entries.forEach((entry, i) => {
      console.log(`  ${i+1}. ${entry.word} (${entry.partOfSpeech})${entry.inflectionAnalysis ? ' · ' + entry.inflectionAnalysis.inflectionType : ''}`);
      if (entry.inflectionAnalysis) {
        console.log(`     description: ${entry.inflectionAnalysis.description}`);
      }
    });
  }
  
  // Clean up
  await sqliteDictionaryService.closeConnections();
}

test().catch(console.error);