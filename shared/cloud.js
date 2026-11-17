/* 클라우드 저장(Supabase): 학생 로그인 + 가상 환자 사례 저장, 교수는 전체 조회 */
(function(){
  const APP=window.APP_ID;
  if(!window.supabase||!window.PTQ_CONFIG){console.warn('Supabase 설정이 없어 클라우드 저장을 끕니다.');return;}
  const sb=window.supabase.createClient(PTQ_CONFIG.url,PTQ_CONFIG.key);
  // 교수 통합 로그인: 학습 포털에서 넘어온 한 번 쓰는 로그인 표(#sso=…)
  const SSO=(location.hash.match(/^#sso=([A-Za-z0-9_-]+)/)||[])[1];
  if(SSO){history.replaceState(null,'',location.pathname+location.search);sb.auth.verifyOtp({token_hash:SSO,type:'magiclink'}).catch(()=>{});}
  let user=null, profile=null, curId=null, curOwner=true, list=[], filterStudent='';

  /* ---------- 스타일 ---------- */
  const st=document.createElement('style');st.textContent=`
.cloud-box{display:flex;align-items:center;gap:6px;margin-left:8px;flex-wrap:wrap}
.cloud-box .who{font-size:12.5px;color:var(--muted);text-align:right;line-height:1.3}
.cloud-box .who b{color:var(--ink);font-size:13px}
.cloud-box .btn{padding:6px 10px;font-size:13px}
.cl-bg{position:fixed;inset:0;background:rgba(20,24,28,.45);display:none;align-items:flex-start;justify-content:center;z-index:100;padding:60px 12px;overflow-y:auto}
.cl-bg.show{display:flex}
.cl{background:#fff;border-radius:14px;max-width:420px;width:100%;box-shadow:0 10px 40px rgba(0,0,0,.25);overflow:hidden}
.cl-h{background:var(--accent);color:#fff;padding:12px 18px;font-weight:700;display:flex;justify-content:space-between}
.cl-h button{background:none;border:0;color:#fff;font-size:22px;cursor:pointer}
.cl-b{padding:16px 18px;display:flex;flex-direction:column;gap:10px;font-size:14px}
.cl-b label{display:flex;flex-direction:column;gap:3px;font-size:12.5px;color:var(--muted)}
.cl-b input{font:inherit;font-size:14px;padding:8px 10px;border:1px solid var(--line);border-radius:8px;color:var(--ink)}
.cl-tabs{display:flex;gap:6px}.cl-tabs button{flex:1}
.cl-tabs .on{background:var(--accent);color:#fff;border-color:var(--accent)}
.cl-msg{font-size:13px;min-height:18px}.cl-msg.err{color:var(--bad)}.cl-msg.ok{color:var(--ok)}
table.cases{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);font-size:13.5px}
table.cases th,table.cases td{padding:8px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
table.cases th{background:#f1eee9;font-size:12.5px;color:var(--muted)}
table.cases tr.cur{background:var(--accent-soft)}
table.cases .sc{font-size:12px;color:var(--muted)}
.cl-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:10px 0}
.cl-bar select,.cl-bar input{font:inherit;font-size:13.5px;padding:6px 8px;border:1px solid var(--line);border-radius:8px}
@media (max-width:860px){.cloud-box{margin-left:0;width:100%;justify-content:flex-end}}`;
  document.head.appendChild(st);

  /* ---------- 헤더 위젯 ---------- */
  const box=document.createElement('div');box.className='cloud-box';
  (document.querySelector('.top-row')||document.body).appendChild(box);
  function drawBox(){
    if(!user){box.innerHTML=`<button class="btn primary" id="cl-login">🔐 로그인</button>`;return;}
    const role=profile&&profile.role==='professor'?'교수':'학생';
    box.innerHTML=`<div class="who"><b>${esc((profile&&profile.name)||user.email)}</b><br>${role}${profile&&profile.student_no?' · '+esc(profile.student_no):''}</div>
      <button class="btn primary" id="cl-save">💾 저장</button><button class="btn" id="cl-out">로그아웃</button>`;
  }

  /* ---------- 로그인 모달 ---------- */
  const m=document.createElement('div');m.className='cl-bg';m.id='cl-modal';
  m.innerHTML=`<div class="cl"><div class="cl-h"><span>🔐 로그인</span><button id="cl-x" aria-label="닫기">×</button></div><div class="cl-b">
    <div class="cl-tabs"><button class="btn on" data-tab="in">로그인</button><button class="btn" data-tab="up">회원가입</button></div>
    <label>이메일<input id="cl-email" type="email" autocomplete="email"></label>
    <label>비밀번호(6자 이상)<input id="cl-pw" type="password" autocomplete="current-password"></label>
    <div id="cl-upf" style="display:none;flex-direction:column;gap:10px">
      <label>이름<input id="cl-name" autocomplete="name"></label>
      <label>학번(교수는 비워 두기)<input id="cl-sno"></label></div>
    <div class="cl-msg" id="cl-msg"></div>
    <button class="btn primary" id="cl-go">로그인</button>
    <div class="note" style="margin:0">저장되는 내용은 수업용 <b>가상 환자</b> 사례입니다. 실제 환자의 이름·주민번호 등 개인정보는 입력하지 마십시오.</div></div></div>`;
  document.body.appendChild(m);
  let tab='in';
  const msg=(t,k)=>{const e=document.getElementById('cl-msg');e.textContent=t||'';e.className='cl-msg '+(k||'');};
  function setTab(t){tab=t;m.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('on',b.dataset.tab===t));
    document.getElementById('cl-upf').style.display=t==='up'?'flex':'none';document.getElementById('cl-go').textContent=t==='up'?'가입하기':'로그인';msg('');}
  m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('show');const t=e.target.closest('[data-tab]');if(t)setTab(t.dataset.tab);});
  document.getElementById('cl-x').onclick=()=>m.classList.remove('show');
  document.getElementById('cl-go').onclick=async()=>{
    const email=document.getElementById('cl-email').value.trim(), pw=document.getElementById('cl-pw').value;
    if(!email||pw.length<6){msg('이메일과 6자 이상의 비밀번호를 입력하십시오.','err');return;}
    msg('처리 중…');
    if(tab==='up'){
      const name=document.getElementById('cl-name').value.trim(), sno=document.getElementById('cl-sno').value.trim();
      if(!name){msg('이름을 입력하십시오.','err');return;}
      const {data,error}=await sb.auth.signUp({email,password:pw,options:{data:{name,student_no:sno},emailRedirectTo:location.href}});
      if(error){msg('가입 실패: '+error.message,'err');return;}
      if(!data.session){msg('가입했습니다. 이메일로 온 확인 링크를 누른 뒤 로그인하십시오.','ok');setTab('in');return;}
      m.classList.remove('show');
    } else {
      const {error}=await sb.auth.signInWithPassword({email,password:pw});
      if(error){msg('로그인 실패: '+(error.message.includes('Invalid')?'이메일 또는 비밀번호가 맞지 않습니다.':error.message.includes('confirm')?'이메일 확인이 아직 되지 않았습니다.':error.message),'err');return;}
      m.classList.remove('show');
    }
  };

  /* ---------- 인증 상태 ---------- */
  async function loadProfile(){
    if(!user){profile=null;return;}
    const {data}=await sb.from('profiles').select('*').eq('id',user.id).maybeSingle();
    profile=data;
  }
  sb.auth.onAuthStateChange(async(_e,session)=>{
    user=session?session.user:null;await loadProfile();drawBox();
    if(state.view==='cloud') renderCloud();
    if(typeof renderNav==='function') renderNav();
  });
  drawBox();

  /* ---------- 저장 ---------- */
  function scores(){const o={};INST.forEach(i=>{if(isComplete(i)){const r=i.score(state.answers[i.id]);o[i.short]={main:r.main,unit:r.unit,interp:r.interp};}});return o;}
  async function saveCase(){
    if(!user){m.classList.add('show');return;}
    let label=(state.pt.name||'').trim();
    if(!label){toast('상단 이름/ID 칸에 가상 환자 이름(또는 사례 번호)을 먼저 입력하십시오.');document.getElementById('p-name').focus();return;}
    const row={app:APP,case_label:label,pt:state.pt,answers:state.answers,clin:state.clin||{},scores:scores(),summary:summaryText()};
    let res;
    if(curId&&curOwner) res=await sb.from('cases').update(row).eq('id',curId).select('id').single();
    else res=await sb.from('cases').insert(row).select('id').single();
    if(res.error){toast('저장 실패: '+res.error.message);return;}
    curId=res.data.id;curOwner=true;toast('사례를 저장했습니다');
    if(state.view==='cloud') renderCloud();
  }
  box.addEventListener('click',async e=>{
    if(e.target.id==='cl-login'){setTab('in');m.classList.add('show');}
    if(e.target.id==='cl-out'){await sb.auth.signOut();curId=null;toast('로그아웃했습니다');}
    if(e.target.id==='cl-save') saveCase();
  });

  /* ---------- 저장된 사례 화면 ---------- */
  async function fetchList(){
    let q=sb.from('cases').select('id,user_id,case_label,scores,updated_at,created_at').eq('app',APP).order('updated_at',{ascending:false}).limit(500);
    const {data,error}=await q; if(error){toast('불러오기 실패: '+error.message);return [];}
    if(profile&&profile.role==='professor'){
      const ids=[...new Set(data.map(r=>r.user_id))];
      const {data:ps}=await sb.from('profiles').select('id,name,student_no,email').in('id',ids.length?ids:['00000000-0000-0000-0000-000000000000']);
      const map={};(ps||[]).forEach(p=>map[p.id]=p);data.forEach(r=>r.owner=map[r.user_id]||{});
    }
    return data;
  }
  window.renderCloud=async function(){
    const main=document.getElementById('main');
    if(!user){main.innerHTML=`<div class="panel-head"><h1>☁️ 저장된 사례</h1><p class="desc">로그인하면 가상 환자 사례를 저장하고 다시 불러올 수 있습니다. 교수 계정은 학생들이 저장한 사례를 모두 볼 수 있습니다.</p><div class="toolbar" style="margin:12px 0 0"><button class="btn primary" onclick="document.getElementById('cl-login').click()">🔐 로그인 / 회원가입</button></div></div>`;return;}
    main.innerHTML=`<div class="panel-head"><h1>☁️ 저장된 사례</h1><div class="full">불러오는 중…</div></div>`;
    list=await fetchList();
    const prof=profile&&profile.role==='professor';
    const students=prof?[...new Map(list.map(r=>[r.user_id,r.owner])).entries()]:[];
    const rows=list.filter(r=>!filterStudent||r.user_id===filterStudent).map(r=>{
      const sc=Object.entries(r.scores||{}).map(([k,v])=>`${k} ${v.main}`).join(' · ')||'완료한 설문 없음';
      const mine=r.user_id===user.id;
      return `<tr class="${r.id===curId?'cur':''}"><td><b>${esc(r.case_label||'(이름 없음)')}</b></td>${prof?`<td>${esc((r.owner&&r.owner.name)||'')}<br><span class="sc">${esc((r.owner&&(r.owner.student_no||r.owner.email))||'')}</span></td>`:''}
        <td class="sc">${esc(sc)}</td><td class="sc">${new Date(r.updated_at).toLocaleString('ko-KR')}</td>
        <td><button class="btn" data-cl-load="${r.id}">불러오기</button>${mine?` <button class="btn danger" data-cl-del="${r.id}">삭제</button>`:''}</td></tr>`;}).join('');
    main.innerHTML=`<div class="panel-head"><h1>☁️ 저장된 사례</h1><div class="full">${prof?'교수 계정 — 이 설문도구에 저장된 모든 학생의 사례':'내가 저장한 사례'} · ${list.length}건</div>
      <p class="desc">사례를 불러오면 설문 응답·환자 정보·검사 소견이 화면에 채워집니다. 수정한 뒤 상단 ‘💾 저장’을 누르면 같은 사례에 덮어씁니다.</p></div>
      <div class="cl-bar"><button class="btn primary" data-cl-new>➕ 새 사례 시작</button><button class="btn primary" data-cl-save>💾 현재 화면 저장</button>
      ${prof?`<select id="cl-filter"><option value="">전체 학생</option>${students.map(([id,o])=>`<option value="${id}" ${id===filterStudent?'selected':''}>${esc((o&&o.name)||'')} ${esc((o&&o.student_no)||'')}</option>`).join('')}</select>`:''}</div>
      ${list.length?`<table class="cases"><thead><tr><th>사례(가상 환자)</th>${prof?'<th>학생</th>':''}<th>점수</th><th>수정일</th><th></th></tr></thead><tbody>${rows}</tbody></table>`:'<div class="note">저장된 사례가 없습니다. 설문을 작성한 뒤 ‘💾 저장’을 누르십시오.</div>'}`;
  };
  document.addEventListener('change',e=>{if(e.target.id==='cl-filter'){filterStudent=e.target.value;renderCloud();}});
  document.addEventListener('click',async e=>{
    const ld=e.target.closest('[data-cl-load]'),dl=e.target.closest('[data-cl-del]');
    if(e.target.closest('[data-cl-save]')){saveCase();return;}
    if(e.target.closest('[data-cl-new]')){confirmBox('현재 화면의 응답을 비우고 새 사례를 시작할까요? (저장하지 않은 내용은 사라집니다)',()=>{INST.forEach(i=>state.answers[i.id]={});state.pt={};state.clin={};curId=null;curOwner=true;save();fillPt();state.view=INST[0].id;render();});return;}
    if(ld){const {data,error}=await sb.from('cases').select('*').eq('id',ld.dataset.clLoad).single();
      if(error){toast('불러오기 실패: '+error.message);return;}
      state.answers={};INST.forEach(i=>state.answers[i.id]=(data.answers||{})[i.id]||{});state.pt=data.pt||{};state.clin=data.clin||{};
      curId=data.id;curOwner=data.user_id===user.id;save();fillPt();state.view='summary';render();
      toast(curOwner?`‘${data.case_label}’ 사례를 불러왔습니다`:`학생 사례 ‘${data.case_label}’를 불러왔습니다(읽기 전용 — 저장하면 내 사례로 새로 저장됨)`);}
    if(dl){confirmBox('이 사례를 삭제할까요? 되돌릴 수 없습니다.',async()=>{const {error}=await sb.from('cases').delete().eq('id',dl.dataset.clDel);if(error){toast('삭제 실패: '+error.message);return;}if(curId===dl.dataset.clDel)curId=null;toast('삭제했습니다');renderCloud();});}
  });
  if(state.view==='cloud') renderCloud();
})();
