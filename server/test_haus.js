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

  const word = 'Haus';
  const normalized = word.toLowerCase();
  
  console.log('=== Querying forms table for:', word, 'normalized:', normalized);
  const formMatches = await db.all(`
    SELECT d.*, f.tags, f.form as inflection_form 
    FROM dictionary d
    JOIN forms f ON d.id = f.dictionary_id
    WHERE f.normalized_form = ? OR f.form = ?
    ORDER BY d.pos, d.word
  `, [normalized, word]);
  
  console.log(`Found ${formMatches.length} form matches:`);
  formMatches.forEach((match, i) => {
    console.log(`  ${i+1}. Entry: ${match.word}, tags: ${match.tags}, inflection_form: ${match.inflection_form}`);
  });
  
  console.log('\n=== Querying dictionary table');
  const dictMatches = await db.all(`
    SELECT * FROM dictionary 
    WHERE normalized_word = ? OR word = ?
    ORDER BY pos, word
  `, [normalized, word]);
  
  console.log(`Found ${dictMatches.length} dictionary matches:`);
  dictMatches.forEach((match, i) => {
    console.log(`  ${i+1}. Entry: ${match.word}, pos: ${match.pos}, id: ${match.id}`);
  });
  
  // Also check what forms are associated with Haus entry
  console.log('\n=== Checking forms for Haus entry (id 38)');
  const hausForms = await db.all(`
    SELECT form, normalized_form, tags FROM forms 
    WHERE dictionary_id = 38
  `);
  
  console.log(`Found ${hausForms.length} forms for Haus (id 38):`);
  hausForms.forEach((form, i) => {
    console.log(`  ${i+1}. form: ${form.form}, tags: ${form.tags}`);
  });
  
  await db.close();
}

test().catch(console.error);