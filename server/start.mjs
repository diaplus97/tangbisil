import { createPantryServer } from './app.mjs';
import { resolve } from 'node:path';
const dev=process.argv.includes('--dev');
let vite;
if(dev){const {createServer}=await import('vite');vite=await createServer({server:{middlewareMode:true},appType:'spa'});}
const app=createPantryServer({database:process.env.PANTRY_DB??resolve('data/pantry.sqlite'),middleware:vite?.middlewares});
const host=process.env.HOST??'127.0.0.1',port=Number(process.env.PORT??4317);
app.server.listen(port,host,()=>console.log(`탕비실 · http://${host}:${port}${dev?' (development)':''}`));
for(const event of ['SIGINT','SIGTERM'])process.on(event,async()=>{await app.close();await vite?.close();process.exit(0);});
