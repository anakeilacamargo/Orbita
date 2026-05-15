
// SUPABASE
const SUPABASE_URL='https://zdeppuzjxxtrpihaijex.supabase.co';
const SUPABASE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkZXBwdXpqeHh0cnBpaGFpamV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMDY5MjUsImV4cCI6MjA5MTc4MjkyNX0.MUDlLFl19K3zqn65mh8DZPHztJlZGoib3FHvrEfafok';
const sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
let currentUser=null;

async function initAuth(){
  const{data:{session}}=await sb.auth.getSession();
  if(session?.user){currentUser=session.user;await loadUserProfile();}
  sb.auth.onAuthStateChange(async(event,session)=>{
    console.log('Auth event:',event,session?.user?.email);
    if(event==='SIGNED_IN'&&session?.user){
      currentUser=session.user;
      await loadUserProfile();
    }
    else if(event==='SIGNED_OUT'){currentUser=null;}
  });
}

async function signInWithGoogle(){
  await sb.auth.signInWithOAuth({provider:'google',options:{redirectTo:'https://orbita-pi.vercel.app'}});
}

async function signInWithEmail(){
  const email=document.getElementById('save-email').value.trim();
  const password=document.getElementById('save-password').value;
  const errEl=document.getElementById('save-error');
  errEl.style.display='none';
  if(!email||!password){errEl.textContent='Please fill in email and password.';errEl.style.display='block';return;}
  if(password.length<6){errEl.textContent='Password must be at least 6 characters.';errEl.style.display='block';return;}
  // Try login first, if fails try signup
  let{data,error}=await sb.auth.signInWithPassword({email,password});
  if(error){
    const res=await sb.auth.signUp({email,password});
    error=res.error;data=res.data;
  }
  if(error){errEl.textContent=error.message;errEl.style.display='block';return;}
  closeSaveModal();
}

async function signOut(){
  await sb.auth.signOut();currentUser=null;showPage('page-onboard');
}

async function loadUserProfile(){
  if(!currentUser)return;
  const{data}=await sb.from('profiles').select('*').eq('id',currentUser.id).maybeSingle();
  if(!data){
    // New user — create empty profile
    await sb.from('profiles').insert({id:currentUser.id});
    // If chart already generated in memory, save it and go to paywall
    if(chartRawData){
      await saveUserProfile(chartRawData,chartContext);
      closeSaveModal();
      showPage('page-paywall');
    }
    return;
  }
  // Returning user — load data
  user.name=data.name||'';user.gender=data.gender||'female';user.lang=data.lang||'en';
  user.birthDate=data.birth_date||'';user.birthTime=data.birth_time||'';user.birthCity=data.birth_city||'';
  user.birthLat=data.birth_lat||'';user.birthLng=data.birth_lng||'';user.birthNation=data.birth_nation||'';
  isPaid=data.is_paid||false;
  if(data.chart_data){
    chartRawData=data.chart_data;chartContext=data.chart_context||'';
    const planets=chartRawData.planets||[];
    const fp=n=>planets.find(p=>p.name?.toLowerCase()===n.toLowerCase());
    const sun=fp('Sun'),moon=fp('Moon'),asc=fp('Ascendant');
    const placements={sun:sun?sun.sign:'--',sunDeg:sun?fmtDeg(sun.abs_pos):'',moon:moon?moon.sign:'--',moonDeg:moon?fmtDeg(moon.abs_pos):'',asc:asc?asc.sign:'--',ascDeg:asc?fmtDeg(asc.abs_pos):''};
    showPage('page-app');renderChartTab(placements,user.lang);
    document.getElementById('state-loading').style.display='none';
    document.getElementById('state-results').style.display='block';
   loadReading(placements,user.lang);initAITab();return;
  }
  // Has account but no chart yet — go to paywall
if(data.birth_date){
    showPage('page-paywall');
  } else {
    showPage('page-onboard');
  }
}
async function saveUserProfile(chartData,chartCtx){
  if(!currentUser)return;
  await sb.from('profiles').upsert({id:currentUser.id,name:user.name,gender:user.gender,lang:user.lang,birth_date:user.birthDate,birth_time:user.birthTime,birth_city:user.birthCity,birth_lat:user.birthLat,birth_lng:user.birthLng,birth_nation:user.birthNation,chart_data:chartData,chart_context:chartCtx});
}

// SAVE MODAL
function showSaveModal(){document.getElementById('save-modal').classList.add('visible');}
function closeSaveModal(){document.getElementById('save-modal').classList.remove('visible');}

// STARS
const starsEl=document.getElementById('stars');
for(let i=0;i<80;i++){const s=document.createElement('div');s.className='star';s.style.cssText='left:'+Math.random()*100+'%;top:'+Math.random()*100+'%;--d:'+(2+Math.random()*5)+'s;--min-o:'+(0.05+Math.random()*0.1)+';--max-o:'+(0.2+Math.random()*0.5)+';animation-delay:'+Math.random()*5+'s;';starsEl.appendChild(s);}

// STATE
let user={name:'',gender:'female',lang:'en',birthDate:'',birthTime:'',birthCity:'',birthLat:'',birthLng:'',birthNation:''};
let isPaid=false;
let selectedPlan='month';
let currentData=null;
let chartContext=null;
let chartRawData=null;
let aiHistory=[];

// PAGES
function showPage(id){   document.querySelectorAll('.page').forEach(p=>{     p.classList.remove('active');     p.style.display = 'none';   // ← ESSA LINHA RESOLVE TUDO   });   const el = document.getElementById(id);   el.style.display = 'block';   requestAnimationFrame(()=>el.classList.add('active')); }

// ONBOARDING
function goSlide(n){
  document.querySelectorAll('.ob-slide').forEach(s=>s.classList.remove('active'));
  document.getElementById('slide-'+n).classList.add('active');
}
function selectGender(g){user.gender=g;document.getElementById('opt-f').classList.toggle('selected',g==='female');document.getElementById('opt-m').classList.toggle('selected',g==='male');document.getElementById('btn-s2').disabled=false;}
function selectLang(l){user.lang=l;document.getElementById('opt-en').classList.toggle('selected',l==='en');document.getElementById('opt-pt').classList.toggle('selected',l==='pt');document.getElementById('btn-s3').disabled=false;}

function initDates(){
  const d=document.getElementById('ob-day'),y=document.getElementById('ob-year');
  for(let i=1;i<=31;i++){const o=document.createElement('option');o.value=i;o.textContent=i;d.appendChild(o);}
  for(let i=2026;i>=1940;i--){const o=document.createElement('option');o.value=i;o.textContent=i;y.appendChild(o);}
}
function checkDate(){
  const m=document.getElementById('ob-month').value,d=document.getElementById('ob-day').value,y=document.getElementById('ob-year').value;
  document.getElementById('btn-s4').disabled=!(m&&d&&y);
}
let obACTimer=null;
async function obCityAC(val){
  const box=document.getElementById('ob-city-sugg');
  document.getElementById('ob-lat').value='';document.getElementById('ob-lng').value='';document.getElementById('ob-nation').value='';
  document.getElementById('btn-s6').disabled=true;
  if(val.length<2){box.style.display='none';return;}
  clearTimeout(obACTimer);
  obACTimer=setTimeout(async()=>{
    try{
      const r=await fetch('https://nominatim.openstreetmap.org/search?q='+encodeURIComponent(val)+'&format=json&limit=5&addressdetails=1',{headers:{'Accept-Language':'en'}});
      const d=await r.json();if(!d.length){box.style.display='none';return;}
      const seen=new Set();
      const uniq=d.filter(item=>{const c=item.address?.city||item.address?.town||item.address?.village||item.name;const co=item.address?.country||'';const k=c+'|'+co;if(seen.has(k))return false;seen.add(k);return true;});
      box.innerHTML=uniq.map(item=>{
        const c=item.address?.city||item.address?.town||item.address?.village||item.name;
        const co=item.address?.country||'';const cc=item.address?.country_code?.toUpperCase()||'';
        const label=co?c+', '+co:c;
        return '<div onclick="obPick(\''+c.replace(/'/g,"\\'")+"','"+cc+"','"+item.lat+"','"+item.lon+"','"+label.replace(/'/g,"\\'")+'\' )" style="padding:12px 16px;cursor:pointer;font-size:14px;color:var(--text);border-bottom:1px solid var(--border);">'+label+'</div>';
      }).join('');
      box.style.display='block';
    }catch{box.style.display='none';}
  },350);
}
function obPick(city,cc,lat,lng,label){
  document.getElementById('ob-city').value=label;document.getElementById('ob-lat').value=lat;
  document.getElementById('ob-lng').value=lng;document.getElementById('ob-nation').value=cc;
  document.getElementById('ob-city-sugg').style.display='none';document.getElementById('btn-s6').disabled=false;
}

function goLaunch(){
  user.name=document.getElementById('ob-name').value.trim()||'';
  const m=document.getElementById('ob-month').value,d=document.getElementById('ob-day').value,y=document.getElementById('ob-year').value;
  if(m&&d&&y)user.birthDate=y+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0');
  user.birthTime=document.getElementById('ob-time').value||'';
  user.birthCity=document.getElementById('ob-city').value.trim()||'';
  user.birthLat=document.getElementById('ob-lat').value||'';
  user.birthLng=document.getElementById('ob-lng').value||'';
  user.birthNation=document.getElementById('ob-nation').value||'';
  launchApp();
}

// PAYWALL
function selectPlan(p){selectedPlan=p;['week','month','annual'].forEach(id=>document.getElementById('plan-'+id).classList.toggle('selected',id===p));}
function goPay(){
  const links={week:'https://buy.stripe.com/cNi4gz43e4YFdDU4sg5J600',month:'https://buy.stripe.com/dRm6oHfLW62J7fw8Iw5J601',annual:'https://buy.stripe.com/fZu14n9nyezf0R82k85J603'};
  window.open(links[selectedPlan],'_blank');
}
function enterApp(){
  showPage('page-app');initAITab();setTimeout(showReview,45000);
}
function launchApp(){
  showPage('page-app'); initAITab();generateChart();
}

function debugSkipAPI(){
  user={name:'Ana',gender:'female',lang:'pt',birthDate:'2004-12-25',birthTime:'14:26',birthCity:'Sao Paulo, Brazil',birthLat:'-23.5505',birthLng:'-46.6333',birthNation:'BR'};
  showPage('page-app');
  const mockPlacements={sun:'Cap',sunDeg:"4\xb014'",moon:'Gem',moonDeg:"23\xb057'",asc:'Ari',ascDeg:"22\xb015'"};
  chartRawData={planets:[
    {name:'Sun',sign:'Cap',abs_pos:274.23,house:'Ninth_House',retrograde:false},
    {name:'Moon',sign:'Gem',abs_pos:83.94,house:'Third_House',retrograde:false},
    {name:'Mercury',sign:'Sag',abs_pos:252.51,house:'Eighth_House',retrograde:false},
    {name:'Venus',sign:'Sag',abs_pos:251.20,house:'Eighth_House',retrograde:false},
    {name:'Mars',sign:'Sag',abs_pos:240.01,house:'Eighth_House',retrograde:false},
    {name:'Jupiter',sign:'Lib',abs_pos:196.64,house:'Sixth_House',retrograde:false},
    {name:'Saturn',sign:'Can',abs_pos:115.41,house:'Fourth_House',retrograde:true},
    {name:'Uranus',sign:'Pis',abs_pos:333.68,house:'Eleventh_House',retrograde:false},
    {name:'Neptune',sign:'Aqu',abs_pos:313.64,house:'Tenth_House',retrograde:false},
    {name:'Pluto',sign:'Sag',abs_pos:262.49,house:'Ninth_House',retrograde:false},
    {name:'Chiron',sign:'Cap',abs_pos:295.00,house:'Tenth_House',retrograde:false},
    {name:'True_North_Lunar_Node',sign:'Tau',abs_pos:30.12,house:'First_House',retrograde:true},
    {name:'Mean_Lilith',sign:'Can',abs_pos:106.08,house:'Third_House',retrograde:false},
    {name:'Ascendant',sign:'Ari',abs_pos:22.25,house:'First_House',retrograde:false},
    {name:'Medium_Coeli',sign:'Cap',abs_pos:292.58,house:'Tenth_House',retrograde:false}
  ],aspects:[],element_distribution:{fire:7,earth:4.6,air:3.5,water:2,fire_percentage:41,earth_percentage:27,air_percentage:20,water_percentage:12}};
  chartContext='mock';
  renderChartTab(mockPlacements,'pt');
  document.getElementById('state-loading').style.display='none';
  document.getElementById('state-results').style.display='block';
  initAITab();
}

// TABS
function switchTab(tab){
  ['chart','reading','sky'].forEach(t=>{
    const tabEl=document.getElementById('tab-'+t);
    const btnEl=document.getElementById('tb-'+t);
    if(tabEl)tabEl.classList.toggle('active',t===tab);
    if(btnEl)btnEl.classList.toggle('active',t===tab);
  });
  document.getElementById('app-scroll').scrollTop=0;
  if(tab==='sky')loadSky();
}

// GENERATE CHART
let chartSVG=null;
async function generateChart(){
  document.getElementById('state-loading').style.display='flex';
  document.getElementById('state-error').style.display='none';
  document.getElementById('state-results').style.display='none';
  document.getElementById('loading-text').textContent='Reading your chart...';
  try{
    let lat=parseFloat(user.birthLat||0),lng=parseFloat(user.birthLng||0);
    if(!lat||!lng){
      const r=await fetch('https://nominatim.openstreetmap.org/search?q='+encodeURIComponent(user.birthCity)+'&format=json&limit=1',{headers:{'Accept-Language':'en'}});
      const d=await r.json();if(!d.length)throw new Error('Could not locate birth city.');
      lat=parseFloat(d[0].lat);lng=parseFloat(d[0].lon);
    }
    const timezone='UTC';
    const[year,month,day]=user.birthDate.split('-').map(Number);
    let hour=12,minute=0;
    if(user.birthTime){const[h,m]=user.birthTime.split(':').map(Number);hour=h;minute=m;}
    const subject={name:user.name||'Chart',year,month,day,hour,minute,city:(user.birthCity||'').split(',')[0].trim(),nation:user.birthNation||'US',longitude:lng,latitude:lat,timezone};
    const chartResp=await fetch('/api/chart',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subject})});
    if(!chartResp.ok){const e=await chartResp.json();throw new Error(e.error||'Chart API error');}
    const chartJSON=await chartResp.json();
    chartRawData=chartJSON.chart_data;chartSVG=chartJSON.chart_svg||null;chartContext=chartJSON.context||'';
    if(currentUser)saveUserProfile(chartRawData,chartContext);
    const planets=chartRawData.planets||[];
    const fp=n=>planets.find(p=>p.name?.toLowerCase()===n.toLowerCase());
    const sun=fp('Sun'),moon=fp('Moon'),asc=fp('Ascendant');
    const placements={sun:sun?sun.sign:'--',sunDeg:sun?fmtDeg(sun.abs_pos):'',moon:moon?moon.sign:'--',moonDeg:moon?fmtDeg(moon.abs_pos):'',asc:asc?asc.sign:(user.birthTime?'--':'?'),ascDeg:asc?fmtDeg(asc.abs_pos):''};
    renderChartTab(placements,user.lang);
    document.getElementById('state-loading').style.display='none';
    document.getElementById('state-results').style.display='block';
   initAITab();
    loadReading(placements,user.lang);
  }catch(e){
    document.getElementById('state-loading').style.display='none';
    document.getElementById('state-error').style.display='flex';
    document.getElementById('error-msg').textContent=e.message;
  }
}

async function loadReading(placements,lang){
  document.getElementById('reading-loading').style.display='flex';
  document.getElementById('reading-content').style.display='none';
  document.getElementById('reading-gate').style.display='none';
  try{
    const sysPrompt=buildSystemPrompt(lang);
    const uMsg=buildUserMessage(placements,lang);
    const interpResp=await fetch('/api/interpret',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({system:sysPrompt,userMessage:uMsg,maxTokens:3000})});
    if(!interpResp.ok){const e=await interpResp.json();throw new Error(e.error||'Interpretation error');}
    const interpJSON=await interpResp.json();
    currentData=JSON.parse(interpJSON.text.replace(/```json|```/g,'').trim());
    renderReadingTab(placements,lang);
    document.getElementById('reading-loading').style.display='none';
    document.getElementById('reading-content').style.display='block';
  }catch(e){
    document.getElementById('reading-loading').style.display='none';
    document.getElementById('reading-content').style.display='block';
    document.getElementById('reading-wrap').innerHTML='<div style="padding:20px;color:#e07070;font-size:14px;">Error loading reading: '+e.message+'</div>';
  }
}

function fmtDeg(absPos){
  if(absPos===undefined||absPos===null)return'';
  const w=absPos%30,d=Math.floor(w),m=Math.round((w-d)*60);
  return m>0?d+"\xb0"+String(m).padStart(2,'0')+"'":d+"\xb0";
}

function translateSign(abbr){
  const MAP={Cap:'Capric\xf3rnio',Can:'C\xe2ncer',Gem:'G\xeameos',Sag:'Sagit\xe1rio',Lib:'Libra',Sco:'Escorpi\xe3o',Ari:'\xc1ries',Tau:'Touro',Leo:'Le\xe3o',Vir:'Virgem',Aqu:'Aqu\xe1rio',Pis:'Peixes',Aries:'\xc1ries',Taurus:'Touro',Gemini:'G\xeameos',Cancer:'C\xe2ncer',Virgo:'Virgem',Libra:'Libra',Scorpio:'Escorpi\xe3o',Sagittarius:'Sagit\xe1rio',Capricorn:'Capric\xf3rnio',Aquarius:'Aqu\xe1rio',Pisces:'Peixes'};
  return MAP[abbr]||abbr;
}

function renderChartTab(placements,lang){
  const wrap=document.getElementById('chart-wrap');
  const isPT=lang==='pt';
  const name=user.name||'Your Chart';
  const locale=isPT?'pt-BR':'en-US';
  const ds=new Date(user.birthDate+'T12:00:00').toLocaleDateString(locale,{month:'long',day:'numeric',year:'numeric'});
  let td='';
  if(user.birthTime){const[h,m]=user.birthTime.split(':').map(Number);if(isPT){td=' \xb7 '+String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');}else{const ap=h>=12?'PM':'AM';const h12=h%12||12;td=' \xb7 '+h12+':'+String(m).padStart(2,'0')+' '+ap;}}
  const lunar=chartRawData?.lunar_phase||{};
  const planets=chartRawData?.planets||[];
  const houseCounts={};
  planets.forEach(p=>{if(p.house)houseCounts[p.house]=(houseCounts[p.house]||0)+1;});
  const stelliums=Object.entries(houseCounts).filter(([h,c])=>c>=3).map(([h])=>h);
  const dist=chartRawData?.element_distribution||{};

  let html='<div style="text-align:center;padding:28px 20px 8px;"><div style="font-family:var(--font-serif);font-size:32px;color:var(--text);margin-bottom:4px;">'+name+'</div><div style="font-size:13px;color:var(--text-dim);">'+ds+td+' \xb7 '+(user.birthCity||'').split(',')[0]+'</div></div>';
  html+='<div class="big3"><div class="big3-item"><div class="big3-label">'+(isPT?'Sol':'Sun')+'</div><div class="big3-value">'+translateSign(placements.sun)+'</div><div class="big3-deg">'+placements.sunDeg+'</div></div><div class="big3-item"><div class="big3-label">'+(isPT?'Lua':'Moon')+'</div><div class="big3-value">'+translateSign(placements.moon)+'</div><div class="big3-deg">'+placements.moonDeg+'</div></div><div class="big3-item"><div class="big3-label">Rising</div><div class="big3-value">'+(isPT?translateSign(placements.asc):placements.asc)+'</div><div class="big3-deg">'+placements.ascDeg+'</div></div></div>';

  // SAVE BUTTON — only for unauthenticated users
  if(!currentUser){
    html+='<div class="save-chart-bar">'
      +'<button class="save-chart-btn" onclick="showSaveModal()">&#10022; '+(isPT?'Salvar meu mapa':'Save my chart')+'</button>'
      +'<div class="save-chart-sub">'+(isPT?'Gratuito — seu mapa não será perdido':'Free — your chart won\'t be lost')+'</div>'
      +'</div>';
  }

  if(lunar.moon_phase_name){html+='<div style="margin:12px 20px 0;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:12px 16px;display:flex;align-items:center;gap:10px;"><span style="font-size:22px">'+(lunar.moon_emoji||'\ud83c\udf15')+'</span><div><div style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:var(--text-dim);margin-bottom:2px">'+(isPT?'Lua no nascimento':'Birth moon')+'</div><div style="font-size:14px;color:var(--gold)">'+lunar.moon_phase_name+'</div></div></div>';}
  if(stelliums.length){const hN={'First_House':'1','Second_House':'2','Third_House':'3','Fourth_House':'4','Fifth_House':'5','Sixth_House':'6','Seventh_House':'7','Eighth_House':'8','Ninth_House':'9','Tenth_House':'10','Eleventh_House':'11','Twelfth_House':'12'};html+='<div style="margin:12px 20px 0;background:rgba(201,169,110,0.08);border:1px solid rgba(201,169,110,0.2);border-radius:12px;padding:12px 16px;"><div style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:var(--gold);margin-bottom:4px">Stellium</div><div style="font-size:13px;color:var(--text-muted)">'+stelliums.map(h=>(isPT?'Casa':'House')+' '+(hN[h]||h)+': 3+ '+(isPT?'planetas':'planets')).join(' \xb7 ')+'</div></div>';}
  html+='<div class="section-block" style="margin-top:16px;"><div class="section-header" onclick="toggleSection(\'sec-planets\')"><div class="section-icon" style="background:#a89bd418;color:#a89bd4">\u25c9</div><div class="section-title">'+(isPT?'Planetas':'Planets')+'</div><div class="section-chevron open" id="chev-planets">\u25bc</div></div><div class="section-body open" id="sec-planets">'+buildPlanetsHTML(chartRawData,isPT)+'</div></div>';
  html+='<div class="section-block"><div class="section-header" onclick="toggleSection(\'sec-aspects\')"><div class="section-icon" style="background:#d47fa618;color:#d47fa6">\u26af</div><div class="section-title">'+(isPT?'Aspectos':'Aspects')+'</div><div class="section-chevron open" id="chev-aspects">\u25bc</div></div><div class="section-body open" id="sec-aspects">'+buildAspectsHTML(chartRawData,isPT)+'</div></div>';
  if(dist.fire_percentage!==undefined){
    const elems=[{label:isPT?'Fogo':'Fire',pct:dist.fire_percentage,color:'#e07060'},{label:isPT?'Terra':'Earth',pct:dist.earth_percentage,color:'#8fbf8a'},{label:isPT?'Ar':'Air',pct:dist.air_percentage,color:'#7fb5c9'},{label:isPT?'\xc1gua':'Water',pct:dist.water_percentage,color:'#8b7fd4'}];
    html+='<div class="section-block"><div class="section-header" onclick="toggleSection(\'sec-elems\')"><div class="section-icon" style="background:#8fbf8a18;color:#8fbf8a">\u25c8</div><div class="section-title">'+(isPT?'Elementos':'Elements')+'</div><div class="section-chevron" id="chev-elems">\u25bc</div></div><div class="section-body" id="sec-elems" style="padding:0 20px 16px;">';
    elems.forEach(e=>{html+='<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;"><span style="font-size:13px;color:var(--text-muted);width:44px">'+e.label+'</span><div style="flex:1;height:5px;background:var(--surface2);border-radius:3px;"><div style="width:'+e.pct+'%;height:100%;background:'+e.color+';border-radius:3px;"></div></div><span style="font-size:12px;color:'+e.color+';width:30px;text-align:right">'+e.pct+'%</span></div>';});
    html+='</div></div>';
  }
  html+='<div style="padding:20px;text-align:center;"><a href="/terms.html" target="_blank" style="font-size:12px;color:var(--text-dim);text-decoration:none;">Terms \xb7 Privacy \xb7 Disclaimer</a></div>';
  wrap.innerHTML=html;
}

function renderReadingTab(placements, lang) {
  const wrap = document.getElementById('reading-wrap');
  const isPT = lang === 'pt';
  if (!currentData) { wrap.innerHTML = ''; return; }

  const SECTION_COLORS = {
    identidade:   '#c9a96e',
    temperamento: '#e07060',
    emocional:    '#8b7fd4',
    intelecto:    '#7fb5c9',
    vida_afetiva: '#d47fa6',
    forca_interior:'#e07060',
    oportunidades:'#8fbf8a',
    desafios:     '#a89bd4',
    evolucao:     '#7fb5c9',
  };

  const SECTION_ORDER = ['identidade','temperamento','emocional','intelecto','vida_afetiva','forca_interior','oportunidades','desafios','evolucao'];

  let html = '';

  for (const [idx, key] of SECTION_ORDER.entries()) {
    const sec = currentData[key];
    if (!sec) continue;
    const color = SECTION_COLORS[key] || 'var(--gold)';
    const secId = 'sec-p' + idx;
    const chevId = 'chev-p' + idx;
    const isFirst = idx === 0;

    html += '<div class="section-block">'
      + '<div class="section-header" onclick="toggleSection(\'' + secId + '\')">'
      + '<div class="section-icon" style="background:' + color + '18;color:' + color + '">◉</div>'
      + '<div style="flex:1;">'
      + '<div class="section-title">' + (sec.titulo || key) + '</div>'
      + '<div style="font-size:11px;color:var(--text-dim);margin-top:2px;">' + (sec.subtitulo || '') + '</div>'
      + '</div>'
      + '<div class="section-chevron ' + (isFirst ? 'open' : '') + '" id="' + chevId + '">▾</div>'
      + '</div>'
      + '<div class="section-body ' + (isFirst ? 'open' : '') + '" id="' + secId + '">'
      + '<div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:18px 18px 14px;margin-bottom:10px;">';

    (sec.paragrafos || []).forEach(p => {
      html += '<p style="font-size:15px;line-height:1.78;font-weight:300;color:var(--text);margin-bottom:14px;">' + p + '</p>';
    });

    if (sec.aspectos_chave && sec.aspectos_chave.filter(a => a).length) {
      html += '<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px;">';
      sec.aspectos_chave.filter(a => a).forEach(a => {
        html += '<span style="background:var(--surface2);border:1px solid var(--border);border-radius:20px;padding:4px 12px;font-size:11px;color:var(--text-dim);">' + a + '</span>';
      });
      html += '</div>';
    }

    html += '</div></div></div>';
  }

  wrap.innerHTML = html;
}

function toggleSection(id){
  const body=document.getElementById(id);
  const chev=document.getElementById('chev-'+id.replace('sec-',''));
  if(!body)return;
  const open=body.classList.toggle('open');
  if(chev)chev.classList.toggle('open',open);
}

function getChartDicts(isPT){
  const SIGN_PT={Aries:'\xc1ries',Taurus:'Touro',Gemini:'G\xeameos',Cancer:'C\xe2ncer',Leo:'Le\xe3o',Virgo:'Virgem',Libra:'Libra',Scorpio:'Escorpi\xe3o',Sagittarius:'Sagit\xe1rio',Capricorn:'Capric\xf3rnio',Aquarius:'Aqu\xe1rio',Pisces:'Peixes',Ari:'\xc1ries',Tau:'Touro',Gem:'G\xeameos',Can:'C\xe2ncer',Vir:'Virgem',Lib:'Libra',Sco:'Escorpi\xe3o',Sag:'Sagit\xe1rio',Cap:'Capric\xf3rnio',Aqu:'Aqu\xe1rio',Pis:'Peixes'};
  const PLANET_PT={Sun:'Sol',Moon:'Lua',Mercury:'Merc\xfario',Venus:'V\xeanus',Mars:'Marte',Jupiter:'J\xfapiter',Saturn:'Saturno',Uranus:'Urano',Neptune:'Netuno',Pluto:'Plut\xe3o',Chiron:'Qu\xedron',True_North_Lunar_Node:'Nodo Norte',True_Node:'Nodo Norte',Mean_Lilith:'Lilith',Ascendant:'Ascendente',Medium_Coeli:'Meio do C\xe9u'};
  const ASPECT_PT={conjunction:'conjun\xe7\xe3o',opposition:'oposi\xe7\xe3o',trine:'tr\xedgono',square:'quadratura',sextile:'sextil',quincunx:'quinc\xfancio',semisextile:'semi-sextil',semisquare:'semi-quadratura',sesquisquare:'sesquiquadratura',quintile:'quintil'};
  const ORDER=['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto','Chiron','True_Node','True_North_Lunar_Node','Mean_Lilith','Ascendant','Medium_Coeli'];
  const ASPECT_COLORS={conjunction:'#c9a96e',trine:'#8fbf8a',sextile:'#7fb5c9',opposition:'#e07070',square:'#e07070',quincunx:'#a89bd4',quintile:'#8b7fd4'};
  const houseNum=h=>(h||'').replace('_House','').replace('First','1').replace('Second','2').replace('Third','3').replace('Fourth','4').replace('Fifth','5').replace('Sixth','6').replace('Seventh','7').replace('Eighth','8').replace('Ninth','9').replace('Tenth','10').replace('Eleventh','11').replace('Twelfth','12');
  return{pN:n=>isPT?(PLANET_PT[n]||n):n,sN:s=>isPT?(SIGN_PT[s]||s):s,aN:a=>isPT?(ASPECT_PT[a?.toLowerCase()]||a):a,ORDER,ASPECT_COLORS,houseNum};
}

function buildPlanetsHTML(raw,isPT){
  if(!raw)return'';
  const planets=raw.planets||[];
  const{pN,sN,ORDER,houseNum}=getChartDicts(isPT);
  const sorted=[...planets].sort((a,b)=>(ORDER.indexOf(a.name)===-1?99:ORDER.indexOf(a.name))-(ORDER.indexOf(b.name)===-1?99:ORDER.indexOf(b.name)));
  let html='<div class="full-chart"><div class="table-header" style="margin-top:4px;display:flex;"><span style="flex:1.2">'+(isPT?'Planeta':'Planet')+'</span><span style="flex:1.3">'+(isPT?'Signo':'Sign')+'</span><span style="flex:0.8">'+(isPT?'Casa':'House')+'</span><span style="flex:0.8;text-align:right">'+(isPT?'Grau':'Degree')+'</span></div>';
  for(const p of sorted){
    const hn=houseNum(p.house||'');
    const house=hn?(isPT?'Casa':'H.')+' '+hn:'';
    const retro=p.retrograde?'\u211e':'';
    html+='<div class="planet-row"><div class="planet-name">'+pN(p.name)+'</div><div class="planet-sign">'+sN(p.sign)+'</div><div class="planet-house">'+house+'</div><div class="planet-deg">'+fmtDeg(p.abs_pos)+(retro?'<span class="planet-retro"> '+retro+'</span>':'')+'</div></div>';
  }
  html+='</div>';
  return html;
}

function buildAspectsHTML(raw,isPT){
  if(!raw)return'';
  const aspects=raw.aspects||[];
  const{pN,aN,ASPECT_COLORS}=getChartDicts(isPT);
  const PLANET_ORDER=['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto','Chiron','True_North_Lunar_Node','Mean_Lilith','Ascendant','Medium_Coeli'];
  const all=aspects.filter(a=>Math.abs(a.orbit||99)<=8).sort((a,b)=>(PLANET_ORDER.indexOf(a.p1_name)-PLANET_ORDER.indexOf(b.p1_name))||Math.abs(a.orbit)-Math.abs(b.orbit));
  if(!all.length)return'<div style="padding:16px 20px;font-size:13px;color:var(--text-dim)">'+(isPT?'Nenhum aspecto encontrado.':'No aspects found.')+'</div>';
  let html='<div class="full-chart">';
  for(const a of all){
    const col=ASPECT_COLORS[a.aspect?.toLowerCase()]||'var(--text-muted)';
    const orb=Math.abs(a.orbit)<0.5?(isPT?'exato':'exact'):Math.abs(a.orbit).toFixed(1)+'\xb0';
    html+='<div class="aspect-row"><span style="color:var(--text);flex:1.2">'+pN(a.p1_name)+'</span><span style="color:'+col+';flex:1.3">'+aN(a.aspect)+'</span><span style="color:var(--text);flex:1.2">'+pN(a.p2_name)+'</span><span style="color:var(--text-dim);font-size:11px;flex:0.6;text-align:right">'+orb+'</span></div>';
  }
  html+='</div>';
  return html;
}

// AI TAB
function initAITab(){
  if(isPaid){
    document.getElementById('ai-gate').style.display='none';
    document.getElementById('ai-chat').style.display='flex';
    initAI();
  }else{
    document.getElementById('ai-gate').style.display='flex';
    document.getElementById('ai-chat').style.display='none';
  }
}

function initAI(){
  const lang=user.lang,name=user.name,hasChart=!!currentData;
  const welcome=hasChart?(lang==='pt'?'Ol\xe1'+(name?' '+name:'')+'. Seu mapa est\xe1 carregado. O que voc\xea quer explorar?':'Hi'+(name?' '+name:'')+'. Your chart is loaded. What do you want to explore?'):(lang==='pt'?'Carregando mapa...':'Loading chart...');
  document.getElementById('ai-welcome').innerHTML=welcome;
  document.getElementById('ai-subhead').textContent=hasChart?(lang==='pt'?'Mapa de '+name+' carregado':name+"'s chart loaded"):'';
  const questions=hasChart?[
    {label:"What's influencing my day?",prompt:"Considering current transits and my natal chart, what kind of energy is influencing my day? Be specific about which planets are active."},
    {label:"What's blocking me right now?",prompt:"Looking at my natal chart, what placements or patterns are most likely creating internal blocks or resistance right now?"},
    {label:"What should I let go of?",prompt:"Based on my Moon, Saturn, and difficult aspects, what patterns or attachments does my chart suggest I most need to release?"},
    {label:"What's my soul craving?",prompt:"Looking at my North Node, Venus, and 12th house, what does my chart suggest I'm genuinely moving toward at this stage of life?"},
    {label:"What am I outgrowing?",prompt:"Based on my Saturn, Pluto, and South Node, what patterns or identities am I in the process of leaving behind?"},
  ]:[];
  document.getElementById('ai-suggestions').innerHTML=questions.map(q=>'<div class="ai-suggestion" onclick="useSugg('+JSON.stringify(q.prompt)+')">'+q.label+'</div>').join('');
  const msgs=document.getElementById('ai-messages');
  msgs.innerHTML='<div class="ai-msg assistant"><div class="ai-bubble">'+welcome+'</div></div>';
  aiHistory=[];
}

function useSugg(prompt){document.getElementById('ai-input').value=prompt;sendAI();}
function autoResize(el){el.style.height='auto';el.style.height=Math.min(el.scrollHeight,100)+'px';}
function aiKeydown(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendAI();}}

async function sendAI(){
  const input=document.getElementById('ai-input'),text=input.value.trim();
  if(!text||!currentData)return;
  input.value='';input.style.height='auto';
  document.getElementById('ai-suggestions').innerHTML='';
  appendAI('user',text);aiHistory.push({role:'user',content:text});
  const typing=appendAI('assistant','<span style="color:var(--text-dim);font-style:italic">...</span>');
  const lang=user.lang;
  const sys=lang==='pt'?'Voc\xea \xe9 Orbita. Tem acesso ao mapa astral completo. Responda em 2-4 par\xe1grafos. Direto, presente, sem condicionais. Linguagem imparcial.\n\nDados do mapa:\n'+(chartContext?chartContext.substring(0,4000):''):'You are Orbita. You have the full birth chart. Respond in 2-4 paragraphs. Direct, present tense, no conditionals. Imparcial language.\n\nChart:\n'+(chartContext?chartContext.substring(0,4000):'');
  try{
    const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({system:sys,messages:aiHistory,maxTokens:600})});
    const data=await r.json();const reply=data.text;
    typing.innerHTML=reply.split('\n\n').filter(p=>p.trim()).map(p=>'<p>'+p+'</p>').join('');
    aiHistory.push({role:'assistant',content:reply});scrollAI();
  }catch(e){typing.innerHTML='<p style="color:#e07070">Error: '+e.message+'</p>';}
}

function appendAI(role,html){const msgs=document.getElementById('ai-messages');const wrap=document.createElement('div');wrap.className='ai-msg '+role;const bubble=document.createElement('div');bubble.className='ai-bubble';bubble.innerHTML=html;wrap.appendChild(bubble);msgs.appendChild(wrap);scrollAI();return bubble;}
function scrollAI(){const m=document.getElementById('ai-messages');setTimeout(()=>m.scrollTop=m.scrollHeight,50);}
let skyLoaded=false;
async function loadSky(){
  if(skyLoaded)return;
  const now=new Date();
  const isPT=user.lang==='pt';
  document.getElementById('transit-title').textContent=isPT?'Tr\xe2nsitos':'Transits';
  document.getElementById('sky-date').textContent=now.toLocaleDateString(isPT?'pt-BR':'en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
  const SIGN_PT={Aries:'\xc1ries',Ari:'\xc1ries',Taurus:'Touro',Tau:'Touro',Gemini:'G\xeameos',Gem:'G\xeameos',Cancer:'C\xe2ncer',Can:'C\xe2ncer',Leo:'Le\xe3o',Virgo:'Virgem',Vir:'Virgem',Libra:'Libra',Lib:'Libra',Scorpio:'Escorpi\xe3o',Sco:'Escorpi\xe3o',Sagittarius:'Sagit\xe1rio',Sag:'Sagit\xe1rio',Capricorn:'Capric\xf3rnio',Cap:'Capric\xf3rnio',Aquarius:'Aqu\xe1rio',Aqu:'Aqu\xe1rio',Pisces:'Peixes',Pis:'Peixes'};
  const NAME_PT={Sun:'Sol',Moon:'Lua',Mercury:'Merc\xfario',Venus:'V\xeanus',Mars:'Marte',Jupiter:'J\xfapiter',Saturn:'Saturno',Uranus:'Urano',Neptune:'Netuno',Pluto:'Plut\xe3o',True_North_Lunar_Node:'Nodo Norte',True_Node:'Nodo Norte',Chiron:'Qu\xedron',Ascendant:'Ascendente',Medium_Coeli:'Meio do C\xe9u'};
  const ELEM_COLOR={Aries:'#e07060',Ari:'#e07060',Taurus:'#8fbf8a',Tau:'#8fbf8a',Gemini:'#7fb5c9',Gem:'#7fb5c9',Cancer:'#8b7fd4',Can:'#8b7fd4',Leo:'#e07060',Virgo:'#8fbf8a',Vir:'#8fbf8a',Libra:'#7fb5c9',Lib:'#7fb5c9',Scorpio:'#8b7fd4',Sco:'#8b7fd4',Sagittarius:'#e07060',Sag:'#e07060',Capricorn:'#8fbf8a',Cap:'#8fbf8a',Aquarius:'#7fb5c9',Aqu:'#7fb5c9',Pisces:'#8b7fd4',Pis:'#8b7fd4'};
  const sN=s=>isPT?(SIGN_PT[s]||s):s;
  const pN=n=>isPT?(NAME_PT[n]||n):n;

  function transitCard(card,accentColor){
    return '<div style="margin-bottom:12px;background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;">'
      +'<div style="padding:12px 14px 10px;border-bottom:1px solid var(--border);">'
      +'<div style="font-size:13px;font-weight:500;color:var(--text);">'+card.evento+'</div>'
      +'</div>'
      +'<div style="padding:12px 14px;display:flex;flex-direction:column;gap:8px;">'
      +'<div style="display:flex;gap:8px;align-items:flex-start;">'
      +'<span style="font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:var(--text-dim);min-width:80px;padding-top:2px;">'+(isPT?'Significado':'Meaning')+'</span>'
      +'<span style="font-size:13px;color:var(--text-muted);line-height:1.55;flex:1;">'+card.significado+'</span>'
      +'</div>'
      +'<div style="display:flex;gap:8px;align-items:flex-start;">'
      +'<span style="font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:var(--text-dim);min-width:80px;padding-top:2px;">'+(isPT?'Vida real':'Real life')+'</span>'
      +'<span style="font-size:13px;color:var(--text-muted);line-height:1.55;flex:1;">'+card.vida_real+'</span>'
      +'</div>'
      +'<div style="margin-top:2px;padding:8px 10px;background:rgba(201,169,110,0.06);border-left:2px solid '+(accentColor||'var(--gold)')+';border-radius:0 6px 6px 0;">'
      +'<span style="font-size:12px;color:'+(accentColor||'var(--gold)')+';">\u2192 '+card.orientacao+'</span>'
      +'</div>'
      +'</div>'
      +'</div>';
  }

  try{
    const skyResp=await fetch('/api/sky');
    const skyData=await skyResp.json();
    if(skyData.planets&&skyData.planets.length){
      let html='';
      for(const p of skyData.planets){
        const sign=p.sign||'';
        const deg=p.degree!=null?p.degree.toFixed(0):'';
        html+='<div style="display:flex;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);">'
          +'<div style="font-size:13px;color:var(--text);flex:1.2;">'+pN(p.name)+'</div>'
          +'<div style="font-size:13px;color:'+(ELEM_COLOR[sign]||'var(--gold)')+';">'+sN(sign)+(p.retrograde?' <span style="color:var(--text-dim);font-size:11px;">Rx</span>':'')+'</div>'
          +'<div style="font-size:12px;color:var(--text-dim);margin-left:auto;">'+deg+'\xb0</div>'
          +'</div>';
      }
      document.getElementById('sky-planets').innerHTML=html;
    }
    const natalPlanets=(chartRawData?.planets||[]).filter(p=>p.abs_pos!=null).map(p=>({name:p.name,sign:p.sign,abs_pos:parseFloat(parseFloat(p.abs_pos).toFixed(4)),degree:parseFloat((p.abs_pos%30).toFixed(2)),house:p.house||null}));
    const analysisResp=await fetch('/api/transit-analysis',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({skyPlanets:skyData.planets,natalPlanets,natalContext:chartContext||'',lang:user.lang,name:user.name})});
    const analysis=await analysisResp.json();

    if(analysis._aspects&&analysis._aspects.length){
      const ASPECT_COLOR={'conjun\xe7\xe3o':'#c9a96e','conjunction':'#c9a96e','oposi\xe7\xe3o':'#e07070','opposition':'#e07070','quadratura':'#e07070','square':'#e07070','tr\xedgono':'#8fbf8a','trine':'#8fbf8a','sextil':'#7fb5c9','sextile':'#7fb5c9'};
      const PLANET_SYMBOL={Sun:'\u2609',Moon:'\u263d',Mercury:'\u263f',Venus:'\u2640',Mars:'\u2642',Jupiter:'\u2643',Saturn:'\u2644',Uranus:'\u2645',Neptune:'\u2646',Pluto:'\u2647',True_Node:'\u260a',True_North_Lunar_Node:'\u260a',Chiron:'\u26b7'};
      const sym=n=>PLANET_SYMBOL[n]||'';
      const rxSpan=p=>p.retrograde?'<span style="font-size:10px;color:var(--text-dim);"> Rx</span>':'';
      let aspectHtml='<div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:var(--text-dim);margin:20px 0 10px;">'+(isPT?'C\xe9u atual \xd7 seu mapa':'Current sky \xd7 your chart')+'</div>';
      for(const a of analysis._aspects){
        const col=ASPECT_COLOR[a.aspect]||'var(--gold)';
        const tDeg=a.transit.degree!=null?a.transit.degree.toFixed(0):'?';
        const nDeg=a.natal.degree!=null?a.natal.degree.toFixed(0):'?';
        aspectHtml+='<div style="display:flex;align-items:center;padding:9px 0;border-bottom:1px solid var(--border);gap:8px;flex-wrap:wrap;">'
          +'<div style="font-size:13px;color:var(--text);min-width:130px;">'+sym(a.transit.name)+' '+pN(a.transit.name)+rxSpan(a.transit)+'<span style="color:var(--text-dim);font-size:12px;"> '+sN(a.transit.sign)+' '+tDeg+'\xb0</span></div>'
          +'<div style="font-size:12px;color:'+col+';font-weight:500;min-width:90px;text-align:center;">'+a.aspect+' <span style="color:var(--text-dim);font-size:10px;">('+a.orb+'\xb0)</span></div>'
          +'<div style="font-size:13px;color:var(--text-muted);flex:1;">'+sym(a.natal.name)+' '+pN(a.natal.name)+'<span style="color:var(--text-dim);font-size:12px;"> '+sN(a.natal.sign)+' '+nDeg+'\xb0'+(a.natal.house?' Casa '+a.natal.house:'')+'</span></div>'
          +'</div>';
      }
      document.getElementById('sky-planets').insertAdjacentHTML('afterend','<div id="aspect-table">'+aspectHtml+'</div>');
    }

  // Renderizar áreas da vida com os campos corretos da API
    const AREAS_CONFIG = [
      { key: 'panorama_geral', label: isPT ? 'Panorama geral' : 'Overview',       color: '#c9a96e' },
      { key: 'amor',           label: isPT ? 'Amor'           : 'Love',            color: '#d47fa6' },
      { key: 'carreira',       label: isPT ? 'Carreira'       : 'Career',          color: '#7fb5c9' },
      { key: 'dinheiro',       label: isPT ? 'Dinheiro'       : 'Money',           color: '#8fbf8a' },
      { key: 'vitalidade',     label: isPT ? 'Vitalidade'     : 'Vitality',        color: '#e07060' },
      { key: 'familia',        label: isPT ? 'Família'        : 'Family',          color: '#a89bd4' },
      { key: 'vida_social',    label: isPT ? 'Vida social'    : 'Social life',     color: '#7fb5c9' },
    ];

    const panorama = analysis.panorama_geral;
    if (panorama) {
      document.getElementById('transit-summary').innerHTML =
        '<div style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:var(--gold);margin-bottom:8px;">' + (isPT ? 'Hoje' : 'Today') + '</div>'
        + '<div style="font-size:15px;color:var(--text);line-height:1.7;margin-bottom:8px;">' + (panorama.resumo || '') + '</div>'
        + '<div style="font-size:13px;color:var(--gold);border-left:2px solid var(--gold);padding-left:10px;margin-top:8px;">\u2192 ' + (panorama.orientacao || '') + '</div>';
    }

    let areasHtml = '';
    for (const area of AREAS_CONFIG.slice(1)) { // skip panorama_geral, já renderizado acima
      const data = analysis[area.key];
      if (!data || !data.resumo) continue;
      const hasNoInfo = data.resumo.toLowerCase().includes('sem influência') || data.resumo.toLowerCase().includes('no significant');
      if (hasNoInfo) continue;
      areasHtml +=
        '<div style="margin-bottom:12px;background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;">'
        + '<div style="padding:10px 14px 8px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;">'
        + '<span style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:' + area.color + ';">' + area.label + '</span>'
        + '</div>'
        + '<div style="padding:12px 14px;display:flex;flex-direction:column;gap:8px;">'
        + '<div style="font-size:14px;color:var(--text-muted);line-height:1.65;">' + data.resumo + '</div>'
        + '<div style="font-size:13px;color:' + area.color + ';border-left:2px solid ' + area.color + ';padding-left:10px;">\u2192 ' + (data.orientacao || '') + '</div>'
        + '</div></div>';
    }

    if (areasHtml) {
      document.getElementById('transit-questions-card').style.display = 'block';
      document.getElementById('transit-questions-title').textContent = isPT ? 'Áreas da vida' : 'Life areas';
      document.getElementById('transit-questions').innerHTML = areasHtml;
    }

    const transitListEl=document.getElementById('transit-list');
    if(transitListEl&&transitListEl.innerHTML.trim()){
      const listLabel=isPT?'Ver tr\xe2nsitos ativos':'See active transits';
      const collapseId='collapse-transit-list';
      const btnId='btn-transit-list';
      const wrapper=document.createElement('div');
      wrapper.className='moon-card';wrapper.style.padding='0';
      wrapper.innerHTML='<button id="'+btnId+'" onclick="toggleCollapse(\''+collapseId+'\',\''+btnId+'\')" style="width:100%;background:none;border:none;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;font-family:var(--font-sans);font-size:14px;color:var(--text-muted);"><span>'+listLabel+'</span><span id="'+btnId+'-icon" style="font-size:11px;color:var(--text-dim);">\u25bc</span></button><div id="'+collapseId+'" style="display:none;padding:0 20px 16px;">'+transitListEl.outerHTML+'</div>';
      transitListEl.replaceWith(wrapper);
      const listTitleEl=document.getElementById('transit-list-title');
      if(listTitleEl)listTitleEl.style.display='none';
    }

    const skyPlanetsEl=document.getElementById('sky-planets');
    const aspectTableEl=document.getElementById('aspect-table');
    if(skyPlanetsEl){
      const techLabel=isPT?'Ver detalhes t\xe9cnicos':'See technical details';
      const collapseId='collapse-tech';
      const btnId='btn-tech';
      const techContent='<div style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:var(--text-dim);margin-bottom:8px;">'+(isPT?'Planetas hoje':'Planets today')+'</div>'+skyPlanetsEl.innerHTML+(aspectTableEl?'<div style="margin-top:16px;">'+aspectTableEl.innerHTML+'</div>':'');
      const wrapper=document.createElement('div');
      wrapper.className='moon-card';wrapper.style.padding='0';
      wrapper.innerHTML='<button id="'+btnId+'" onclick="toggleCollapse(\''+collapseId+'\',\''+btnId+'\')" style="width:100%;background:none;border:none;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;font-family:var(--font-sans);font-size:14px;color:var(--text-muted);"><span>'+techLabel+'</span><span id="'+btnId+'-icon" style="font-size:11px;color:var(--text-dim);">\u25bc</span></button><div id="'+collapseId+'" style="display:none;padding:0 20px 16px;">'+techContent+'</div>';
      const skyCard=skyPlanetsEl.closest('.moon-card');
      if(skyCard)skyCard.replaceWith(wrapper);
      if(aspectTableEl)aspectTableEl.remove();
      const skyTitleEl=document.getElementById('sky-planets-title');
      if(skyTitleEl)skyTitleEl.style.display='none';
    }
    document.getElementById('transit-loading').style.display='none';
    document.getElementById('transit-content').style.display='block';
  }
  catch(e){
    document.getElementById('transit-loading').innerHTML='<div style="color:var(--text-dim);font-size:13px;">'+(isPT?'Erro ao carregar tr\xe2nsitos.':'Could not load transits.')+'</div>';
    console.error('loadSky error:',e);
  }
}

function toggleCollapse(collapseId,btnId){
  const el=document.getElementById(collapseId);
  const icon=document.getElementById(btnId+'-icon');
  if(!el)return;
  const open=el.style.display==='none';
  el.style.display=open?'block':'none';
  if(icon)icon.textContent=open?'\u25b2':'\u25bc';
}

async function askTransitQuestion(question){
  const isPT=user.lang==='pt';
  const answerCard=document.getElementById('transit-answer-card');
  const answerText=document.getElementById('transit-answer-text');
  answerCard.style.display='block';
  answerText.innerHTML='<span style="color:var(--text-dim);font-style:italic;">'+(isPT?'Analisando...':'Analyzing...')+'</span>';
  answerCard.scrollIntoView({behavior:'smooth',block:'nearest'});
  const sys=isPT?'Voc\xea \xe9 Orbita. Responda em 2-3 par\xe1grafos curtos. Direto, comportamental, sem jarg\xe3o. Termine com uma a\xe7\xe3o concreta que a pessoa pode tomar hoje.':'You are Orbita. Answer in 2-3 short paragraphs. Direct, behavioral, no jargon. End with a concrete action the person can take today.';
  try{
    const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({system:sys+'\n\nChart:\n'+(chartContext?chartContext.substring(0,2000):''),messages:[{role:'user',content:question}],maxTokens:500})});
    const data=await r.json();
    answerText.innerHTML=data.text.split('\n\n').filter(p=>p.trim()).map(p=>'<p style="margin-bottom:10px;font-size:14px;line-height:1.75;">'+p+'</p>').join('');
  }catch(e){
    answerText.innerHTML='<p style="color:#e07070">'+e.message+'</p>';
  }
}
// REVIEW
function showReview(){document.getElementById('review-modal').classList.add('visible');}
function closeReview(){document.getElementById('review-modal').classList.remove('visible');}
function rateModal(n){document.querySelectorAll('#review-modal .modal-star').forEach((s,i)=>s.classList.toggle('lit',i<n));document.getElementById('modal-cta').disabled=false;}
function submitReview(){window.open('https://orbita-pi.vercel.app','_blank');closeReview();}

// SYSTEM PROMPTS
function buildSystemPrompt(lang){
  const isPT = lang === 'pt';
  const langLabel = isPT ? 'Brazilian Portuguese' : 'English';
  return `You are Orbita, an astrology analysis engine. Write in ${langLabel}.

TONE: Direct, behavioral, specific. No metaphors, no spiritual language, no conditionals.
FORBIDDEN WORDS: journey, energy, vibe, resonate, cosmic, mystical, shadow work, portal, awakening, soul, universe, healing, sacred.
EVERY sentence must describe observable behavior or name a specific planet/sign/house.
Write as if describing someone to a third party — imparcial, not "you are X" but "people with this placement tend to X".
Then shift to second person for concrete impact: "This shows up when..."

Return ONLY valid JSON, no markdown, no preamble.

Structure — each section has:
- "titulo": section title
- "subtitulo": planet + sign + house, e.g. "Sol em Capricórnio, Casa 9"  
- "paragrafos": array of 2-4 strings, each a standalone behavioral observation
- "aspectos_chave": 1-2 most relevant aspects affecting this planet, as short strings

{
  "identidade": {
    "titulo": "${isPT ? 'Sua identidade' : 'Your identity'}",
    "subtitulo": "Sol em X + Ascendente em Y",
    "paragrafos": ["...", "...", "..."],
    "aspectos_chave": ["Sol quadratura Saturno", "..."]
  },
  "temperamento": {
    "titulo": "${isPT ? 'Seu temperamento' : 'Your temperament'}",
    "subtitulo": "${isPT ? 'Distribuição de elementos' : 'Element distribution'}",
    "paragrafos": ["...", "..."],
    "aspectos_chave": []
  },
  "emocional": {
    "titulo": "${isPT ? 'Seu emocional' : 'Your emotional world'}",
    "subtitulo": "Lua em X, Casa Y",
    "paragrafos": ["...", "...", "..."],
    "aspectos_chave": ["Lua oposta Plutão", "..."]
  },
  "intelecto": {
    "titulo": "${isPT ? 'Seu intelecto' : 'Your intellect'}",
    "subtitulo": "Mercúrio em X, Casa Y",
    "paragrafos": ["...", "..."],
    "aspectos_chave": ["..."]
  },
  "vida_afetiva": {
    "titulo": "${isPT ? 'Vida afetiva' : 'Affective life'}",
    "subtitulo": "Vênus em X, Casa Y",
    "paragrafos": ["...", "...", "..."],
    "aspectos_chave": ["..."]
  },
  "forca_interior": {
    "titulo": "${isPT ? 'Força interior' : 'Inner drive'}",
    "subtitulo": "Marte em X, Casa Y",
    "paragrafos": ["...", "..."],
    "aspectos_chave": ["..."]
  },
  "oportunidades": {
    "titulo": "${isPT ? 'Oportunidades' : 'Opportunities'}",
    "subtitulo": "Júpiter em X, Casa Y",
    "paragrafos": ["...", "..."],
    "aspectos_chave": ["..."]
  },
  "desafios": {
    "titulo": "${isPT ? 'Desafios' : 'Challenges'}",
    "subtitulo": "Saturno em X, Casa Y",
    "paragrafos": ["...", "...", "..."],
    "aspectos_chave": ["..."]
  },
    "evolucao": {
    "titulo": "${isPT ? 'Evolução pessoal' : 'Personal evolution'}",
    "subtitulo": "${isPT ? 'Netuno, Urano e Plutão' : 'Neptune, Uranus and Pluto'}",
    "paragrafos": ["...", "..."],
    "aspectos_chave": ["..."]
  }
}
`;
}
function buildUserMessage(placements,lang){
  const isPT = lang === 'pt';
  return (isPT?'Nome':'Name')+': '+user.name+'\n'
    +(isPT?'Genero':'Gender')+': '+(user.gender==='female'?(isPT?'Mulher':'Woman'):(isPT?'Homem':'Man'))+'\n'
    +(isPT?'Data':'Date')+': '+user.birthDate+'\n'
    +(isPT?'Hora':'Time')+': '+(user.birthTime||'unknown')+'\n'
    +(isPT?'Cidade':'City')+': '+user.birthCity+'\n'
    +(isPT?'Sol':'Sun')+': '+placements.sun+' '+placements.sunDeg
    +' | '+(isPT?'Lua':'Moon')+': '+placements.moon+' '+placements.moonDeg
    +' | '+(isPT?'Ascendente':'Rising')+': '+placements.asc+' '+placements.ascDeg+'\n\n'
    +(isPT?'Dados completos do mapa (Swiss Ephemeris):':'Full chart data (Swiss Ephemeris):')
    +'\n'+chartContext.substring(0,3000)
    +'\n\n'+(isPT?'Retorne APENAS o JSON valido.':'Return ONLY valid JSON.');
}
window.addEventListener('load',function(){
  initAuth();
  initDates();
});
