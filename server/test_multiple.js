import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '..', 'dict', 'German', 'german_dict.db');

async function test() {
  console.log('Opening database:', dbPath);
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  const words = ['laufen', 'sein', 'Haus', 'Hauses', 'bequem'];
  
  for (const word of words) {
    const normalized = word.toLowerCase();
    console.log(`\n=== Testing "${word}" (normalized: "${normalized}") ===`);
    
    // Check forms table
    const forms = await db.all(`
      SELECT d.*, f.tags, f.form as inflection_form 
      FROM dictionary d
      JOIN forms f ON d.id = f.dictionary_id
      WHERE f.normalized_form = ? OR f.form = ?
    `, [normalized, word]);
    
    console.log(`Forms table matches: ${forms.length}`);
    if (forms.length > 0) {
      forms.forEach((f, i) => {
        console.log(`  ${i+1}. ${f.word} (${f.pos}) -> ${f.inflection_form}, tags: ${f.tags}`);
      });
    }
    
    // Check dictionary table
    const dictEntries = await db.all(`
      SELECT * FROM dictionary 
      WHERE normalized_word = ? OR word = ?
      ORDER BY pos
    `, [normalized, word]);
    
    console.log(`Dictionary table matches: ${dictEntries.length}`);
    if (dictEntries.length > 0) {
      dictEntries.forEach((d, i) => {
        console.log(`  ${i+1}. ${d.word} (${d.pos})`);
      });
    }
  }
  
  await db.close();
}

test().catch(console.error);