import {DurableObject} from 'cloudflare:workers';
import {sqliteAdapter,jsonStore} from './sql.mjs';

// Eight fixed admission shards, not one global game room and not one object/IP.
export class PantryGate extends DurableObject {
  constructor(ctx,env){super(ctx,env);this.json=jsonStore(sqliteAdapter(ctx.storage));}
  allow(ip,kind){
    const now=Date.now(),day=Math.floor(now/86400000),minute=Math.floor(now/60000);
    let state=this.json.get('limits');if(!state||state.day!==day)state={day,sessions:0,connections:0,ips:{}};
    const p=state.ips[ip]??{sessions:0,connections:0,minute,count:0};
    if(p.minute!==minute){p.minute=minute;p.count=0;}
    const denied=kind==='session'?(state.sessions>=Number(this.env.SESSIONS_PER_SHARD_DAY??64)||p.sessions>=6):(state.connections>=Number(this.env.CONNECTS_PER_SHARD_DAY??800)||p.connections>=240||p.count>=12);
    if(denied)return {ok:false,status:429,retryAfter:p.count>=12?60:3600,error:'잠시 쉬어가는 중이에요. 조금 뒤 다시 들어와 주세요.'};
    if(kind==='session'){state.sessions++;p.sessions++;}else{state.connections++;p.connections++;p.count++;}
    state.ips[ip]=p;this.json.set('limits',state);return {ok:true};
  }
}
