import { createRoot } from "react-dom/client";
import App from "./experience/Experience";

// A running preview may still reference a lazy chunk from the previous build.
// Recover once; all confirmed food and drink progress lives on the server.
window.addEventListener('vite:preloadError',event=>{
  if(!navigator.onLine)return;
  try{const key='tangbisil:asset-reload',last=Number(sessionStorage.getItem(key)||0);if(Date.now()-last<30000)return;sessionStorage.setItem(key,String(Date.now()));event.preventDefault();location.reload();}catch{}
});

createRoot(document.getElementById("root")!).render(<App />);
