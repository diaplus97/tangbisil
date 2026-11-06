// Only personal rows travel between rooms. Offers and claims stay with their room.
const personal=['servings','discoveries','pantry_items','receipts','pantry_receipts','visitor_locations'];
export function captureUser(db,id){
  const user=db.prepare('SELECT * FROM users WHERE id=?').get(id),tables={};
  for(const table of personal)tables[table]=db.prepare(`SELECT * FROM ${table} WHERE user_id=?${table==='servings'?' ORDER BY created_at DESC,rowid DESC LIMIT 1':''}`).all(id);
  return {user,tables};
}
export function restoreUser(db,checkpoint){
  const {user,tables}=checkpoint,columns=Object.keys(user);
  db.prepare(`INSERT INTO users(${columns.join(',')}) VALUES(${columns.map(()=>'?').join(',')}) ON CONFLICT(id) DO UPDATE SET ${columns.filter(c=>c!=='id').map(c=>`${c}=excluded.${c}`).join(',')}`).run(...columns.map(c=>user[c]));
  for(const table of personal){
    db.prepare(`DELETE FROM ${table} WHERE user_id=?`).run(user.id);
    for(const row of tables[table]??[]){const names=Object.keys(row);db.prepare(`INSERT INTO ${table}(${names.join(',')}) VALUES(${names.map(()=>'?').join(',')})`).run(...names.map(c=>row[c]));}
  }
}
