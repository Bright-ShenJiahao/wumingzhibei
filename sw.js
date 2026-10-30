// 模板由 build.py 注入首页指纹及预缓存地址；不要手改生成的 sw.js。
const CACHE='wzb-4597e8864927b9a6';
const PRECACHE=["/index.html", "/pack/title/home.webp?v=dd7b8a9ba8", "/pack/title/tv_mask.png.webp?v=f657c4d64c", "/pack/fonts/result.woff2?v=faa53c4d29"];
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 await cache.addAll(PRECACHE);
 await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const key of await caches.keys())if(key.startsWith('wzb-')&&key!==CACHE)await caches.delete(key);
 await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE),navigation=request.mode==='navigate';
  const key=navigation?'/index.html':request;
  const cached=()=>cache.match(key);
  const network=()=>fetch(request).then(async response=>{if(response.ok)await cache.put(key,response.clone());else throw new Error('HTTP '+response.status);return response;});
  if(url.pathname.startsWith('/pack/')||/\.(woff2?|ttf|otf)$/.test(url.pathname))return await cached()||network();
  const fresh=network();
  // 超时返回旧首页后仍允许下载完成并更新，且处理失败，避免未处理拒绝。
  event.waitUntil(fresh.catch(()=>{}));
  try {
   if(!navigation)return await fresh;
   let timer;
   try{return await Promise.race([fresh,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('timeout')),4000);})]);}finally{clearTimeout(timer);}
  }catch(error){const old=await cached();if(old)return old;return fresh;}
 })());
});
