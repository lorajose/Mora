(() => {
  if (customElements.get('mora-coming-soon')) return;
  class MoraComingSoon extends HTMLElement {
    connectedCallback() {
      this.abort?.abort();
      this.abort = new AbortController();
      this.l = JSON.parse(this.querySelector('[data-soon-labels]').textContent);
      this.mount = this.querySelector('[data-soon-mount]');
      this.status = this.querySelector('[data-soon-status]');
      this.reduced = matchMedia('(prefers-reduced-motion: reduce)');
      this.paused = this.reduced.matches;
      this.visible = false;
      this.busy = false;
      this.ready = false;
      this.view = 0;
      this.selection = 0;
      this.addEventListener('click', e => this.click(e), {signal:this.abort.signal});
      this.addEventListener('submit', e => this.submit(e), {signal:this.abort.signal});
      this.addEventListener('change', e => this.rate(e), {signal:this.abort.signal});
      document.addEventListener('visibilitychange', () => this.clock(), {signal:this.abort.signal});
      this.addEventListener('focusin', () => this.clock(), {signal:this.abort.signal});
      this.addEventListener('focusout', () => setTimeout(() => this.clock(),0), {signal:this.abort.signal});
      this.reduced.addEventListener('change', e => {if(e.matches)this.paused=true;this.clock();}, {signal:this.abort.signal});
      this.observer = new IntersectionObserver(entries => {this.visible=entries[0].isIntersecting;this.clock();});
      this.observer.observe(this);
      this.init();
    }
    disconnectedCallback(){this.abort?.abort();this.observer?.disconnect();clearTimeout(this.timer);}
    el(tag, cls, text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
    button(text, action, id, quiet=false){const b=this.el('button','mora-soon__button'+(quiet?' mora-soon__button--quiet':''),text);b.type='button';b.dataset.action=action;if(id)b.dataset.design=id;return b;}
    async json(url,options={}){
      const r=await fetch(url,{...options,signal:this.abort.signal,cache:'no-store',credentials:'same-origin'});
      if(!r.ok||!r.headers.get('content-type')?.includes('application/json'))throw new Error('unavailable');
      return r.json();
    }
    async init(){
      try{
        const seed=await this.json(this.dataset.catalog);
        this.designs=seed.designs;
        if(this.dataset.enabled==='true'){
          try{await this.refresh();}catch{this.status.textContent=this.l.unavailable;}
        }
        this.render();this.clock();
      }catch{this.status.textContent=this.l.unavailable;}
    }
    async refresh(){
      const data=await this.json(this.dataset.proxy+'/catalog');
      if(!Array.isArray(data.designs)||!data.designs.length)throw new Error('catalog');
      this.designs=data.designs;this.member=data.member;this.csrf=data.csrf;this.ready=true;
      this.status.textContent=this.member?this.l.live:this.l.signin;
    }
    card(d,showcase){
      const card=this.el('article','mora-soon__card');card.dataset.id=d.id;
      const stage=this.el('div','mora-soon__stage');
      const badge=this.el('span','mora-soon__badge',this.ready&&d.rank?this.l.top+' / '+String(d.rank).padStart(2,'0'):this.l.preview);
      const img=this.el('img');const im=d.images[this.view%d.images.length];img.src=im.src;img.alt=im.alt;img.width=2048;img.height=2048;img.loading='lazy';stage.append(badge,img);
      const details=this.el('div','mora-soon__details');details.append(this.el('p','mora-soon__eyebrow',this.l.title),this.el('h3','',d.title),this.el('p','mora-soon__provisional',this.l.provisional));
      if(this.ready){const stats=this.el('div','mora-soon__stats');stats.append(this.el('span','',d.votes+' '+this.l.votes),this.el('span','',d.ratingCount?Number(d.rating).toFixed(1)+' / 5 · '+d.ratingCount+' '+this.l.rating:this.l.norating));details.append(stats);}
      const views=this.el('div','mora-soon__views');
      d.images.forEach((im,i)=>{const b=this.button(this.l.view+' '+(i+1),'view',d.id,true);b.className='';b.dataset.view=i;b.setAttribute('aria-label',im.alt);b.setAttribute('aria-pressed',String(i===this.view%d.images.length));b.textContent='';const thumb=this.el('img');thumb.src=im.src;thumb.alt='';thumb.loading='lazy';thumb.width=52;thumb.height=52;b.append(thumb);views.append(b);});
      if(showcase){const a=this.el('a','mora-soon__button',this.l.browse);a.href=this.dataset.page;details.append(a);}
      else{
        const actions=this.el('div','mora-soon__actions');const vote=this.button(d.mine?.voted?this.l.remove:this.l.vote,'vote',d.id);vote.disabled=!this.ready||!this.member||this.busy;vote.setAttribute('aria-pressed',String(!!d.mine?.voted));actions.append(vote);
        if(this.ready&&!this.member){const login=this.el('a','mora-soon__button mora-soon__button--quiet',this.l.signin);login.href=this.dataset.login;actions.append(login);}
        const refresh=this.button(this.l.refresh,'refresh',null,true);refresh.disabled=!this.ready||this.busy;actions.append(refresh);details.append(actions);
        const rating=this.el('label','mora-soon__rating',this.l.rate);const select=this.el('select');select.dataset.design=d.id;select.setAttribute('aria-label',this.l.rate);select.disabled=!this.ready||!this.member||this.busy;select.append(new Option('—',''));for(let i=1;i<=5;i++)select.append(new Option(i+' '+this.l.stars,String(i)));select.value=d.mine?.rating?String(d.mine.rating):'';rating.append(select);details.append(rating);
        const discussion=this.el('details','mora-soon__discussion');discussion.append(this.el('summary','',this.l.comments));
        if(!d.comments?.length)discussion.append(this.el('p','mora-soon__provisional',this.ready?this.l.empty:this.l.paused));
        for(const c of d.comments||[]){const quote=this.el('blockquote','mora-soon__comment',c.text);quote.append(this.el('cite','',this.l.family));discussion.append(quote);}
        const form=this.el('form');form.dataset.design=d.id;const field=this.el('textarea');field.name='comment';field.maxLength=1000;field.minLength=3;field.required=true;field.disabled=!this.ready||!this.member||this.busy;field.setAttribute('aria-label',this.l.comment);field.placeholder=this.l.comment_hint;form.append(field);const submit=this.button(this.l.submit,'submit',d.id);submit.type='submit';submit.disabled=field.disabled;form.append(submit);discussion.append(form);details.append(discussion);
      }
      const explore=this.button(this.l.explore,'explore',d.id,true);explore.classList.add('mora-soon__explore');stage.append(explore);
      card.append(stage,details,views);return card;
    }
    render(){
      const showcase=this.dataset.mode==='showcase';const grid=this.el('div','mora-soon__grid');
      if(showcase){this.top=this.designs.slice(0,3);this.selection%=this.top.length;grid.append(this.card(this.top[this.selection],true));}
      else this.designs.forEach(d=>grid.append(this.card(d,false)));
      this.mount.replaceChildren(grid);
      if(showcase){const controls=this.el('div','mora-soon__controls');controls.append(this.button(this.paused?this.l.play:this.l.pause,'pause',null,true),this.button(this.l.next,'next',null,true));this.mount.append(controls);}
    }
    showView(card,index){
      const d=this.designs.find(x=>x.id===card.dataset.id);if(!d)return;
      const i=index%d.images.length;const img=card.querySelector('.mora-soon__stage img');img.src=d.images[i].src;img.alt=d.images[i].alt;img.classList.remove('is-changing');void img.offsetWidth;img.classList.add('is-changing');
      card.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.view)===i)));
    }
    clock(){
      clearTimeout(this.timer);
      if(this.dataset.mode!=='showcase'||this.paused||!this.visible||document.hidden||this.contains(document.activeElement)||!this.designs?.length)return;
      this.timer=setTimeout(()=>{this.advance();this.clock();},8000);
    }
    advance(){
      this.view++;
      if(this.top.length>1){const alternatives=this.top.map((_,i)=>i).filter(i=>i!==this.selection);this.selection=alternatives[Math.floor(Math.random()*alternatives.length)];}
      this.render();
    }
    async click(e){
      const b=e.target.closest('[data-action]');if(!b||!this.contains(b)||b.disabled)return;
      if(b.dataset.action==='view'){this.paused=true;this.showView(b.closest('article'),Number(b.dataset.view));this.clock();}
      if(b.dataset.action==='pause'){this.paused=!this.paused;b.textContent=this.paused?this.l.play:this.l.pause;this.clock();}
      if(b.dataset.action==='next'){this.advance();this.clock();}
      if(b.dataset.action==='explore')this.explore(b.dataset.design,b);
      if(b.dataset.action==='refresh'){try{await this.refresh();this.render();}catch{this.status.textContent=this.l.unavailable;}}
      if(b.dataset.action==='vote'){const d=this.designs.find(x=>x.id===b.dataset.design);await this.write(d.id,'vote',{voted:!d.mine?.voted});}
    }
    async rate(e){if(e.target.matches('select[data-design]')&&e.target.value)await this.write(e.target.dataset.design,'rating',{rating:Number(e.target.value)});}
    explore(id,trigger){
      const d=this.designs.find(item=>item.id===id);if(!d)return;
      this.dialog?.remove();
      const dialog=this.el('dialog','mora-soon__viewer');this.dialog=dialog;
      const heading=this.el('h2','',d.title);heading.id='MoraViewer-'+Math.random().toString(36).slice(2);
      dialog.setAttribute('aria-labelledby',heading.id);
      const close=this.button(this.l.close,'viewer-close',null,true);close.addEventListener('click',()=>dialog.close());
      const canvas=this.el('div','mora-soon__viewer-canvas');canvas.tabIndex=0;canvas.setAttribute('aria-label',this.l.angles);
      const image=this.el('img');image.width=2048;image.height=2048;canvas.append(image);
      let angle=0,zoom=false,start=null;
      const show=()=>{image.src=d.images[angle].src;image.alt=d.images[angle].alt;image.style.transform=zoom?'scale(1.7)':'none';};
      const controls=this.el('div','mora-soon__controls');
      d.images.forEach((im,i)=>{const button=this.button(im.alt,'viewer-angle',null,true);button.addEventListener('click',()=>{angle=i;zoom=false;show();});controls.append(button);});
      const zoomButton=this.button(this.l.zoom,'viewer-zoom',null,true);zoomButton.addEventListener('click',()=>{zoom=!zoom;zoomButton.textContent=zoom?this.l.fit:this.l.zoom;show();});controls.append(zoomButton);
      canvas.addEventListener('pointerdown',e=>{start={x:e.clientX,y:e.clientY};});
      canvas.addEventListener('pointerup',e=>{if(start&&Math.abs(e.clientX-start.x)>65&&Math.abs(e.clientY-start.y)<55){angle=(angle^1)<d.images.length?(angle^1):0;zoom=false;show();}start=null;});
      canvas.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();angle=(angle^1)<d.images.length?(angle^1):0;zoom=false;show();}});
      const model=[...this.querySelectorAll('[data-soon-model]')].find(t=>t.dataset.design===id);
      if(model){
        const rotate=this.button(this.l.rotate,'viewer-model',null,true);
        const note=this.el('p','mora-soon__fine');
        rotate.addEventListener('click',()=>{
          canvas.replaceChildren(model.content.cloneNode(true));canvas.setAttribute('aria-label',this.l.rotate);
          note.textContent=model.dataset.approximate==='true'?this.l.model_notice:this.l.rotate_hint;
          note.hidden=false;
          zoomButton.disabled=true;controls.querySelectorAll('[data-action=viewer-angle]').forEach(b=>b.disabled=true);
          if(window.Shopify?.loadFeatures)Shopify.loadFeatures([{name:'model-viewer-ui',version:'1.0',onLoad:errors=>{if(!errors&&dialog.open&&Shopify.ModelViewerUI)new Shopify.ModelViewerUI(canvas.querySelector('model-viewer'));}}]);
        });controls.append(rotate);note.hidden=true;controls.append(note);
      }
      dialog.append(close,heading,canvas,controls);this.append(dialog);show();
      dialog.addEventListener('close',()=>{trigger.focus();dialog.remove();this.clock();},{once:true});
      dialog.showModal();this.clock();
    }
    async submit(e){if(!e.target.matches('form[data-design]'))return;e.preventDefault();await this.write(e.target.dataset.design,'comment',{text:e.target.elements.comment.value});}
    async write(id,action,body){
      if(!this.ready||!this.member||this.busy)return;
      this.busy=true;this.querySelectorAll('button,select,textarea').forEach(n=>n.disabled=true);
      try{await this.json(this.dataset.proxy+'/designs/'+encodeURIComponent(id)+'/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,csrf:this.csrf})});await this.refresh();this.render();this.status.textContent=action==='comment'?this.l.pending:this.l.saved;}
      catch{this.status.textContent=this.l.unavailable;this.render();}
      finally{this.busy=false;this.render();}
    }
  }
  customElements.define('mora-coming-soon',MoraComingSoon);
})();
