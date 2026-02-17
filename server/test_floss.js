import { sqliteDictionaryService } from './sqliteDictionaryService.js';

async function test() {
  console.log('Testing "floß" query...\n');
  
  const language = { id: 'de', name: 'German' };
  
  console.log('=== Query "floß" ===');
  const result = await sqliteDictionaryService.queryDictionary('floß', language);
  console.log('Success:', result.success);
  console.log('Total entries:', result.entries?.length || 0);
  
  if (result.entries && result.entries.length > 0) {
    console.log('\nEntries breakdown:');
    result.entries.forEach((entry, i) => {
      console.log(`\nEntry ${i+1}:`);
      console.log(`  word: ${entry.word}`);
      console.log(`  partOfSpeech: ${entry.partOfSpeech}`);
      console.log(`  entryType: ${entry.entryType}`);
      console.log(`  isInflection: ${entry.isInflection}`);
    console.log(`  rootWord: ${entry.rootWord || '(none)'}`);
    console.log(`  rootEntry: ${entry.rootEntry ? `Present (word: ${entry.rootEntry.word})` : 'None'}`);
    console.log(`  definitions: ${entry.definitions.slice(0, 1).join(', ')}`);
    if (entry.inflectionAnalysis) {
      console.log(`  inflectionAnalysis: ${JSON.stringify(entry.inflectionAnalysis)}`);
    }
    });
  }
  
  // Also test the base form "fließen"
  console.log('\n\n=== Query "fließen" (base form) ===');
  const result2 = await sqliteDictionaryService.queryDictionary('fließen', language);
  console.log('Success:', result2.success);
  console.log('Entries:', result2.entries?.length || 0);
  
  if (result2.entries && result2.entries.length > 0) {
    result2.entries.forEach((entry, i) => {
      console.log(`\nEntry ${i+1}:`);
      console.log(`  word: ${entry.word}`);
      console.log(`  partOfSpeech: ${entry.partOfSpeech}`);
      console.log(`  entryType: ${entry.entryType}`);
      console.log(`  isInflection: ${entry.isInflection}`);
      console.log(`  rootWord: ${entry.rootWord || '(none)'}`);
    });
  }
  
  // Clean up
  await sqliteDictionaryService.closeConnections();
}

test().catch(console.error);