import { createRoot } from "react-dom/client";
import {Component,type ReactNode} from 'react';
import App from "./experience/Experience";

// A failed scene render must leave a way back instead of unmounting to a blank page.
class AppRecovery extends Component<{children:ReactNode},{failed:boolean}>{
  state={failed:false};
  static getDerivedStateFromError(){return{failed:true};}
  render(){
    if(!this.state.failed)return this.props.children;
    return <main role="alert" style={{minHeight:'100dvh',boxSizing:'border-box',display:'grid',placeContent:'center',gap:16,padding:24,background:'#f4f3e9',color:'#314a40',fontFamily:'system-ui, sans-serif',lineHeight:1.6}}>
      <h1 style={{fontSize:24,margin:0}}>화면을 다시 열어 주세요</h1>
      <p style={{margin:0}}>탕비실 화면을 준비하다 멈췄어요.<br/>저장된 간식과 음료 기록은 그대로 이어집니다.</p>
      <button onClick={()=>location.reload()} style={{minHeight:48,padding:'12px 20px',border:'1px solid #7d9272',borderRadius:12,background:'#314a40',color:'#fff',fontSize:18,cursor:'pointer'}}>탕비실 다시 열기</button>
    </main>;
  }
}

// A running preview may still reference a lazy chunk from the previous build.
// Recover once; all confirmed food and drink progress lives on the server.
window.addEventListener('vite:preloadError',event=>{
  if(!navigator.onLine)return;
  try{const key='tangbisil:asset-reload',last=Number(sessionStorage.getItem(key)||0);if(Date.now()-last<30000)return;sessionStorage.setItem(key,String(Date.now()));event.preventDefault();location.reload();}catch{}
});

createRoot(document.getElementById("root")!).render(<AppRecovery><App /></AppRecovery>);
