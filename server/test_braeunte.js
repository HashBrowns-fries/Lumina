import { sqliteDictionaryService } from './sqliteDictionaryService.js';

async function test() {
  console.log('Testing "bräunte" query...\n');
  
  const language = { id: 'de', name: 'German' };
  
  console.log('=== Query "bräunte" ===');
  const result = await sqliteDictionaryService.queryDictionary('bräunte', language);
  console.log('Success:', result.success);
  console.log('Entries:', result.entries?.length || 0);
  
  if (result.entries && result.entries.length > 0) {
    result.entries.forEach((entry, i) => {
      console.log(`\nEntry ${i+1}:`);
      console.log(`  word: ${entry.word}`);
      console.log(`  partOfSpeech: ${entry.partOfSpeech}`);
      console.log(`  entryType: ${entry.entryType}`);
      console.log(`  isInflection: ${entry.isInflection}`);
      console.log(`  inflectionAnalysis: ${JSON.stringify(entry.inflectionAnalysis)}`);
      console.log(`  definitions: ${entry.definitions.slice(0, 1).join(', ')}`);
    });
  }
  
  // Also test the base form "bräunen"
  console.log('\n\n=== Query "bräunen" (base form) ===');
  const result2 = await sqliteDictionaryService.queryDictionary('bräunen', language);
  console.log('Success:', result2.success);
  console.log('Entries:', result2.entries?.length || 0);
  
  if (result2.entries && result2.entries.length > 0) {
    result2.entries.forEach((entry, i) => {
      console.log(`\nEntry ${i+1}:`);
      console.log(`  word: ${entry.word}`);
      console.log(`  partOfSpeech: ${entry.partOfSpeech}`);
      console.log(`  entryType: ${entry.entryType}`);
      console.log(`  isInflection: ${entry.isInflection}`);
      console.log(`  inflectionAnalysis: ${JSON.stringify(entry.inflectionAnalysis)}`);
      console.log(`  definitions: ${entry.definitions.slice(0, 1).join(', ')}`);
    });
  }
  
  // Clean up
  await sqliteDictionaryService.closeConnections();
}

test().catch(console.error);