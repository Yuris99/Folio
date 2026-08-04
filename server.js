const http = require('http');
const fs = require('fs');
const path = require('path');
const root = __dirname;
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json'};
http.createServer((req,res)=>{
  const pathname = decodeURIComponent(req.url.split('?')[0]);
  const file = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const target = path.resolve(root,file);
  if(!target.startsWith(root)){res.writeHead(403);return res.end('Forbidden');}
  fs.readFile(target,(err,data)=>{if(err){res.writeHead(404);return res.end('Not found');}res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream'});res.end(data);});
}).listen(4173,()=>console.log('Folio is running at http://localhost:4173'));
