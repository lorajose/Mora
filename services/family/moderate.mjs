import {openStore} from './store.mjs';
const [action,id]=process.argv.slice(2);
const store=openStore(process.env.DATABASE_PATH||'./data/family.sqlite');
if(action==='pending')console.log(store.db.prepare("SELECT id,design,text,updated FROM comments WHERE status='pending' ORDER BY updated").all());
else if(['approve','reject'].includes(action)&&/^\d+$/.test(id||''))console.log(store.db.prepare('UPDATE comments SET status=? WHERE id=? RETURNING id,status').get(action==='approve'?'approved':'rejected',Number(id)));
else if(action==='erase-customer'&&/^[1-9]\d*$/.test(id||'')){store.erase(id);console.log('Customer participation erased');}
else {console.error('Use pending, approve ID, reject ID, or erase-customer ID');process.exitCode=1;}
store.db.close();
