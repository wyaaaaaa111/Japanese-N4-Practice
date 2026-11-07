'use strict';
const http=require('node:http'), fs=require('node:fs'), path=require('node:path');
const root=__dirname,port=Number(process.env.N4_PREVIEW_PORT)||4175;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'};
http.createServer((req,res)=>{
  let name;try{name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch(_){res.writeHead(400).end();return;}
  const filename=path.resolve(root,'.'+(name==='/'?'/index.html':name));
  if(!filename.startsWith(root+path.sep) || name.split('/').some(p=>p.startsWith('.'))){res.writeHead(403).end();return;}
  if(!['.html','.css','.js'].includes(path.extname(filename))){res.writeHead(404).end();return;}
  fs.readFile(filename,(err,bytes)=>{if(err){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':types[path.extname(filename)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(bytes);});
}).on('error',err=>{console.error(err.code==='EADDRINUSE'?`预览端口已在使用，请打开 http://127.0.0.1:${port}/ 或关闭旧的预览窗口。`:'预览无法启动，请检查本机 Node.js 环境。');process.exitCode=1;})
  .listen(port,'127.0.0.1',()=>{
    const url=`http://127.0.0.1:${port}/`;console.log(`N4 preview: ${url}`);
    if(process.argv.includes('--open')&&process.platform==='win32')require('node:child_process').spawn('cmd.exe',['/c','start','',url],{windowsHide:true});
  });
