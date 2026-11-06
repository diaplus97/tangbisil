// Read-only deployment smoke check. No visitor creation, AI calls or record writes.
export async function verifySite(address,{fetcher=fetch,onResult=()=>{}}={}){
  const base=new URL(address);if(!['http:','https:'].includes(base.protocol)||base.username||base.password)throw Error('HTTP 또는 HTTPS 배포 주소를 입력해 주세요.');
  base.search='';base.hash='';const results=[];
  const check=async(label,run)=>{try{const detail=await run();const result={ok:true,label,detail};results.push(result);onResult(result);}catch(error){const result={ok:false,label,detail:error.message};results.push(result);onResult(result);}};
  const get=async url=>{const response=await fetcher(url,{method:'GET',redirect:'error',signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error(`HTTP ${response.status}`);return response;};
  let html='';
  await check('게임 페이지',async()=>{const response=await get(base);if(!response.headers.get('content-type')?.includes('text/html'))throw Error('HTML 페이지가 아닙니다.');html=await response.text();if(!/id=["']root["']/.test(html))throw Error('게임 화면의 root를 찾지 못했습니다.');return 'HTML 응답 확인';});
  await check('게임 서버',async()=>{const response=await get(new URL('/api/health',base));if(!response.headers.get('content-type')?.includes('application/json'))throw Error('서버 경로가 JSON 대신 다른 페이지를 반환합니다.');const health=await response.json();if(health.ok!==true||health.app!=='tangbisil'||!['websocket','sse'].includes(health.transport??'sse'))throw Error('현재 탕비실 서버 응답이 아닙니다.');return `v${health.version??'?'} · ${health.transport??'sse'}`;});
  if(html)await check('실행 파일과 스타일',async()=>{
    const tags=html.match(/<(?:script|link)\b[^>]*>/gi)??[],assets=new Map();let entry=false;
    for(const tag of tags){const script=/^<script/i.test(tag)&&/\btype=["']module["']/i.test(tag),style=/^<link/i.test(tag)&&/\brel=["']stylesheet["']/i.test(tag);if(!script&&!style)continue;
      const path=tag.match(script?/\bsrc=["']([^"']+)["']/i:/\bhref=["']([^"']+)["']/i)?.[1];if(!path)continue;const url=new URL(path,base);if(url.origin!==base.origin)throw Error('다른 출처의 실행 파일은 이 검사에서 요청하지 않습니다.');assets.set(url.href,script?'javascript':'text/css');entry||=script;
    }
    if(!entry)throw Error('빌드된 진입 파일을 찾지 못했습니다.');
    for(const [url,type] of assets){const response=await get(url);if(!response.headers.get('content-type')?.includes(type))throw Error('실행 파일이나 스타일 대신 다른 페이지가 반환됩니다.');if(!(await response.text()).trim())throw Error('빈 실행 파일 또는 스타일입니다.');}
    return `${assets.size}개 응답 확인`;
  });
  return results;
}
export async function runVerificationCli(){
  if(!process.argv[2]){console.error('사용법: npm run verify:deploy -- <배포주소>');process.exitCode=2;return;}
  try{const results=await verifySite(process.argv[2],{onResult:r=>console.log(`${r.ok?'통과':'실패'} · ${r.label}: ${r.detail}`)});process.exitCode=results.every(r=>r.ok)?0:1;console.log('읽기 전용 검사입니다. 두 방문자의 실제 동기화·개인 저장은 별도 플레이 검수가 필요합니다.');}
  catch(error){console.error(error.message);process.exitCode=2;}
}
