const CACHE='oola-translate-v6';
const CORE=['./','./index.html','./manifest.json'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  // Never cache API/model traffic — always network.
  if(u.hostname.includes('script.google.com')||u.hostname.includes('jsdelivr')||u.hostname.includes('huggingface')) return;
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{
    if(e.request.method==='GET'&&res.ok&&u.origin===location.origin){const cc=res.clone();caches.open(CACHE).then(c=>c.put(e.request,cc));}
    return res;
  }).catch(()=>caches.match('./index.html'))));
});
