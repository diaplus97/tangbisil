// The game uses synchronous SQL. DO transactions are supplied by the caller.
export function sqliteAdapter(storage){
  const sql=storage.sql;
  return {
    exec(text){if(/^(BEGIN|COMMIT|ROLLBACK)\b/.test(text))return;sql.exec(text);},
    prepare(text){return {
      all(...args){return sql.exec(text,...args).toArray();},
      get(...args){return sql.exec(text,...args).toArray()[0];},
      run(...args){const cursor=sql.exec(text,...args);cursor.toArray();return {changes:sql.exec('SELECT changes() AS n').one().n};},
    };},close(){},
  };
}
export function jsonStore(db){
  db.exec('CREATE TABLE IF NOT EXISTS cf_json(key TEXT PRIMARY KEY,value TEXT NOT NULL)');
  return {get(key,fallback=null){const row=db.prepare('SELECT value FROM cf_json WHERE key=?').get(key);return row?JSON.parse(row.value):fallback;},
    set(key,value){db.prepare('INSERT INTO cf_json VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(value));},
    delete(key){db.prepare('DELETE FROM cf_json WHERE key=?').run(key);}};
}
