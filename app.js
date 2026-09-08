(function(){
  const cfg = window.RANKPATH_CONFIG || {};
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const scanForm = $('#scanForm');
  if(!scanForm) return;

  const demoReport = {
    score: 78,
    critical: [
      {title:'Missing H1 tag', detail:'Your page does not contain a clear H1 heading.', priority:'High'},
      {title:'Indexability needs attention', detail:'Review robots directives and page indexability.', priority:'High'},
      {title:'Missing or weak meta description', detail:'Add a clear description aligned with the page intent.', priority:'High'}
    ],
    warning: [
      {title:'Title length could be improved', detail:'Keep the title concise, useful and aligned with the target query.', priority:'Medium'},
      {title:'Target keyword is not prominent in the main heading', detail:'Use the target topic naturally in the H1 where appropriate.', priority:'Medium'},
      {title:'Content depth may be limited', detail:'Add useful, specific content that fully answers the search intent.', priority:'Medium'},
      {title:'Some images may need descriptive alt text', detail:'Add meaningful alt text where images convey information.', priority:'Low'}
    ],
    passed: [
      {title:'HTTPS is enabled', detail:'The page uses a secure HTTPS connection.', priority:'Low'},
      {title:'Mobile viewport detected', detail:'The page is configured for mobile devices.', priority:'Low'},
      {title:'Canonical URL found', detail:'A canonical URL is present.', priority:'Low'},
      {title:'HTML language declared', detail:'The page declares a language attribute.', priority:'Low'}
    ]
  };

  function notice(el,msg){el.textContent=msg;el.classList.add('show')}
  function clearNotice(el){el.textContent='';el.classList.remove('show')}
  function escapeHTML(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
  function issueRow(item,type){
    const p = (item.priority || (type==='critical'?'High':type==='warning'?'Medium':'Low')).toLowerCase();
    const label = p[0].toUpperCase()+p.slice(1);
    return `<div class="issue-row ${type}" data-type="${type}"><div class="issue-copy"><b>${escapeHTML(item.title)}</b><span>${escapeHTML(item.detail||item.message||'')}</span></div><span class="pill pill-${p}">${label}</span>${type==='passed'?'':'<button class="fix-btn" data-issue="'+escapeHTML(item.title)+'">Fix This Issue →</button>'}</div>`
  }
  function normalise(api){
    if(!api) return demoReport;
    if(api.critical || api.warning || api.passed) return api;
    if(api.sections){
      const all = api.sections.flatMap(s => Array.isArray(s.checks) ? s.checks : []);
      const mapItem = x => ({title:x.label||x.id||'SEO check', detail:x.value||x.impact||x.recommendation||'', priority:(x.priority||'Low').replace(/^./, c=>c.toUpperCase())});
      return {score:api.score||78,
        critical:all.filter(x=>String(x.status||'').toLowerCase()==='fail').map(mapItem),
        warning:all.filter(x=>String(x.status||'').toLowerCase()==='warn').map(mapItem),
        passed:all.filter(x=>String(x.status||'').toLowerCase()==='pass').map(mapItem)};
    }
    if(api.results){
      const all = Array.isArray(api.results) ? api.results : [];
      return {score:api.score||api.overall_score||78,
        critical:all.filter(x=>['critical','error','fail'].includes(String(x.status||'').toLowerCase())),
        warning:all.filter(x=>['warning','warn'].includes(String(x.status||'').toLowerCase())),
        passed:all.filter(x=>['passed','pass','ok'].includes(String(x.status||'').toLowerCase()))};
    }
    return demoReport;
  }
  function render(report,url,keyword){
    report=normalise(report);
    $('#results').classList.add('show');
    $('#siteUrl').textContent=url;
    let host='Your Website'; try{host=new URL(url).hostname.replace(/^www\./,'')}catch(e){}
    $('#siteTitle').textContent=host;
    $('#keywordChip').textContent=keyword?`Target keyword: ${keyword}`:'Target keyword: not set';
    $('#score').textContent=report.score ?? 78;
    $('#scoreRing').style.background=`conic-gradient(var(--green) 0 ${report.score||78}%,#e9eef5 ${report.score||78}%)`;
    $('#criticalCount').textContent=(report.critical||[]).length;
    $('#warningCount').textContent=(report.warning||[]).length;
    $('#passedCount').textContent=(report.passed||[]).length;
    $('#criticalIssues').innerHTML=(report.critical||[]).map(x=>issueRow(x,'critical')).join('') || '<p class="muted">No critical errors found.</p>';
    $('#warningIssues').innerHTML=(report.warning||[]).map(x=>issueRow(x,'warning')).join('') || '<p class="muted">No warnings found.</p>';
    $('#passedIssues').innerHTML=(report.passed||[]).map(x=>issueRow(x,'passed')).join('') || '<p class="muted">No passed checks available.</p>';
    window.__rankpathReport={report,url,keyword};
    bindFixButtons();
    $('#results').scrollIntoView({behavior:'smooth',block:'start'});
  }
  async function scan(url,keyword){
    if(!cfg.API_BASE){
      render(demoReport,url,keyword);
      notice($('#scanNotice'),'Preview mode: connect API_BASE in config.js to use the live scanner on GitHub Pages.');
      return;
    }
    clearNotice($('#scanNotice'));
    const r=await fetch(cfg.API_BASE.replace(/\/$/,'')+'/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url,keyword})});
    if(!r.ok) throw new Error('Scan failed. Please check the URL and try again.');
    render(await r.json(),url,keyword);
  }
  scanForm.addEventListener('submit',async e=>{
    e.preventDefault(); const btn=$('#scanBtn'); const url=$('#url').value.trim(); const keyword=$('#keyword').value.trim(); if(!url)return;
    btn.disabled=true;btn.textContent='Analysing…';clearNotice($('#scanNotice'));
    try{await scan(url,keyword)}catch(err){notice($('#scanNotice'),err.message||'Unable to analyse this page.')}finally{btn.disabled=false;btn.textContent='Check My Website →'}
  });

  $$('.tab').forEach(t=>t.addEventListener('click',()=>{ $$('.tab').forEach(x=>x.classList.remove('active')); t.classList.add('active'); const f=t.dataset.filter; $$('.issue-group').forEach(g=>g.style.display=(f==='all'||g.dataset.group===f)?'block':'none'); }));
  function bindFixButtons(){ $$('.fix-btn').forEach(b=>b.addEventListener('click',()=>{ $('#selectedIssue').value=b.dataset.issue||''; $('#fixModal').classList.add('show'); })); }
  $$('[data-close]').forEach(b=>b.addEventListener('click',()=>$('#fixModal').classList.remove('show')));
  $('#fixModal').addEventListener('click',e=>{if(e.target.id==='fixModal')e.currentTarget.classList.remove('show')});

  $('#leadBtn').addEventListener('click',async()=>{
    const data={name:$('#leadName').value.trim(),email:$('#leadEmail').value.trim(),phone:$('#leadPhone').value.trim(),website:(window.__rankpathReport||{}).url||'',issue_label:$('#selectedIssue').value,consent:true};
    if(!data.name||!data.email){notice($('#leadNotice'),'Please enter your name and email.');return}
    if(!cfg.API_BASE){notice($('#leadNotice'),'Lead form is ready. Set API_BASE in config.js to send submissions to your backend.');return}
    try{const r=await fetch(cfg.API_BASE.replace(/\/$/,'')+'/api/lead',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});if(!r.ok)throw new Error();notice($('#leadNotice'),'Thanks — your request has been sent.')}catch(e){notice($('#leadNotice'),'Could not send the request. Please try again.')}
  });

  $('#exportBtn').addEventListener('click',async()=>{
    const state=window.__rankpathReport;
    if(!state){notice($('#scanNotice'),'Run an SEO check before exporting the report.');window.scrollTo({top:0,behavior:'smooth'});return}
    if(cfg.OMISE_PAYMENT_LINK){window.location.href=cfg.OMISE_PAYMENT_LINK;return}
    if(cfg.API_BASE){
      const btn=$('#exportBtn');btn.disabled=true;btn.textContent='Opening secure checkout…';
      try{
        const r=await fetch(cfg.API_BASE.replace(/\/$/,'')+'/api/create-checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({amount_thb:cfg.REPORT_PRICE_THB||800,product:'RankPath Full SEO Report',report_context:state})});
        if(!r.ok)throw new Error(); const data=await r.json(); if(!data.checkout_url)throw new Error(); window.location.href=data.checkout_url;
      }catch(e){notice($('#scanNotice'),'Omise checkout is not connected yet. Configure OMISE_PAYMENT_LINK or the /api/create-checkout backend endpoint.');window.scrollTo({top:0,behavior:'smooth'});}finally{btn.disabled=false;btn.textContent='Pay 800 THB & Export →'}
      return;
    }
    notice($('#scanNotice'),'Omise checkout is ready to connect. Add OMISE_PAYMENT_LINK or API_BASE in config.js.');window.scrollTo({top:0,behavior:'smooth'});
  });
})();
