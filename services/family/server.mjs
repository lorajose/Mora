import {createServer} from 'node:http';
import {readFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {authenticate,issueCsrf,verifyCsrf} from './auth.mjs';
import {openStore} from './store.mjs';
export function createFamilyServer({secret,shop,catalog,store}){
  if(!secret||secret.length<24||!shop?.endsWith('.myshopify.com'))throw new Error('Missing secure configuration');
  return createServer(async(req,res)=>{
    const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
    try{
      const url=new URL(req.url,'https://mora.invalid');
      const customer=authenticate(url,secret,shop);
      if(req.method==='GET'&&url.pathname==='/proxy/catalog')return send(200,{designs:store.catalog(catalog.designs,customer),member:!!customer,csrf:customer?issueCsrf(customer,secret):null});
      const match=url.pathname.match(/^\/proxy\/designs\/([a-z0-9-]+)\/(vote|rating|comment)$/);
      if(req.method!=='POST'||!match)return send(404,{error:'Not found'});
      if(!customer)return send(401,{error:'Sign in required'});
      if(!req.headers['content-type']?.startsWith('application/json'))return send(415,{error:'JSON required'});
      if(!catalog.designs.some(d=>d.id===match[1]&&d.status==='coming-soon'))return send(404,{error:'Design is not open for feedback'});
      const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>8192)return send(413,{error:'Request too large'});chunks.push(chunk);}
      let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return send(400,{error:'Invalid JSON'});}
      if(!body||typeof body!=='object'||Array.isArray(body))return send(400,{error:'Invalid JSON'});
      if(!verifyCsrf(body.csrf,customer,secret))return send(403,{error:'Refresh your session'});
      store.limit(customer);store.write(match[1],customer,match[2],body);
      send(200,{saved:true,pending:match[2]==='comment'});
    }catch(e){send(e.status||500,{error:e.status?e.message:'Service unavailable'});}
  });
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const dbPath=resolve(process.env.DATABASE_PATH||'./data/family.sqlite');mkdirSync(dirname(dbPath),{recursive:true,mode:0o700});
  const store=openStore(dbPath);
  const catalog=JSON.parse(readFileSync(new URL('../../assets/mora-coming-soon-catalog.json',import.meta.url)));
  const server=createFamilyServer({secret:process.env.SHOPIFY_API_SECRET,shop:process.env.SHOPIFY_SHOP_DOMAIN,catalog,store});
  server.requestTimeout=15000;server.headersTimeout=10000;
  server.listen(Number(process.env.PORT||3000),'127.0.0.1',()=>console.log('MORA Family service ready'));
}
