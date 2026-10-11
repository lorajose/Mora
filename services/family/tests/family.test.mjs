import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {signature,authenticate,issueCsrf,verifyCsrf} from '../auth.mjs';
import {openStore} from '../store.mjs';
import {createFamilyServer} from '../server.mjs';
const secret='test-only-secret-with-32-characters';
const shop='d1xg7s-q3.myshopify.com';
function signed(path,customer='1'){
  const url=new URL('http://localhost'+path);url.searchParams.set('shop',shop);url.searchParams.set('logged_in_customer_id',customer);url.searchParams.set('path_prefix','/apps/mora-family');url.searchParams.set('timestamp',String(Math.floor(Date.now()/1000)));url.searchParams.set('signature',signature(url.searchParams,secret));return url;
}
test('Shopify documented canonical format handles repeated values',()=>{
  const url=new URL('https://test.invalid/?extra=1&extra=2&shop={shop}.myshopify.com&logged_in_customer_id=1&path_prefix=%2Fapps%2Fawesome_reviews&timestamp=1317327555');
  assert.equal(signature(url.searchParams,'hush'),'e71d571c0a35d531ae367189d59afd33ae5b56be274c77c9e8bd6ce42e256304');
});
test('proxy identity rejects forgery, other shops, expired timestamp and duplicates',()=>{
  const valid=signed('/proxy/catalog');assert.equal(authenticate(valid,secret,shop),'1');
  const forged=new URL(valid);forged.searchParams.set('logged_in_customer_id','2');assert.throws(()=>authenticate(forged,secret,shop));
  assert.throws(()=>authenticate(valid,secret,'other.myshopify.com'));
  assert.throws(()=>authenticate(valid,secret,shop,Date.now()+400000));
  const duplicate=signed('/proxy/catalog');duplicate.searchParams.append('logged_in_customer_id','2');duplicate.searchParams.set('signature',signature(duplicate.searchParams,secret));assert.throws(()=>authenticate(duplicate,secret,shop));
  assert.equal(authenticate(signed('/proxy/catalog',''),secret,shop),'');
});
test('CSRF is customer-bound, expires, and rejects tampering',()=>{
  const token=issueCsrf('1',secret);assert.equal(verifyCsrf(token,'1',secret),true);assert.equal(verifyCsrf(token,'2',secret),false);assert.equal(verifyCsrf(token+'x','1',secret),false);assert.equal(verifyCsrf(token,'1',secret,Date.now()+1000000),false);
});
test('votes persist, remain unique, sort ranking and hide pending comments/identities',()=>{
  const dir=mkdtempSync(join(tmpdir(),'mora-test-'));const path=join(dir,'test.sqlite');let store=openStore(path);
  const designs=['a','b','c','d'].map(id=>({id,status:'coming-soon',images:[]}));
  store.write('b','1','vote',{voted:true});store.write('b','1','vote',{voted:true});store.write('c','2','vote',{voted:true});store.write('c','3','vote',{voted:true});
  let rows=store.catalog(designs,'1');assert.deepEqual(rows.map(x=>x.id),['c','b','a','d']);assert.equal(rows[1].votes,1);
  store.write('b','1','rating',{rating:4});store.write('b','1','rating',{rating:5});assert.equal(store.catalog(designs,'1')[1].ratingCount,1);
  assert.throws(()=>store.write('b','1','rating',{rating:6}));assert.throws(()=>store.write('b','1','rating',{rating:2.5}));
  store.write('b','1','comment',{text:'<script>alert(1)</script>'});assert.equal(store.catalog(designs,'')[1].comments.length,0);
  store.db.prepare("UPDATE comments SET status='approved'").run();rows=store.catalog(designs,'');assert.equal(rows[1].comments[0].text,'<script>alert(1)</script>');assert.equal(JSON.stringify(rows).includes('customer'),false);
  store.write('b','1','comment',{text:'Edited feedback'});assert.equal(store.catalog(designs,'')[1].comments.length,0);
  store.db.close();store=openStore(path);assert.equal(store.catalog(designs,'1')[1].votes,1);store.write('b','1','vote',{voted:false});store.write('b','1','vote',{voted:false});assert.equal(store.catalog(designs,'1').find(x=>x.id==='b').votes,0);
  for(let i=0;i<20;i++)store.limit('1');assert.throws(()=>store.limit('1'));
  store.erase('1');assert.equal(store.db.prepare('SELECT count(*) AS n FROM ratings').get().n,0);
  store.db.close();rmSync(dir,{recursive:true});
});
test('HTTP endpoint requires signed member and CSRF; no browser-supplied identity',async()=>{
  const store=openStore(':memory:');const catalog={designs:[{id:'first',status:'coming-soon',images:[]},{id:'closed',status:'closed',images:[]}]};
  const server=createFamilyServer({secret,shop,catalog,store});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+server.address().port;
  const request=(path,customer,options)=>{const u=signed(path,customer);return fetch(base+u.pathname+u.search,options);};
  try{
    assert.equal((await fetch(base+'/proxy/catalog')).status,401);
    let r=await request('/proxy/catalog','');assert.equal(r.status,200);assert.equal((await r.json()).member,false);
    const data=await (await request('/proxy/catalog','1')).json();
    const post=body=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    assert.equal((await request('/proxy/designs/first/vote','',post({voted:true,customer:'1',csrf:data.csrf}))).status,401);
    assert.equal((await request('/proxy/designs/first/vote','2',post({voted:true,csrf:data.csrf}))).status,403);
    assert.equal((await request('/proxy/designs/first/vote','1',post({voted:true,csrf:data.csrf,customer:'2'}))).status,200);
    const updated=await (await request('/proxy/catalog','1')).json();assert.equal(updated.designs[0].votes,1);assert.equal(updated.designs[0].mine.voted,true);
    assert.equal((await request('/proxy/designs/closed/vote','1',post({voted:true,csrf:data.csrf}))).status,404);
    assert.equal((await request('/proxy/designs/first/rating','1',post({rating:0,csrf:data.csrf}))).status,400);
  }finally{await new Promise(r=>server.close(r));store.db.close();}
});
