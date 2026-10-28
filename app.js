/* ===== 1. DADOS: camada de armazenamento (localStorage). Para migrar para SQL, troque apenas este bloco por chamadas à API ===== */
const Store={key:'estoque.v1',mem:{products:[],moves:[]},
 load(){try{const r=localStorage.getItem(this.key);if(r)this.mem=JSON.parse(r)}catch(e){}},
 save(){try{localStorage.setItem(this.key,JSON.stringify(this.mem));return true}catch(e){return false}},
 get products(){return this.mem.products},get moves(){return this.mem.moves}};
function commit(fn){const s=JSON.stringify(Store.mem);fn();if(!Store.save()){Store.mem=JSON.parse(s);toast('Não foi possível salvar os dados no navegador. Nada foi alterado.','er');return false}return true}

/* ===== 2. UTILITÁRIOS ===== */
const $=s=>document.querySelector(s),A=$('#app');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const brl=n=>Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const dt=i=>{const d=new Date(i);return d.toLocaleDateString('pt-BR')+' '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})};
const dd=i=>new Date(i).toLocaleDateString('pt-BR');
const ymd=d=>{const x=new Date(d);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0')};
const ago=n=>ymd(Date.now()-n*864e5),uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const nowLocal=()=>{const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,16)};
function toast(m,t='ok'){const e=document.createElement('div');e.className='t-'+t;e.textContent=m;$('#toast').append(e);setTimeout(()=>e.remove(),t=='er'?6000:3500)}

/* ===== 3. REGRAS DE NEGÓCIO ===== */
const act=()=>Store.products.filter(p=>!p.archived),find=id=>Store.products.find(p=>p.id===id);
const status=p=>p.qty<=0?'zero':p.qty<p.min?'low':'ok';
const SL={ok:'Normal',low:'Estoque baixo',zero:'Sem estoque'},SI={ok:'✓',low:'▲',zero:'✕'};
const missing=p=>Math.max(0,p.min-p.qty);
const alertMsg=p=>status(p)=='zero'?`SEM ESTOQUE: O produto ${p.name} está esgotado. O estoque mínimo é de ${p.min} unidades. Recomenda-se repor pelo menos ${missing(p)} unidades.`:`ATENÇÃO: O produto ${p.name} está com apenas ${p.qty} unidades disponíveis. O estoque mínimo é de ${p.min} unidades. Recomenda-se repor pelo menos ${missing(p)} unidades.`;
function vm(t,p,q){if(!p||p.archived)return 'Produto não encontrado.';if(!Number.isInteger(q)||q<=0)return 'Informe uma quantidade inteira maior que zero.';
 if(t=='out'&&q>p.qty)return `Quantidade indisponível: ${p.name} tem apenas ${p.qty} unidade(s) em estoque e você tentou retirar ${q}.`;return null}
function move(t,p,q,o={}){const e=vm(t,p,q);if(e)return e;
 const ok=commit(()=>{const b=p.qty,a=t=='in'?b+q:b-q;p.qty=a;Store.moves.push({id:uid(),pid:p.id,name:p.name,sku:p.sku,type:t,qty:q,at:o.at||new Date().toISOString(),reason:o.reason||(t=='in'?'Entrada de mercadoria':'Saída'),supplier:o.supplier||'',note:o.note||'',before:b,after:a})});
 return ok?null:'Falha ao salvar.'}
function addProduct(d,at){const p={id:uid(),name:d.name,sku:d.sku,cat:d.cat,desc:d.desc||'',qty:0,min:d.min,cost:d.cost,price:d.price,supplier:d.supplier,created:at||new Date().toISOString()};
 Store.products.push(p);if(d.qty>0){const x=p.qty=d.qty;Store.moves.push({id:uid(),pid:p.id,name:p.name,sku:p.sku,type:'in',qty:x,at:p.created,reason:'Saldo inicial',supplier:p.supplier,note:'',before:0,after:x})}return p}
const hasMoves=id=>Store.moves.some(m=>m.pid===id);

/* ===== 4. COMPONENTES ===== */
const bar=p=>`<div class="bar" title="${p.qty} de ${p.min} (mínimo)"><i class="${status(p)}" style="width:${p.min>0?Math.min(100,Math.round(p.qty/p.min*100)):(p.qty>0?100:0)}%"></i></div>`;
const badge=p=>`<span class="badge b-${status(p)}">${SI[status(p)]} ${SL[status(p)]}</span>`;
const tbadge=m=>`<span class="badge b-${m.type}">${m.type=='in'?'⬇ Entrada':'⬆ Saída'}</span>`;
const empty=()=>`<div class="card empty"><h2>Nenhum produto cadastrado</h2><p>Cadastre seu primeiro produto para acompanhar quantidades, registrar entradas e saídas e receber alertas de reposição.</p><button onclick="productForm()">Cadastrar primeiro produto</button><button class="ghost" onclick="seed()">Carregar dados de exemplo</button></div>`;
const mrow=m=>`<tr><td>${dt(m.at)}</td><td>${esc(m.name)}</td><td>${tbadge(m)}</td><td class="r">${m.qty}</td><td>${esc(m.reason)}</td></tr>`;
function ask(html,ok='Confirmar'){return new Promise(r=>{const d=$('#dlg');d.innerHTML=`<div>${html}<div class="acts"><button class="ghost" id="no">Cancelar</button><button id="yes">${ok}</button></div></div>`;let v=false;$('#yes').onclick=()=>{v=true;d.close()};$('#no').onclick=()=>d.close();d.onclose=()=>r(v);d.showModal()})}
async function csv(name,head,rows){const t='\ufeff'+[head,...rows].map(r=>r.map(c=>`"${String(c??'').replace(/"/g,'""')}"`).join(';')).join('\r\n');
 try{const d=window.claude?await claude.use('downloads'):null;
  if(d){await d.save({filename:name,data:t});toast('Arquivo exportado.')}
  else{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([t],{type:'text/csv'}));a.download=name;a.click();toast('Arquivo exportado.')}}
 catch(e){if(e&&e.code!=='declined')toast('Não foi possível exportar o arquivo.','er')}}
const n2=n=>Number(n).toFixed(2).replace('.',',');
function chart(days){const W=700,H=190,pb=24,mx=Math.max(1,...days.flatMap(x=>[x.i,x.o])),bw=W/days.length,k=(H-pb-10)/mx;
 return `<div class="leg"><span><i class="ci"></i>Entradas (un.)</span><span><i class="co"></i>Saídas (un.)</span></div><svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Entradas e saídas por dia">`+days.map((x,i)=>{const c=i*bw;
 return `<rect class="ci" x="${c+bw*.14}" y="${H-pb-x.i*k}" width="${bw*.34}" height="${x.i*k}" rx="2"><title>${x.l}: ${x.i} un. entraram</title></rect><rect class="co" x="${c+bw*.52}" y="${H-pb-x.o*k}" width="${bw*.34}" height="${x.o*k}" rx="2"><title>${x.l}: ${x.o} un. saíram</title></rect>`+(i%2==0?`<text x="${c+bw/2}" y="${H-7}" text-anchor="middle">${x.l}</text>`:'')}).join('')+`<line x1="0" x2="${W}" y1="${H-pb}" y2="${H-pb}" stroke="var(--bd)"/></svg>`}
function daily(from,to){const o=[];for(let d=new Date(from+'T12:00');ymd(d)<=to;d.setDate(d.getDate()+1)){const k=ymd(d),ms=Store.moves.filter(m=>ymd(m.at)==k);o.push({k,l:d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}),i:ms.filter(m=>m.type=='in').reduce((s,m)=>s+m.qty,0),o:ms.filter(m=>m.type=='out').reduce((s,m)=>s+m.qty,0),ni:ms.filter(m=>m.type=='in').length,no:ms.filter(m=>m.type=='out').length})}return o}

/* ===== 5. TELAS + EXPLICAÇÃO DO SKU:  SKU quer dizer "Stock Keeping Unit", que em português é algo como
  "unidade de controle de estoque".

  Na prática, o SKU é um código que identifica cada produto da loja.
  É como se fosse o RG do produto: dois produtos podem ter nomes parecidos,
  mas cada um tem o seu código, então não dá para confundir um com o outro. ===== */
const V={};let cur='dashboard',pre='',busy=false;
let F={q:'',cat:'',st:'',sort:'name'},H={pid:'',type:'',from:'',to:''},R={from:ago(30),to:ymd(new Date())};

V.dashboard=()=>{const ps=act();if(!ps.length)return '<h1>Painel</h1>'+empty();
 const low=ps.filter(p=>status(p)=='low'),zero=ps.filter(p=>status(p)=='zero'),al=[...zero,...low],rec=Store.moves.filter(m=>ymd(m.at)>=ago(6)),
 sm=t=>rec.filter(m=>m.type==t).reduce((s,m)=>s+m.qty,0),cn=t=>rec.filter(m=>m.type==t).length;
 return `<h1>Painel</h1><div class="grid">
 <div class="card kpi"><b>${ps.length}</b><span>Produtos cadastrados</span></div>
 <div class="card kpi"><b>${ps.reduce((s,p)=>s+p.qty,0)}</b><span>Unidades em estoque</span></div>
 <div class="card kpi low"><b>▲ ${low.length}</b><span>Estoque baixo</span></div>
 <div class="card kpi zero"><b>✕ ${zero.length}</b><span>Sem estoque</span></div>
 <div class="card kpi"><b>${sm('in')} un.</b><span>Entradas nos últimos 7 dias (${cn('in')} registros)</span></div>
 <div class="card kpi"><b>${sm('out')} un.</b><span>Saídas nos últimos 7 dias (${cn('out')} registros)</span></div></div>
 <div class="card"><h3>Alertas de reposição</h3>${al.length?al.map(p=>`<div class="alert ${status(p)}"><span>${SI[status(p)]}</span><span>${esc(alertMsg(p))}</span></div>`).join('')+'<button class="ghost sm" onclick="go(\'reposicao\')">Ver lista de reposição</button>':'<div class="alert ok">✓ Nenhum alerta: todos os produtos estão acima do estoque mínimo.</div>'}</div>
 <div class="two"><div class="card"><h3>Entradas e saídas nos últimos 14 dias</h3>${chart(daily(ago(13),ymd(new Date())))}</div>
 <div class="card scroll"><h3 style="padding:16px 16px 0">Últimas movimentações</h3>${Store.moves.length?`<table><tr><th>Data</th><th>Produto</th><th>Tipo</th><th class="r">Qtd.</th><th>Motivo</th></tr>${[...Store.moves].sort((a,b)=>b.at.localeCompare(a.at)).slice(0,8).map(mrow).join('')}</table>`:'<p class="muted" style="padding:0 16px">Nenhuma movimentação ainda.</p>'}</div></div>`};

V.produtos=()=>{if(!act().length)return '<h1>Produtos</h1>'+empty();const cats=[...new Set(act().map(p=>p.cat))].sort();
 const o=(v,l,c)=>`<option value="${esc(v)}" ${c==v?'selected':''}>${esc(l)}</option>`;
 return `<div class="head"><h1>Produtos</h1><div><button class="ghost" onclick="expP()">Exportar CSV</button><button onclick="productForm()">Novo produto</button></div></div>
 <div class="card tools"><input type="search" placeholder="Buscar por nome ou SKU" aria-label="Buscar" value="${esc(F.q)}" oninput="F.q=this.value;drawP()">
 <select aria-label="Categoria" onchange="F.cat=this.value;drawP()">${o('','Todas as categorias',F.cat)}${cats.map(c=>o(c,c,F.cat)).join('')}</select>
 <select aria-label="Situação" onchange="F.st=this.value;drawP()">${o('','Todos os produtos',F.st)}${o('ok','Estoque normal',F.st)}${o('low','Estoque baixo',F.st)}${o('zero','Sem estoque',F.st)}</select>
 <select aria-label="Ordenar" onchange="F.sort=this.value;drawP()">${o('name','Ordenar por nome',F.sort)}${o('qty','Ordenar por quantidade',F.sort)}${o('lvl','Ordenar por nível de estoque',F.sort)}</select></div>
 <div class="card scroll" id="tbl"></div>`};
function listP(){const q=F.q.toLowerCase();let l=act().filter(p=>(!q||p.name.toLowerCase().includes(q)||p.sku.toLowerCase().includes(q))&&(!F.cat||p.cat==F.cat)&&(!F.st||status(p)==F.st));
 const lv=p=>p.min>0?p.qty/p.min:(p.qty>0?9:0);return l.sort((a,b)=>F.sort=='qty'?a.qty-b.qty:F.sort=='lvl'?lv(a)-lv(b):a.name.localeCompare(b.name,'pt-BR'))}
function drawP(){const l=listP();$('#tbl').innerHTML=l.length?`<table><tr><th>Produto</th><th>Categoria</th><th class="r">Qtd.</th><th>Nível</th><th class="r">Mínimo</th><th class="r">Custo</th><th class="r">Venda</th><th>Situação</th><th></th></tr>${l.map(p=>`<tr><td>${esc(p.name)}<small>${esc(p.sku)} · ${esc(p.supplier)}</small></td><td>${esc(p.cat)}</td><td class="r"><b>${p.qty}</b></td><td>${bar(p)}${status(p)!='ok'?`<small>faltam ${missing(p)}</small>`:''}</td><td class="r">${p.min}</td><td class="r">${brl(p.cost)}</td><td class="r">${brl(p.price)}</td><td>${badge(p)}</td><td><button class="ghost sm" onclick="productForm('${p.id}')">Editar</button> <button class="danger sm" onclick="delP('${p.id}')">Excluir</button></td></tr>`).join('')}</table>`:'<p class="muted" style="padding:16px">Nenhum produto encontrado com esses filtros.</p>'}
function expP(){csv('produtos.csv',['Nome','SKU','Categoria','Descrição','Quantidade','Estoque mínimo','Situação','Preço de custo','Preço de venda','Fornecedor','Cadastro'],listP().map(p=>[p.name,p.sku,p.cat,p.desc,p.qty,p.min,SL[status(p)],n2(p.cost),n2(p.price),p.supplier,dd(p.created)]))}

function productForm(id){const p=id?find(id):null,v=k=>esc(p?p[k]:'');
 $('#dlg').innerHTML=`<h3>${p?'Editar produto':'Novo produto'}</h3><form class="form" onsubmit="saveP(event,'${id||''}')">
 <label>Nome do produto *<input name="name" required value="${v('name')}"></label><label>SKU (único) *<input name="sku" required value="${v('sku')}"></label>
 <label>Categoria *<input name="cat" required list="cats" value="${v('cat')}"><datalist id="cats">${[...new Set(act().map(x=>x.cat))].map(c=>`<option value="${esc(c)}">`).join('')}</datalist></label><label>Fornecedor *<input name="supplier" required value="${v('supplier')}"></label>
 <label class="full">Descrição (opcional)<textarea name="desc" rows="2">${v('desc')}</textarea></label>
 ${p?`<label>Quantidade atual<input value="${p.qty}" disabled></label>`:'<label>Quantidade inicial *<input name="qty" type="number" min="0" step="1" required value="0"></label>'}
 <label>Estoque mínimo *<input name="min" type="number" min="0" step="1" required value="${p?p.min:5}"></label>
 <label>Preço de custo (R$) *<input name="cost" type="number" min="0" step="0.01" required value="${p?p.cost:''}"></label><label>Preço de venda (R$) *<input name="price" type="number" min="0" step="0.01" required value="${p?p.price:''}"></label>
 ${p?'<p class="muted full">A quantidade só muda por entradas e saídas, para manter o histórico fiel.</p>':''}
 <div class="ferr" id="ferr" role="alert"></div><div class="acts"><button type="button" class="ghost" onclick="$('#dlg').close()">Cancelar</button><button>Salvar produto</button></div></form>`;$('#dlg').showModal()}
function saveP(e,id){e.preventDefault();const v=Object.fromEntries(new FormData(e.target));for(const k in v)v[k]=v[k].trim();
 const fe=m=>{$('#ferr').textContent=m},num=k=>v[k]===''||v[k]===undefined?NaN:Number(v[k]),qty=id?0:num('qty'),min=num('min'),cost=num('cost'),price=num('price');
 if(!v.name||!v.sku||!v.cat||!v.supplier)return fe('Preencha nome, SKU, categoria e fornecedor.');
 if(!id&&!(Number.isInteger(qty)&&qty>=0))return fe('A quantidade inicial deve ser um número inteiro maior ou igual a zero.');
 if(!(Number.isInteger(min)&&min>=0))return fe('O estoque mínimo deve ser um número inteiro maior ou igual a zero.');
 if(!(cost>=0)||!(price>=0))return fe('Informe preços válidos, maiores ou iguais a zero.');
 if(Store.products.some(p=>p.id!==id&&p.sku.toLowerCase()===v.sku.toLowerCase()))return fe('Já existe um produto com este SKU. Use um código diferente.');
 const d={name:v.name,sku:v.sku,cat:v.cat,desc:v.desc,supplier:v.supplier,min,cost,price,qty};
 if(commit(()=>{if(id){const p=find(id);Object.assign(p,{name:d.name,sku:d.sku,cat:d.cat,desc:d.desc,supplier:d.supplier,min,cost,price});Store.moves.forEach(m=>{if(m.pid==id){m.name=d.name;m.sku=d.sku}})}else addProduct(d)})){$('#dlg').close();toast(id?'Produto atualizado.':'Produto cadastrado.');render()}}
async function delP(id){const p=find(id),h=hasMoves(id);
 if(!await ask(h?`<h3>Arquivar ${esc(p.name)}?</h3><p>Este produto tem movimentações. Para preservar o histórico, ele será arquivado: sai das listas e dos formulários, e as movimentações continuam visíveis.</p>`:`<h3>Excluir ${esc(p.name)}?</h3><p>Este produto não tem movimentações. A exclusão não pode ser desfeita.</p>`,h?'Arquivar':'Excluir'))return;
 if(commit(()=>{if(h)p.archived=true;else Store.mem.products=Store.products.filter(x=>x.id!==id)})){toast(h?'Produto arquivado. Histórico preservado.':'Produto excluído.');render()}}

function moveView(t){const ps=act();if(!ps.length)return `<h1>${t=='in'?'Entrada':'Saída'} de produtos</h1>`+empty();const IN=t=='in';
 return `<h1>${IN?'Registrar entrada':'Registrar saída'}</h1><form class="card form" onsubmit="submitMove(event,'${t}')">
 <label class="full">Produto *<select name="pid" required onchange="pickP(this)"><option value="">Selecione um produto</option>${[...ps].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')).map(p=>`<option value="${p.id}" ${pre==p.id?'selected':''}>${esc(p.name)} (${esc(p.sku)})</option>`).join('')}</select></label>
 <div id="info" class="muted"></div>
 <label>${IN?'Quantidade recebida':'Quantidade retirada'} *<input name="qty" type="number" min="1" step="1" required inputmode="numeric"></label>
 <label>Data e hora *<input name="at" type="datetime-local" required value="${nowLocal()}"></label>
 ${IN?'<label class="full">Fornecedor *<input name="supplier" required></label>':'<label class="full">Motivo da saída *<select name="reason"><option>Venda</option><option>Consumo interno</option><option>Perda</option><option>Avaria</option></select></label>'}
 <label class="full">Observações (opcional)<textarea name="note" rows="2"></textarea></label>
 <button id="sb">${IN?'Confirmar entrada':'Confirmar saída'}</button></form>`}
V.entrada=()=>moveView('in');V.saida=()=>moveView('out');
function pickP(s){const p=find(s.value),i=$('#info');if(!p){i.textContent='';return}
 i.innerHTML=`Em estoque: <b>${p.qty}</b> un. · Mínimo: ${p.min} · ${badge(p)}`;const f=s.form.supplier;if(f&&!f.value)f.value=p.supplier}
async function submitMove(e,t){e.preventDefault();if(busy)return;const f=e.target,v=Object.fromEntries(new FormData(f)),p=find(v.pid),q=Number(v.qty),er=vm(t,p,q);
 if(er)return toast(er,'er');busy=true;f.querySelector('#sb').disabled=true;
 const ok=await ask(`<h3>Confirmar ${t=='in'?'entrada':'saída'}?</h3><p><b>${q}</b> un. de <b>${esc(p.name)}</b></p><p class="muted">Estoque: ${p.qty} → ${t=='in'?p.qty+q:p.qty-q}</p>`);
 if(!ok){busy=false;f.querySelector('#sb').disabled=false;return}
 const r=move(t,p,q,{at:new Date(v.at).toISOString(),reason:v.reason,supplier:v.supplier,note:v.note});busy=false;
 if(r){f.querySelector('#sb').disabled=false;return toast(r,'er')}
 toast(t=='in'?'Entrada registrada. Estoque atualizado.':'Saída registrada. Estoque atualizado.');if(status(p)!='ok')toast(alertMsg(p),'er');pre='';render()}

function hm(){return Store.moves.filter(m=>(!H.pid||m.pid==H.pid)&&(!H.type||m.type==H.type)&&(!H.from||ymd(m.at)>=H.from)&&(!H.to||ymd(m.at)<=H.to)).sort((a,b)=>b.at.localeCompare(a.at))}
V.historico=()=>{const names=[...new Map(Store.moves.map(m=>[m.pid,m.name]))];
 return `<div class="head"><h1>Histórico de movimentações</h1><button class="ghost" onclick="expH()">Exportar CSV</button></div>
 <div class="card tools" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))"><select aria-label="Produto" onchange="H.pid=this.value;drawH()"><option value="">Todos os produtos</option>${names.map(([i,n])=>`<option value="${i}" ${H.pid==i?'selected':''}>${esc(n)}</option>`).join('')}</select>
 <select aria-label="Tipo" onchange="H.type=this.value;drawH()"><option value="">Entradas e saídas</option><option value="in" ${H.type=='in'?'selected':''}>Somente entradas</option><option value="out" ${H.type=='out'?'selected':''}>Somente saídas</option></select>
 <label>De<input type="date" value="${H.from}" onchange="H.from=this.value;drawH()"></label><label>Até<input type="date" value="${H.to}" onchange="H.to=this.value;drawH()"></label></div>
 <div class="card scroll" id="htb"></div><p class="muted">O histórico é somente leitura: movimentações não podem ser apagadas.</p>`};
function drawH(){const l=hm();$('#htb').innerHTML=l.length?`<table><tr><th>Data e hora</th><th>Produto</th><th>Tipo</th><th class="r">Qtd.</th><th>Motivo</th><th class="r">Antes</th><th class="r">Depois</th><th>Observações</th></tr>${l.map(m=>`<tr><td>${dt(m.at)}</td><td>${esc(m.name)}<small>${esc(m.sku)}</small></td><td>${tbadge(m)}</td><td class="r">${m.qty}</td><td>${esc(m.reason)}</td><td class="r">${m.before}</td><td class="r">${m.after}</td><td>${esc(m.note)}</td></tr>`).join('')}</table>`:'<p class="muted" style="padding:16px">Nenhuma movimentação encontrada.</p>'}
function expH(){csv('movimentacoes.csv',['Data e hora','Produto','SKU','Tipo','Quantidade','Motivo','Estoque anterior','Estoque posterior','Fornecedor','Observações'],hm().map(m=>[dt(m.at),m.name,m.sku,m.type=='in'?'Entrada':'Saída',m.qty,m.reason,m.before,m.after,m.supplier,m.note]))}

const rep=()=>act().filter(p=>status(p)!='ok').sort((a,b)=>missing(b)-missing(a));
V.reposicao=()=>{if(!act().length)return '<h1>Lista de reposição</h1>'+empty();const l=rep();
 if(!l.length)return '<h1>Lista de reposição</h1><div class="alert ok">✓ Nenhum produto precisa de reposição agora.</div>';
 return `<div class="head"><h1>Lista de reposição</h1><button class="ghost" onclick="expR()">Exportar CSV</button></div><div class="card scroll"><table><tr><th>Produto</th><th>Fornecedor</th><th class="r">Disponível</th><th class="r">Mínimo</th><th>Nível</th><th class="r">Repor (sugestão)</th><th class="r">Custo estimado</th><th></th></tr>${l.map(p=>`<tr><td>${esc(p.name)}<small>${badge(p)}</small></td><td>${esc(p.supplier)}</td><td class="r">${p.qty}</td><td class="r">${p.min}</td><td>${bar(p)}</td><td class="r"><b>${missing(p)}</b></td><td class="r">${brl(missing(p)*p.cost)}</td><td><button class="sm" onclick="pre='${p.id}';go('entrada')">Registrar entrada</button></td></tr>`).join('')}<tr><td colspan="6"><b>Total estimado da reposição</b></td><td class="r"><b>${brl(l.reduce((s,p)=>s+missing(p)*p.cost,0))}</b></td><td></td></tr></table></div><p class="muted">A sugestão repõe o necessário para atingir o estoque mínimo.</p>`};
function expR(){csv('reposicao.csv',['Produto','SKU','Fornecedor','Disponível','Mínimo','Quantidade sugerida','Custo estimado'],rep().map(p=>[p.name,p.sku,p.supplier,p.qty,p.min,missing(p),n2(missing(p)*p.cost)]))}

V.relatorios=()=>{const ms=Store.moves.filter(m=>ymd(m.at)>=R.from&&ymd(m.at)<=R.to),by=t=>{const m=new Map();ms.filter(x=>x.type==t).forEach(x=>m.set(x.name,(m.get(x.name)||0)+x.qty));return[...m].sort((a,b)=>b[1]-a[1]).slice(0,5)},
 tot=t=>ms.filter(m=>m.type==t).reduce((s,m)=>s+m.qty,0),days=daily(R.from,R.to).filter(d=>d.ni||d.no).reverse(),
 top=(t,l)=>`<div class="card"><h3>${l}</h3>${by(t).map(([n,q])=>`<p style="margin:6px 0">${esc(n)} <b style="float:right">${q} un.</b></p>`).join('')||'<p class="muted">Sem movimentações no período.</p>'}</div>`;
 return `<h1>Relatórios</h1><div class="card tools" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))"><label>De<input type="date" value="${R.from}" onchange="R.from=this.value;render()"></label><label>Até<input type="date" value="${R.to}" onchange="R.to=this.value;render()"></label></div>
 <div class="grid"><div class="card kpi"><b>${tot('in')} un.</b><span>Entradas no período</span></div><div class="card kpi"><b>${tot('out')} un.</b><span>Saídas no período</span></div><div class="card kpi"><b>${ms.length}</b><span>Movimentações</span></div></div>
 <div class="two">${top('in','Produtos com mais entradas')}${top('out','Produtos com mais saídas')}</div>
 <div class="card scroll" style="margin-top:16px"><h3 style="padding:16px 16px 0">Movimentações por dia</h3>${days.length?`<table><tr><th>Dia</th><th class="r">Entradas (un.)</th><th class="r">Saídas (un.)</th></tr>${days.map(d=>`<tr><td>${dd(d.k+'T12:00')}</td><td class="r">${d.i}</td><td class="r">${d.o}</td></tr>`).join('')}</table>`:'<p class="muted" style="padding:0 16px 16px">Sem movimentações no período.</p>'}</div>`};

/* ===== 6. NAVEGAÇÃO E INÍCIO ===== */
const NAV=[['dashboard','▦','Painel'],['produtos','▤','Produtos'],['entrada','⬇','Entrada'],['saida','⬆','Saída'],['historico','☰','Histórico'],['reposicao','⚑','Reposição'],['relatorios','◔','Relatórios']];
function go(v){cur=v;render();window.scrollTo(0,0)}
function render(){const n=act().filter(p=>status(p)!='ok').length;
 $('#nav').innerHTML='<h2>Controle de Estoque</h2>'+NAV.map(([k,i,l])=>`<button class="${k==cur?'on':''}" ${k==cur?'aria-current="page"':''} onclick="go('${k}')"><span aria-hidden="true">${i}</span>${l}${k=='reposicao'&&n?`<span class="n" title="${n} produto(s) para repor">${n}</span>`:''}</button>`).join('');
 A.innerHTML=V[cur]();if($('#tbl'))drawP();if($('#htb'))drawH();const s=A.querySelector('select[name=pid]');if(s&&s.value)pickP(s)}
function seed(){const D=n=>new Date(Date.now()-n*864e5).toISOString(),P=(name,sku,cat,qty,min,cost,price,supplier,d)=>addProduct({name,sku,cat,qty,min,cost,price,supplier},D(d)),
 mv=(t,p,q,d,r,s)=>{const x=p.qty;p.qty=t=='in'?x+q:x-q;Store.moves.push({id:uid(),pid:p.id,name:p.name,sku:p.sku,type:t,qty:q,at:D(d),reason:r,supplier:s||'',note:'',before:x,after:p.qty})};
 commit(()=>{let a=P('Teclado USB','TEC-001','Periféricos',14,10,32,59.9,'TechDistrib',10);mv('out',a,10,2,'Venda');
 a=P('Mouse sem fio','MOU-002','Periféricos',20,10,24,49.9,'TechDistrib',10);mv('in',a,15,5,'Entrada de mercadoria','TechDistrib');mv('out',a,10,1,'Venda');
 a=P('Monitor 24"','MON-003','Monitores',8,5,620,899,'VisionCorp',10);mv('out',a,8,3,'Venda');
 a=P('Cabo HDMI 2 m','CAB-004','Cabos',50,20,9,24.9,'ConectaMais',10);mv('in',a,30,6,'Entrada de mercadoria','ConectaMais');mv('out',a,20,4,'Consumo interno');
 a=P('Papel A4 (caixa)','PAP-005','Papelaria',30,15,185,239,'Papelaria Central',10);mv('out',a,18,2,'Consumo interno');
 P('Cadeira de escritório','CAD-006','Móveis',8,3,310,489,'MóvelPro',10)});toast('Dados de exemplo carregados.');render()}
Store.load();render();