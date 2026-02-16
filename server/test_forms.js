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

  const word = 'Hauses';
  const normalized = word.toLowerCase();
  
  console.log('Querying forms table for:', word, 'normalized:', normalized);
  const formMatch = await db.get(`
    SELECT d.*, f.tags, f.form as inflection_form 
    FROM dictionary d
    JOIN forms f ON d.id = f.dictionary_id
    WHERE f.normalized_form = ? OR f.form = ?
    LIMIT 1
  `, [normalized, word]);
  
  if (formMatch) {
    console.log('Found form match:', formMatch);
  } else {
    console.log('No form match found');
  }
  
  console.log('Querying dictionary table');
  const dictMatch = await db.get(`
    SELECT * FROM dictionary 
    WHERE normalized_word = ? OR word = ?
    LIMIT 1
  `, [normalized, word]);
  
  if (dictMatch) {
    console.log('Found dictionary match:', dictMatch);
  } else {
    console.log('No dictionary match found');
  }
  
  await db.close();
}

test().catch(console.error);