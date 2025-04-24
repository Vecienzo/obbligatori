console.log("🚀 script.js (v1.4) caricato correttamente");

// Stati globali
let loadedDrugData = [];
const sortDirections = { nome:true,codice:true,disponibilita:true,posizione:true,scadenza:true };

// DOM refs
const fileInput           = document.getElementById('csvFileInput');
const statusMessage       = document.getElementById('statusMessage');
const auditReminder       = document.getElementById('auditReminder');
const startAuditButton    = document.getElementById('startAuditButton');
const resetAuditButton    = document.getElementById('resetAuditButton');
const auditHistorySection = document.getElementById('auditHistorySection');
const auditHistoryList    = document.getElementById('auditHistoryList');
const auditSnapshotView   = document.getElementById('auditSnapshotView');
const snapshotDateSpan    = document.getElementById('snapshotDate');
const snapshotTableBody   = document.getElementById('snapshotTableBody');
const closeSnapshotButton = document.getElementById('closeSnapshotButton');
const interactionArea     = document.getElementById('interactionArea');
const searchInput         = document.getElementById('searchInput');
const searchButton        = document.getElementById('searchButton');
const showAllButton       = document.getElementById('showAllButton');
const checkExpiryButton   = document.getElementById('checkExpiryButton');
const checkStockButton    = document.getElementById('checkStockButton');
const downloadCsvButton   = document.getElementById('downloadExcelButton');
const printTableButton    = document.getElementById('printButton');
const locationFilterSelect= document.getElementById('locationFilter');
const resultsTableBody    = document.getElementById('resultsTableBody');
const notFoundMessageArea = document.getElementById('notFoundMessageArea');
const toast               = document.getElementById('toast');

// Event listeners
window.addEventListener('load', () => {
  checkAuditStatus();
  populateAuditHistory();
});
fileInput.addEventListener('change', handleFileSelect);
searchButton .addEventListener('click', searchDrug);
showAllButton.addEventListener('click', displayAllDrugs);
checkExpiryButton.addEventListener('click', checkExpiringDrugs);
checkStockButton .addEventListener('click', checkZeroStock);
downloadCsvButton.addEventListener('click', downloadAsExcel);
printTableButton .addEventListener('click', printResults);
startAuditButton.addEventListener('click', confirmAuditCheck);
resetAuditButton.addEventListener('click', () => {
  localStorage.removeItem('lastAuditCheck');
  showToast('✅ Stato revisione resettato.');
  checkAuditStatus();
});
searchInput   .addEventListener('keypress', e => { if(e.key==='Enter') searchDrug(); });
closeSnapshotButton.addEventListener('click', ()=>auditSnapshotView.style.display='none');

// --- Revisione mensile e storico ---
function checkAuditStatus(){
  const last = localStorage.getItem('lastAuditCheck');
  const now  = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  auditReminder.style.display = (!last||!last.startsWith(thisMonth))?'flex':'none';
}

function confirmAuditCheck(){
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  localStorage.setItem('lastAuditCheck', monthKey);
  addAuditHistory(monthKey, loadedDrugData);
  showToast('✔️ Revisione confermata.');
  printAuditConfirmation(monthKey);
  auditReminder.style.display = 'none';
  populateAuditHistory();
}

function printAuditConfirmation(monthKey){
  const [year,month] = monthKey.split('-');
  const formatted = `${month}/${year}`;
  const w = window.open('','_blank','width=400,height=300');
  w.document.write(`
    <html><head><title>Conferma Revisione</title></head>
    <body style="font-family:sans-serif;padding:20px;">
      <h2>Revisione Giacenze</h2>
      <p>Data conferma: <strong>${formatted}</strong></p>
    </body></html>`);
  w.document.close(); w.print(); w.close();
}

function loadAuditHistory(){
  return JSON.parse(localStorage.getItem('auditHistory')||'[]');
}

function saveAuditHistory(hist){
  localStorage.setItem('auditHistory', JSON.stringify(hist));
}

function addAuditHistory(monthKey, snapshot){
  const hist=loadAuditHistory();
  const idx=hist.findIndex(h=>h.monthKey===monthKey);
  const entry={ monthKey, timestamp:new Date().toISOString(), data:JSON.parse(JSON.stringify(snapshot)) };
  if(idx>=0) hist[idx]=entry;
  else hist.push(entry);
  saveAuditHistory(hist);
}

function populateAuditHistory(){
  const hist=loadAuditHistory();
  auditHistoryList.innerHTML='';
  if(!hist.length){ auditHistorySection.style.display='none'; return; }
  auditHistorySection.style.display='block';
  hist.forEach((h,i)=>{
    const [y,m]=h.monthKey.split('-');
    const li=document.createElement('li');
    li.textContent=`Revisione ${m}/${y} (il ${new Date(h.timestamp).toLocaleString()})`;
    const btn=document.createElement('button');
    btn.textContent='Visualizza';
    btn.className='viewSnapshotButton';
    btn.addEventListener('click',()=>showAuditSnapshot(i));
    li.appendChild(btn);
    auditHistoryList.appendChild(li);
  });
}

function showAuditSnapshot(idx){
  const h=loadAuditHistory()[idx];
  const [y,m]=h.monthKey.split('-');
  snapshotDateSpan.textContent=`${m}/${y}`;
  snapshotTableBody.innerHTML='';
  h.data.forEach(drug=>{
    const tr=document.createElement('tr');
    ['nome','codice','disponibilita','posizione','scadenza'].forEach(f=>{
      const td=document.createElement('td');
      td.textContent = f==='scadenza' 
        ? (()=>{ const [yy,mm]=drug[f].split('-'); return `${mm}/${yy}`; })() 
        : drug[f]||'';
      tr.appendChild(td);
    });
    snapshotTableBody.appendChild(tr);
  });
  auditSnapshotView.style.display='block';
}

// — Toast —
function showToast(msg){
  toast.textContent=msg;
  toast.style.display='block';
  toast.classList.remove('toast-message');
  void toast.offsetWidth;
  toast.classList.add('toast-message');
  setTimeout(()=>toast.style.display='none',3000);
}

// — Caricamento e parsing CSV —
function handleFileSelect(evt){
  const file=evt.target.files[0];
  statusMessage.textContent='';
  interactionArea.style.display='none';
  resultsTableBody.innerHTML='';
  notFoundMessageArea.style.display='none';
  clearLocationFilter();
  loadedDrugData=[];

  if(!file||(!file.type.match('text/csv')&& !file.name.toLowerCase().endsWith('.csv'))){
    statusMessage.textContent='Errore: seleziona un file CSV valido.';
    statusMessage.className='error';
    return;
  }

  const reader=new FileReader();
  reader.onload=e=>{
    try{
      loadedDrugData=parseCSV(e.target.result);
      statusMessage.textContent=`Caricati ${loadedDrugData.length} record dal file`;
      statusMessage.className='success';
      interactionArea.style.display='block';
      populateLocationFilter(loadedDrugData);
    }catch(err){
      statusMessage.textContent=`Errore: ${err.message}`;
      statusMessage.className='error';
    }
  };
  reader.readAsText(file);
}

function parseCSV(text){
  const lines=text.trim().split(/\r?\n/);
  if(lines.length<2) throw new Error("CSV privo di dati.");
  const hdr=lines[0].split(';').map(h=>h.trim().toLowerCase());
  const idx={
    codice:hdr.indexOf('codice aic'),
    nome:hdr.indexOf('denominazione'),
    disponibilita:hdr.indexOf('qta'),
    posizione:hdr.indexOf('ubicazione'),
    scadenza:hdr.indexOf('scadenza')
  };
  if(Object.values(idx).includes(-1)) throw new Error("Header CSV mancanti.");
  return lines.slice(1).map(line=>{
    const c=line.split(';').map(x=>x.trim());
    return {
      codice:c[idx.codice],
      nome:c[idx.nome],
      disponibilita:c[idx.disponibilita],
      posizione:c[idx.posizione],
      scadenza:c[idx.scadenza].split('/').reverse().join('-')
    };
  });
}

// — Filtri & Ubicazioni —
function populateLocationFilter(data){
  clearLocationFilter();
  [...new Set(data.map(d=>d.posizione).filter(Boolean))].sort()
    .forEach(loc=>locationFilterSelect.appendChild(new Option(loc,loc)));
}
function clearLocationFilter(){
  locationFilterSelect.innerHTML='<option value="">Tutte</option>';
}
function filterData(){
  const term=searchInput.value.trim().toLowerCase(), loc=locationFilterSelect.value;
  return loadedDrugData.filter(drug=>
    (!loc||drug.posizione===loc)&&
    (!term||
      drug.codice.toLowerCase().includes(term)||
      drug.nome.toLowerCase().includes(term)
    )
  );
}

// — Azioni principali —
function searchDrug(){ displayResults(filterData(),'Nessun risultato.'); }
function displayAllDrugs(){ searchInput.value=''; displayResults(filterData(),'Nessun dato.'); }
function checkExpiringDrugs(){
  const oggi=new Date(), prox=new Date(oggi.getFullYear(),oggi.getMonth()+1,oggi.getDate());
  displayResults(
    filterData().filter(d=>{const s=new Date(d.scadenza);return s>=oggi&&s<=prox;}),
    'Nessuna scadenza entro 30 gg.',{highlight:'expiry'}
  );
}
function checkZeroStock(){
  displayResults(
    filterData().filter(d=>d.disponibilita==='0'),
    'Nessuna giacenza zero.',{highlight:'stock'}
  );
}

// — Rendering tabella —
function displayResults(data,emptyMsg,opts={}){
  resultsTableBody.innerHTML='';
  notFoundMessageArea.style.display=data.length?'none':'block';
  notFoundMessageArea.textContent=emptyMsg;

  data.forEach((drug,i)=>{
    const row=resultsTableBody.insertRow();
    ['nome','codice','disponibilita','posizione','scadenza'].forEach(field=>{
      const cell=row.insertCell();
      if(field==='scadenza'){
        const raw=drug[field],[y,m]=raw.split('-');
        const inp=document.createElement('input');inp.type='month';inp.value=`${y}-${m}`;inp.classList.add('date-input');
        const wrap=document.createElement('div');wrap.className='tooltip-wrapper';wrap.appendChild(inp);
        const tip=document.createElement('span');tip.className='tooltip-text';tip.textContent=`Scadenza completa: ${raw}`;wrap.appendChild(tip);
        cell.appendChild(wrap);
        inp.addEventListener('change',()=>{
          const [yy,mm]=inp.value.split('-');
          const sel=new Date(parseInt(yy),parseInt(mm),0);
          const now=new Date(),minD=new Date(now.getFullYear(),now.getMonth()+2,now.getDate());
          if(sel<minD){
            showToast('⚠️ Scadenza almeno 2 mesi nel futuro.');
            inp.value=`${y}-${m}`;
          }else updateDrugData(i,field,`${yy}-${mm}-01`);
        });
      }else if(field==='posizione'){
        cell.contentEditable=true;cell.classList.add('editable');cell.textContent=drug[field];
        cell.addEventListener('blur',()=>updateDrugData(i,field,cell.textContent.trim()));
      }else{
        if(field==='scadenza'){
          const raw=drug[field],[yy,mm]=raw.split('-');
          const short=`${mm}/${yy}`;
          const wrap=document.createElement('div');wrap.className='tooltip-wrapper';wrap.textContent=short;
          const tip=document.createElement('span');tip.className='tooltip-text';tip.textContent=`Scadenza completa: ${raw}`;wrap.appendChild(tip);
          cell.appendChild(wrap);
        }else cell.textContent=drug[field]||'';
      }
      if(field==='disponibilita'&&drug[field]==='0')cell.classList.add('zero-stock');
      if(field==='scadenza'&&opts.highlight==='expiry')cell.classList.add('expired-date');
    });
  });
  enableColumnSorting();
}

// — Aggiorna dato —
function updateDrugData(idx,field,val){loadedDrugData[idx][field]=val;}

// — Export CSV —
function downloadAsExcel(){
  const data=filterData();
  if(!data.length){showToast('⚠️ Nessun dato da esportare.');return;}
  const lines=['Codice AIC;Denominazione;Qta;Ubicazione;Scadenza'];
  data.forEach(d=>lines.push(`${d.codice};${d.nome};${d.disponibilita};${d.posizione};${d.scadenza}`));
  const blob=new Blob([lines.join('\n')],{type:'text/csv;charset=utf-8;'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='risultati_farmaci.csv';a.click();
}

// — Stampa tabella —
function printResults(){
  const html=document.querySelector('.table-container').innerHTML;
  const w=window.open('','_blank','width=900,height=650');
  w.document.write(`<html><head><title>Stampa Farmaci</title></head><body>${html}</body></html>`);
  w.document.close();w.focus();w.print();w.close();
}

// — Ordinamento colonne —
function enableColumnSorting(){
  const headers=document.querySelectorAll('#resultsTable th'),
        map=['nome','codice','disponibilita','posizione','scadenza'];
  headers.forEach((th,i)=>th.onclick=()=>{
    const col=map[i],dir=sortDirections[col]?1:-1;
    const sorted=filterData().slice().sort((a,b)=>{
      const A=a[col]||'',B=b[col]||'';
      if(col==='disponibilita') return dir*(parseInt(A)-parseInt(B));
      if(col==='scadenza')      return dir*(new Date(A)-new Date(B));
      return dir*A.localeCompare(B);
    });
    sortDirections[col]=!sortDirections[col];
    displayResults(sorted,'Nessun risultato.');
  });
}
