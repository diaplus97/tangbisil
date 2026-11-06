// Which existing personal drink is on the tray. Changing tools never deletes it.
export function tableDrink(p){
 const selected=p.tableDrink??(p.rest?.tea?.held?'tea':p.bottle?.held?'bottle':'cup');
 if(selected==='tea'&&p.rest?.tea?.location==='personal')return 'tea';
 if(selected==='bottle'&&p.bottle)return 'bottle';
 return 'cup';
}
