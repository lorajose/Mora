import {DatabaseSync} from 'node:sqlite';
export function openStore(path){
  const db=new DatabaseSync(path);db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS votes(design TEXT NOT NULL,customer TEXT NOT NULL,PRIMARY KEY(design,customer));
    CREATE TABLE IF NOT EXISTS ratings(design TEXT NOT NULL,customer TEXT NOT NULL,rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),PRIMARY KEY(design,customer));
    CREATE TABLE IF NOT EXISTS comments(id INTEGER PRIMARY KEY,design TEXT NOT NULL,customer TEXT NOT NULL,text TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),updated INTEGER NOT NULL,UNIQUE(design,customer));
    CREATE TABLE IF NOT EXISTS limits(customer TEXT PRIMARY KEY,bucket INTEGER NOT NULL,count INTEGER NOT NULL);
  `);
  return {
    db,
    catalog(designs,customer){
      return designs.filter(d=>d.status==='coming-soon').map(d=>{
        const votes=db.prepare('SELECT count(*) AS count FROM votes WHERE design=?').get(d.id).count;
        const r=db.prepare('SELECT count(*) AS count,avg(rating) AS rating FROM ratings WHERE design=?').get(d.id);
        const comments=db.prepare("SELECT text FROM comments WHERE design=? AND status='approved' ORDER BY updated DESC,id DESC LIMIT 50").all(d.id);
        const mine=customer?{voted:!!db.prepare('SELECT 1 FROM votes WHERE design=? AND customer=?').get(d.id,customer),rating:db.prepare('SELECT rating FROM ratings WHERE design=? AND customer=?').get(d.id,customer)?.rating||null}:null;
        return {...d,votes,rating:r.rating||0,ratingCount:r.count,comments,mine};
      }).sort((a,b)=>b.votes-a.votes||a.id.localeCompare(b.id)).map((d,i)=>({...d,rank:i+1}));
    },
    limit(customer,now=Date.now()){
      const bucket=Math.floor(now/60000);
      const r=db.prepare('INSERT INTO limits(customer,bucket,count) VALUES(?,?,1) ON CONFLICT(customer) DO UPDATE SET count=CASE WHEN bucket=excluded.bucket THEN count+1 ELSE 1 END,bucket=excluded.bucket RETURNING count').get(customer,bucket);
      if(r.count>20)throw Object.assign(new Error('Please try again later'),{status:429});
    },
    write(design,customer,action,body){
      if(action==='vote'){
        if(typeof body.voted!=='boolean')throw Object.assign(new Error('Invalid vote'),{status:400});
        if(body.voted)db.prepare('INSERT OR IGNORE INTO votes(design,customer) VALUES(?,?)').run(design,customer);
        else db.prepare('DELETE FROM votes WHERE design=? AND customer=?').run(design,customer);
      }else if(action==='rating'){
        if(!Number.isInteger(body.rating)||body.rating<1||body.rating>5)throw Object.assign(new Error('Invalid rating'),{status:400});
        db.prepare('INSERT INTO ratings(design,customer,rating) VALUES(?,?,?) ON CONFLICT(design,customer) DO UPDATE SET rating=excluded.rating').run(design,customer,body.rating);
      }else if(action==='comment'){
        if(typeof body.text!=='string')throw Object.assign(new Error('Invalid comment'),{status:400});
        const text=body.text.trim();
        if(text.length<3||text.length>1000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text))throw Object.assign(new Error('Comment must contain 3 to 1000 characters'),{status:400});
        db.prepare("INSERT INTO comments(design,customer,text,status,updated) VALUES(?,?,?,'pending',?) ON CONFLICT(design,customer) DO UPDATE SET text=excluded.text,status='pending',updated=excluded.updated").run(design,customer,text,Date.now());
      }else throw Object.assign(new Error('Not found'),{status:404});
    },
    erase(customer){
      db.exec('BEGIN IMMEDIATE');try{for(const t of ['votes','ratings','comments','limits'])db.prepare('DELETE FROM '+t+' WHERE customer=?').run(customer);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
    }
  };
}
