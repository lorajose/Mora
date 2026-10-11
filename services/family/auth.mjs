import {createHmac,timingSafeEqual,randomBytes} from 'node:crypto';
export function signature(params,secret){
  const keys=[...new Set(params.keys())].filter(k=>k!=='signature');
  const message=keys.map(k=>k+'='+params.getAll(k).join(',')).sort().join('');
  return createHmac('sha256',secret).update(message).digest('hex');
}
const equal=(a,b)=>{const x=Buffer.from(a);const y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
export function authenticate(url,secret,shop,now=Date.now()){
  const p=url.searchParams;
  for(const k of ['signature','shop','logged_in_customer_id','timestamp','path_prefix'])if(p.getAll(k).length!==1)throw Object.assign(new Error('Invalid proxy'),{status:401});
  if(!/^[a-f0-9]{64}$/.test(p.get('signature'))||!equal(signature(p,secret),p.get('signature')))throw Object.assign(new Error('Invalid proxy'),{status:401});
  if(p.get('shop')!==shop||!/^\d+$/.test(p.get('timestamp'))||Math.abs(now/1000-Number(p.get('timestamp')))>300)throw Object.assign(new Error('Invalid proxy'),{status:401});
  const customer=p.get('logged_in_customer_id');
  if(customer&&!/^[1-9]\d*$/.test(customer))throw Object.assign(new Error('Invalid customer'),{status:401});
  return customer;
}
export function issueCsrf(customer,secret,now=Date.now()){
  const payload=Buffer.from(JSON.stringify({customer,expires:Math.floor(now/1000)+900,nonce:randomBytes(16).toString('hex')})).toString('base64url');
  return payload+'.'+createHmac('sha256',secret).update('mora-csrf:'+payload).digest('hex');
}
export function verifyCsrf(token,customer,secret,now=Date.now()){
  if(typeof token!=='string'||token.length>1024)return false;
  const [payload,sig,...rest]=token.split('.');
  if(rest.length||!payload||!sig||!equal(createHmac('sha256',secret).update('mora-csrf:'+payload).digest('hex'),sig))return false;
  try{const data=JSON.parse(Buffer.from(payload,'base64url'));return data.customer===customer&&data.expires>=now/1000&&data.expires<=now/1000+901;}catch{return false;}
}
