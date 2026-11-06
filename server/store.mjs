import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {createGameStore} from './game-store.mjs';
export {GameError,SNACK_ID,hashToken} from './game-store.mjs';

export function createStore(filename){
  if(filename!==':memory:')mkdirSync(dirname(filename),{recursive:true});
  const db=new DatabaseSync(filename);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
  return createGameStore(db);
}
