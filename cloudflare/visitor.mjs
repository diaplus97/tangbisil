import {DurableObject} from 'cloudflare:workers';
import {sqliteAdapter,jsonStore} from './sql.mjs';
import {createGameStore} from '../server/game-store.mjs';
import {captureUser} from './checkpoint.mjs';
import {emptyRest,sampleTea} from '../shared/rest.mjs';

// One independently addressed record per visitor. A fenced room lease prevents
// two rooms from committing concurrent versions of the same personal inventory.
export class PantryVisitor extends DurableObject {
  constructor(ctx,env){super(ctx,env);this.db=sqliteAdapter(ctx.storage);this.json=jsonStore(this.db);}
  initialize(name,avatar,token){
    return this.ctx.storage.transactionSync(()=>{
      if(this.json.get('record'))return {error:'이미 등록된 방문자예요.',status:409};
      const store=createGameStore(this.db,{crossRoomOffers:true}),created=store.createUser(name,avatar,{token});
      this.json.set('record',{checkpoint:captureUser(this.db,created.user.id),revision:0,epoch:0,room:null});
      return created;
    });
  }
  identity(){const record=this.json.get('record');return record?{id:record.checkpoint.user.id,room:record.room,epoch:record.epoch}:null;}
  view(){
    const record=this.json.get('record');if(!record)return null;
    const {user,tables}=record.checkpoint,{token_hash,...safe}=user;
    const pantry=tables.pantry_items[0]?JSON.parse(tables.pantry_items[0].data):{candy:null,bottle:null,coffee:{stage:'carried',roomId:null,readyAt:0},rest:emptyRest()};
    pantry.rest={...emptyRest(),...pantry.rest};pantry.rest.tea=sampleTea(pantry.rest.tea,Date.now());
    if(pantry.coffee.stage==='brewing'&&pantry.coffee.readyAt<=Date.now())pantry.coffee.stage='ready';
    return {...safe,serving:tables.servings[0]??null,discoveries:tables.discoveries,pantry};
  }
  claim(room){
    return this.ctx.storage.transactionSync(()=>{
      const record=this.json.get('record');if(!record)return {error:'자리를 다시 잡아 주세요.',status:401};
      if(record.room&&record.room!==room)return {conflict:record.room};
      if(!record.room){record.room=room;record.epoch++;this.json.set('record',record);}
      return record;
    });
  }
  commit(room,epoch,revision,checkpoint){
    return this.ctx.storage.transactionSync(()=>{
      const record=this.json.get('record');
      if(!record||record.room!==room||record.epoch!==epoch)return {error:'다른 방으로 이동한 기록이에요.',status:409};
      if(revision===record.revision)return {ok:true};
      if(revision!==record.revision+1||checkpoint.user.id!==record.checkpoint.user.id)return {error:'저장 순서를 다시 확인하고 있어요.',status:409};
      record.checkpoint=checkpoint;record.revision=revision;this.json.set('record',record);return {ok:true};
    });
  }
  release(room,epoch){
    const record=this.json.get('record');if(record?.room===room&&record.epoch===epoch){record.room=null;this.json.set('record',record);}return {ok:true};
  }
}
