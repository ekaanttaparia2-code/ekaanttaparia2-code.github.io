/* Financial reports, category charting, and report export. */

function setPeriod(p){
  period=p;
  document.querySelectorAll('#period-toggle button').forEach(b=>b.classList.remove('active'));
  const idx={week:0,month:1,all:2,custom:3}[p];
  document.querySelectorAll('#period-toggle button')[idx].classList.add('active');
  const showCustom=p==='custom';
  document.getElementById('rep-from').style.display=showCustom?'block':'none';
  document.getElementById('rep-to-label').style.display=showCustom?'block':'none';
  document.getElementById('rep-to').style.display=showCustom?'block':'none';
  renderReport();
}

function getReportEntries(){
  const base = mainEntries();
  if(period==='all')return base;
  if(period==='custom'){
    const from=document.getElementById('rep-from').value;
    const to=document.getElementById('rep-to').value;
    return base.filter(e=>(!from||e.date>=from)&&(!to||e.date<=to));
  }
  if(period==='month'){
    const now=new Date();
    const y=now.getFullYear(), m=now.getMonth();
    const start=new Date(y,m,1).toISOString().split('T')[0];
    const end=new Date(y,m+1,0).toISOString().split('T')[0];
    return base.filter(e=>e.date>=start&&e.date<=end);
  }
  const now=new Date();
  const day=now.getDay();
  const diff=now.getDate()-(day===0?6:day-1);
  const mon=new Date(now);mon.setDate(diff);
  const monStr=mon.toISOString().split('T')[0];
  const sun=new Date(mon);sun.setDate(mon.getDate()+6);
  const sunStr=sun.toISOString().split('T')[0];
  return base.filter(e=>e.date>=monStr&&e.date<=sunStr);
}

// --- SVG pie chart for category spending — no external chart library needed ---
function polarToXY(cx,cy,r,angleDeg){
  const rad=(angleDeg-90)*Math.PI/180;
  return { x: cx + r*Math.cos(rad), y: cy + r*Math.sin(rad) };
}
function describeArc(cx,cy,r,startAngle,endAngle){
  const start=polarToXY(cx,cy,r,endAngle);
  const end=polarToXY(cx,cy,r,startAngle);
  const largeArcFlag = endAngle-startAngle <= 180 ? '0' : '1';
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
}

function renderCategoryPieChart(cats){
  const wrap=document.getElementById('cat-pie-wrap');
  if(!wrap)return;
  const entries=Object.entries(cats).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
  if(!entries.length){ wrap.innerHTML=''; return; }
  const total=entries.reduce((s,[,v])=>s+v,0);
  const size=200, r=82, cx=size/2, cy=size/2;
  let angle=0;
  const sliceData = entries.map(([cat,amt])=>{
    const sliceAngle = (amt/total)*360;
    const startAngle=angle;
    angle += sliceAngle;
    return {cat, amt, startAngle, endAngle:angle, pct: Math.round(amt/total*100)};
  });

  const slices = sliceData.map((s,i)=>{
    const path = s.endAngle-s.startAngle>=359.9
      ? `M ${cx} ${cy-r} A ${r} ${r} 0 1 1 ${cx-0.01} ${cy-r} Z`
      : describeArc(cx,cy,r,s.startAngle,s.endAngle);
    return `<path class="pie-slice" data-idx="${i}" d="${path}" fill="${CAT_COLORS[s.cat]||'#9b95c2'}"
      stroke="#1b1340" stroke-width="2" style="transform-origin:${cx}px ${cy}px"
      onmouseenter="showPieTooltip(event,${i})" onmouseleave="hidePieTooltip()"
      ontouchstart="showPieTooltip(event,${i})"></path>`;
  }).join('');

  window._pieSliceData = sliceData;

  const legend = sliceData.map(s=>`
    <div style="display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--text-dim)">
      <span style="width:9px;height:9px;border-radius:50%;background:${CAT_COLORS[s.cat]||'#9b95c2'};flex-shrink:0"></span>
      <span>${escapeHTML(CAT_LABEL(s.cat))} · ${s.pct}%</span>
    </div>`).join('');

  wrap.innerHTML = `
    <div style="position:relative">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="overflow:visible">${slices}<circle cx="${cx}" cy="${cy}" r="${r*0.55}" fill="#1b1340"/></svg>
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;pointer-events:none">
        <div style="font-size:10px;color:var(--text-faint)">${currentLang==='hi'?'कुल':'Total'}</div>
        <div style="font-size:15px;font-weight:700">₹${total}</div>
      </div>
      <div id="pie-tooltip" style="display:none;position:fixed;background:#1f1840;border:1px solid var(--accent);border-radius:10px;padding:6px 10px;font-size:12px;color:#fff;pointer-events:none;z-index:950;white-space:nowrap;box-shadow:0 6px 18px rgba(0,0,0,0.4)"></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 14px;margin-top:14px;width:100%">${legend}</div>
  `;
}

function showPieTooltip(evt, idx){
  const s=window._pieSliceData[idx];
  if(!s)return;
  document.querySelectorAll('.pie-slice').forEach(p=>p.style.transform='scale(1)');
  evt.target.style.transform='scale(1.06)';
  evt.target.style.transition='transform 0.15s';
  const tip=document.getElementById('pie-tooltip');
  const label=CAT_LABEL(s.cat);
  tip.innerHTML=`<b>${escapeHTML(label)}</b><br>₹${s.amt} · ${s.pct}%`;
  tip.style.display='block';
  const rect = evt.target.closest('#cat-pie-wrap').getBoundingClientRect();
  const pageX = evt.touches ? evt.touches[0].pageX : evt.pageX;
  const pageY = evt.touches ? evt.touches[0].pageY : evt.pageY;
  const x = pageX - (rect.left + window.scrollX);
  const y = pageY - (rect.top + window.scrollY);
  tip.style.left=(x+15)+'px';
  tip.style.top=(y-25)+'px';
}
function hidePieTooltip(){
  document.querySelectorAll('.pie-slice').forEach(p=>p.style.transform='scale(1)');
  const tip=document.getElementById('pie-tooltip');
  if(tip) tip.style.display='none';
}

function renderReport(){
  const list=getReportEntries();
  const income=list.filter(e=>e.type==='income').reduce((s,e)=>s+e.amt,0);
  const spent=list.filter(e=>e.type==='expense').reduce((s,e)=>s+e.amt,0);
  const bal=income-spent;
  document.getElementById('r-income').textContent='₹'+income;
  document.getElementById('r-spent').textContent='₹'+spent;
  document.getElementById('r-balance').textContent='₹'+bal;
  document.getElementById('r-count').textContent=list.length;
  const cats={};
  list.filter(e=>e.type==='expense').forEach(e=>{cats[e.cat]=(cats[e.cat]||0)+e.amt;});
  const maxCat=Math.max(...Object.values(cats),1);
  renderCategoryPieChart(cats);
  document.getElementById('cat-breakdown').innerHTML=Object.entries(cats).length?Object.entries(cats).sort((a,b)=>b[1]-a[1]).map(([c,a])=>`
    <div class="cat-bar">
      <span style="font-size:13px;min-width:110px;color:var(--text-dim)">${CAT_LABELS[c]}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.round(a/maxCat*100)}%;background:${CAT_COLORS[c]}"></div></div>
      <span style="font-size:13px;font-weight:600;min-width:50px;text-align:right">₹${a}</span>
    </div>`).join(''):`<p class="empty">${TT('no_expenses')}</p>`;

  const sorted=[...list].sort((a,b)=>a.date.localeCompare(b.date));
  document.getElementById('full-breakdown').innerHTML=sorted.length?sorted.map(e=>`<div class="report-row"><span>${fmtDate(e.date)} — ${e.type==='income'?escapeHTML(e.label):escapeHTML(displayCatLabel(e))+': '+escapeHTML(e.label)}</span><span style="color:${e.type==='income'?'var(--green)':'var(--red)'}">${e.type==='income'?'+':'-'}₹${e.amt}</span></div>`).join(''):`<p class="empty">${TT('nothing_period')}</p>`;
}

function copyReport(){
  const list=getReportEntries();
  const income=list.filter(e=>e.type==='income').reduce((s,e)=>s+e.amt,0);
  const spent=list.filter(e=>e.type==='expense').reduce((s,e)=>s+e.amt,0);
  const bal=income-spent;
  const cats={};
  list.filter(e=>e.type==='expense').forEach(e=>{cats[e.cat]=(cats[e.cat]||0)+e.amt;});
  let txt=`Weekly Expense Report\n${'─'.repeat(30)}\nTotal Income: ₹${income}\nTotal Spent:  ₹${spent}\nBalance Left: ₹${bal}\n\nSpending Breakdown:\n`;
  Object.entries(cats).sort((a,b)=>b[1]-a[1]).forEach(([c,a])=>{txt+=`  ${CAT_LABELS[c]}: ₹${a}\n`;});
  txt+=`\nAll Entries:\n`;
  [...list].sort((a,b)=>a.date.localeCompare(b.date)).forEach(e=>{txt+=`  ${fmtDate(e.date)} | ${e.type==='income'?'INCOME':'EXPENSE'} | ${displayCatLabel(e)} | ${e.label}${e.note?' ('+e.note+')':''} | ${e.type==='income'?'+':'-'}₹${e.amt}\n`;});
  navigator.clipboard.writeText(txt).then(()=>toast(TT('report_copied'),'success')).catch(()=>{
    const ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);
    toast(TT('report_copied'),'success');
  });
}

function exportPDF(){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const list=getReportEntries();
  const income=list.filter(e=>e.type==='income').reduce((s,e)=>s+e.amt,0);
  const spent=list.filter(e=>e.type==='expense').reduce((s,e)=>s+e.amt,0);
  const bal=income-spent;
  const cats={};
  list.filter(e=>e.type==='expense').forEach(e=>{cats[e.cat]=(cats[e.cat]||0)+e.amt;});
  const CAT_RGB = {food:[74,222,128],travel:[96,165,250],friends:[255,184,77],home:[255,126,179],other:[150,150,150]};
  const PURPLE=[124,78,224], PINK=[255,126,179], GREEN=[34,197,94], RED=[239,68,68], DARK=[30,25,50];

  const pageW=210, marginL=14, marginR=196;

  function addFooter(){
    const pageCount=doc.internal.getNumberOfPages();
    for(let i=1;i<=pageCount;i++){
      doc.setPage(i);
      doc.setDrawColor(230);
      doc.line(marginL,287,marginR,287);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text('PocketTrack Expense Report',marginL,292);
      doc.text('Page '+i+' of '+pageCount,marginR,292,{align:'right'});
    }
  }

  // ===== Header banner =====
  doc.setFillColor(...PURPLE);
  doc.rect(0,0,pageW,32,'F');
  doc.setFillColor(...PINK);
  doc.rect(0,32,pageW,1.5,'F');
  doc.setFontSize(19);
  doc.setTextColor(255,255,255);
  doc.text('Expense Report',marginL,16);
  doc.setFontSize(10);
  doc.setTextColor(235,225,255);
  const periodLabel={week:'This week',all:'All time',custom:'Custom range'}[period]||'This week';
  doc.text(periodLabel+'  ·  Generated '+new Date().toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'}),marginL,24);

  let y=44;

  // ===== Summary cards =====
  const cardW=(marginR-marginL-12)/3, cardH=22;
  const cards=[
    {label:'INCOME',val:income,color:GREEN,x:marginL},
    {label:'SPENT',val:spent,color:RED,x:marginL+cardW+6},
    {label:'BALANCE',val:bal,color:bal>=0?GREEN:RED,x:marginL+2*(cardW+6)}
  ];
  cards.forEach(c=>{
    doc.setFillColor(246,244,255);
    doc.roundedRect(c.x,y,cardW,cardH,2,2,'F');
    doc.setFontSize(8);
    doc.setTextColor(140,130,170);
    doc.text(c.label,c.x+5,y+8);
    doc.setFontSize(14);
    doc.setTextColor(...c.color);
    doc.text((c.val<0?'-':'')+'Rs. '+Math.abs(c.val),c.x+5,y+17);
  });
  y+=cardH+14;

  // ===== Spending by category (colored bars) =====
  doc.setFontSize(12);
  doc.setTextColor(...DARK);
  doc.text('Spending by Category',marginL,y);
  y+=7;
  const maxCat=Math.max(...Object.values(cats),1);
  const barMaxW=110;
  const catEntries=Object.entries(cats).sort((a,b)=>b[1]-a[1]);
  if(catEntries.length){
    catEntries.forEach(([c,a])=>{
      doc.setFontSize(9.5);
      doc.setTextColor(60);
      doc.text(CAT_LABELS[c],marginL,y+4);
      doc.setFillColor(235,232,245);
      doc.roundedRect(marginL+45,y,barMaxW,4,1,1,'F');
      const w=Math.max((a/maxCat)*barMaxW,2);
      const rgb=CAT_RGB[c]||[150,150,150];
      doc.setFillColor(...rgb);
      doc.roundedRect(marginL+45,y,w,4,1,1,'F');
      doc.setFontSize(9.5);
      doc.setTextColor(60);
      doc.text('Rs. '+a,marginL+45+barMaxW+4,y+4);
      y+=9;
    });
  } else {
    doc.setFontSize(9.5);
    doc.setTextColor(150);
    doc.text('No expenses logged in this period',marginL,y+4);
    y+=9;
  }
  y+=8;

  // ===== Day-wise balance =====
  if(y>250){doc.addPage();y=20;}
  doc.setFontSize(12);
  doc.setTextColor(...DARK);
  doc.text('Day-wise Balance',marginL,y);
  y+=8;
  const byDate={};
  list.forEach(e=>{
    if(!byDate[e.date])byDate[e.date]={income:0,expense:0};
    if(e.type==='income')byDate[e.date].income+=e.amt;else byDate[e.date].expense+=e.amt;
  });
  const dateKeys=Object.keys(byDate).sort((a,b)=>a.localeCompare(b));
  // table header
  doc.setFillColor(...PURPLE);
  doc.rect(marginL,y-5,marginR-marginL,7,'F');
  doc.setFontSize(9);
  doc.setTextColor(255,255,255);
  doc.text('Date',marginL+3,y);
  doc.text('Income',marginL+65,y);
  doc.text('Spent',marginL+105,y);
  doc.text('Balance',marginL+145,y);
  y+=6;
  dateKeys.forEach((d,i)=>{
    if(y>280){doc.addPage();y=20;}
    const g=byDate[d]; const dbal=g.income-g.expense;
    if(i%2===0){doc.setFillColor(247,246,252);doc.rect(marginL,y-4.5,marginR-marginL,6.5,'F');}
    doc.setFontSize(9);
    doc.setTextColor(60);
    doc.text(fmtDate(d),marginL+3,y);
    doc.setTextColor(...GREEN);
    doc.text('+Rs. '+g.income,marginL+65,y);
    doc.setTextColor(...RED);
    doc.text('-Rs. '+g.expense,marginL+105,y);
    doc.setTextColor(...(dbal>=0?GREEN:RED));
    doc.text((dbal>=0?'+':'-')+'Rs. '+Math.abs(dbal),marginL+145,y);
    y+=6.5;
  });
  y+=10;

  // ===== All entries =====
  if(y>260){doc.addPage();y=20;}
  doc.setFontSize(12);
  doc.setTextColor(...DARK);
  doc.text('All Entries',marginL,y);
  y+=8;
  const sorted=[...list].sort((a,b)=>a.date.localeCompare(b.date));
  sorted.forEach((e,i)=>{
    if(y>280){doc.addPage();y=20;}
    if(i%2===0){doc.setFillColor(247,246,252);doc.rect(marginL,y-4,marginR-marginL,6,'F');}
    doc.setFontSize(8.5);
    doc.setTextColor(60);
    const label=e.type==='income'?e.label:displayCatLabel(e)+': '+e.label;
    doc.text(fmtDate(e.date)+'  |  '+(e.type==='income'?'INCOME':'EXPENSE')+'  |  '+label+(e.note?' ('+e.note+')':''),marginL+2,y);
    doc.setTextColor(...(e.type==='income'?GREEN:RED));
    doc.text((e.type==='income'?'+':'-')+'Rs.'+e.amt,marginR,y,{align:'right'});
    y+=6;
  });

  addFooter();
  doc.save('expense_report.pdf');
}


