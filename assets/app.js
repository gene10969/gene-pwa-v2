
const STORAGE_KEY = "gene_pwa_full_app_v1";
const SETTINGS_KEY = "gene_pwa_settings_v1";
const defaultState = {
  patients: [],
  menus: [
    {name:"初回施術", price:8000, ticketCount:0},
    {name:"通常施術", price:5500, ticketCount:0},
    {name:"回数券販売 5回", price:25000, ticketCount:5},
    {name:"回数券販売 10回", price:45000, ticketCount:10},
    {name:"回数券使用", price:0, ticketCount:0}
  ],
  sales: [], visitNotes: [], reservations: [], receipts: [], intakes: [], chartImages: [], lineLogs: [], appSettings: {},
  updatedAt: new Date().toISOString()
};
let state = loadState();
let settings = loadSettings();
let deferredPrompt = null;
const $ = id => document.getElementById(id);
const yen = n => "¥" + (Number(n)||0).toLocaleString("ja-JP");
const num = v => Number(v)||0;
const today = () => new Date().toISOString().slice(0,10);
const uid = () => Date.now().toString(36)+Math.random().toString(36).slice(2,9);
const patientName = no => (state.patients.find(p => String(p.no)===String(no))||{}).name || "";
function loadState(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY))||structuredClone(defaultState)}catch{return structuredClone(defaultState)}}
function saveState(){state.updatedAt=new Date().toISOString();localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}
function loadSettings(){try{return JSON.parse(localStorage.getItem(SETTINGS_KEY))||{apiUrl:"",apiKey:""}}catch{return{apiUrl:"",apiKey:""}}}
function saveSettings(){localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings))}
function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2200)}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]))}
function ea(s){return String(s).replace(/\\/g,"\\\\").replace(/'/g,"\\'")}
function csvEscape(v){return `"${String(v??"").replace(/"/g,'""')}"`}
function download(name,content,type="text/plain"){const b=new Blob([content],{type});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=name;a.click();URL.revokeObjectURL(u)}
function toCsv(rows,headers){return "\ufeff"+[headers.join(","),...rows.map(r=>headers.map(h=>csvEscape(r[h])).join(","))].join("\n")}
function upsert(arr,obj,key){const i=arr.findIndex(x=>String(x[key])===String(obj[key]));if(i>=0)arr[i]=obj;else arr.push(obj)}

/* ===== gene scroll date selector ===== */
const DATE_FIELD_LABELS = {
  saleDate:"日付",
  firstVisit:"初回来院日",
  visitDate:"日付",
  reservationDate:"日付",
  receiptDate:"日付",
  intakeDate:"日付"
};

function pad2(n){ return String(n).padStart(2,"0"); }
function daysInMonth(y,m){ return new Date(Number(y), Number(m), 0).getDate(); }

function setupScrollDateSelectors(){
  Object.keys(DATE_FIELD_LABELS).forEach(id => {
    const input = $(id);
    if(!input || input.dataset.scrollReady === "1") return;

    input.dataset.scrollReady = "1";
    input.type = "hidden";

    const wrap = document.createElement("div");
    wrap.className = "scroll-date";
    wrap.dataset.target = id;

    const year = document.createElement("select");
    const month = document.createElement("select");
    const day = document.createElement("select");
    year.className = "date-year";
    month.className = "date-month";
    day.className = "date-day";

    const nowYear = new Date().getFullYear();
    for(let y = nowYear - 5; y <= nowYear + 5; y++){
      const opt = document.createElement("option");
      opt.value = String(y);
      opt.textContent = `${y}年`;
      year.appendChild(opt);
    }
    for(let m = 1; m <= 12; m++){
      const opt = document.createElement("option");
      opt.value = pad2(m);
      opt.textContent = `${m}月`;
      month.appendChild(opt);
    }

    wrap.appendChild(year);
    wrap.appendChild(month);
    wrap.appendChild(day);
    input.insertAdjacentElement("afterend", wrap);

    const setFromValue = () => {
      const base = input.value || today();
      const parts = base.split("-");
      year.value = parts[0] || String(nowYear);
      month.value = parts[1] || pad2(new Date().getMonth()+1);
      rebuildDays(day, year.value, month.value, parts[2] || pad2(new Date().getDate()));
      updateHiddenDate(id);
    };

    year.addEventListener("change", () => {
      rebuildDays(day, year.value, month.value, day.value);
      updateHiddenDate(id);
    });
    month.addEventListener("change", () => {
      rebuildDays(day, year.value, month.value, day.value);
      updateHiddenDate(id);
    });
    day.addEventListener("change", () => updateHiddenDate(id));

    setFromValue();
  });
}

function rebuildDays(daySelect, y, m, currentDay){
  const max = daysInMonth(y,m);
  const keep = Math.min(Number(currentDay || 1), max);
  daySelect.innerHTML = "";
  for(let d = 1; d <= max; d++){
    const opt = document.createElement("option");
    opt.value = pad2(d);
    opt.textContent = `${d}日`;
    daySelect.appendChild(opt);
  }
  daySelect.value = pad2(keep);
}

function updateHiddenDate(id){
  const wrap = document.querySelector(`.scroll-date[data-target="${id}"]`);
  const input = $(id);
  if(!wrap || !input) return;
  const y = wrap.querySelector(".date-year").value;
  const m = wrap.querySelector(".date-month").value;
  const d = wrap.querySelector(".date-day").value;
  input.value = `${y}-${m}-${d}`;
}

function setScrollDateValue(id, value){
  const input = $(id);
  if(!input) return;
  input.value = value || today();
  const wrap = document.querySelector(`.scroll-date[data-target="${id}"]`);
  if(!wrap) return;
  const [y,m,d] = input.value.split("-");
  const year = wrap.querySelector(".date-year");
  const month = wrap.querySelector(".date-month");
  const day = wrap.querySelector(".date-day");
  year.value = y;
  month.value = m;
  rebuildDays(day, y, m, d);
  updateHiddenDate(id);
}



function migrateState(){
  if(!Array.isArray(state.chartImages)) state.chartImages = [];
  if(!Array.isArray(state.lineLogs)) state.lineLogs = [];
  if(!state.appSettings) state.appSettings = {};
  saveState();
}

document.addEventListener("DOMContentLoaded",init);
function init(){
  $("apiUrlInput").value=settings.apiUrl||"";$("apiKeyInput").value=settings.apiKey||"";$("setupPanel").classList.toggle("hidden",!!settings.apiUrl);
  ["saleDate","visitDate","reservationDate","receiptDate","intakeDate","firstVisit","chartImageDate"].forEach(id=>{ if($(id) && !$(id).value) $(id).value=today(); });
  setupScrollDateSelectors();
  migrateState();bindEvents();renderAll();registerSW();
}
function bindEvents(){
  document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>switchTab(b.dataset.tab)));
  $("saveSettingsBtn").addEventListener("click",()=>{settings.apiUrl=$("apiUrlInput").value.trim();settings.apiKey=$("apiKeyInput").value.trim();saveSettings();$("setupPanel").classList.add("hidden");toast("設定を保存しました")});
  $("hideSetupBtn").addEventListener("click",()=>$("setupPanel").classList.add("hidden"));
  $("backupBtn").addEventListener("click",()=>download("gene_backup.json",JSON.stringify(state,null,2),"application/json"));
  $("restoreInput").addEventListener("change",restoreBackup);$("syncBtn").addEventListener("click",syncCloud);
  $("salePatientNo").addEventListener("input",()=>$("salePatientName").value=patientName($("salePatientNo").value.trim()));
  $("saleMenu").addEventListener("change",applyMenuPrice);$("saleType").addEventListener("change",applyPaymentDefaults);
  ["saleAmount","cashReceived"].forEach(id=>$(id).addEventListener("input",calcChange));
  $("saleForm").addEventListener("submit",saveSale);$("clearSaleBtn").addEventListener("click",clearSale);
  $("patientForm").addEventListener("submit",savePatient);$("clearPatientBtn").addEventListener("click",()=>$("patientForm").reset());$("patientSearch").addEventListener("input",renderPatients);
  $("historyPatientSelect").addEventListener("change",renderHistory);$("visitNoteForm").addEventListener("submit",saveVisitNote);
  $("reservationForm").addEventListener("submit",saveReservation);$("receiptForm").addEventListener("submit",saveReceipt);$("intakeForm").addEventListener("submit",saveIntake);$("menuForm").addEventListener("submit",saveMenu);
  $("salesCsvBtn").addEventListener("click",()=>download("gene_sales.csv",toCsv(state.sales,["date","patientNo","patientName","menu","type","amount","cashReceived","changeDue","cardAmount","onlineAmount","ticketSaleAmount","ticketUsed","note"]),"text/csv"));
  $("dailyCsvBtn").addEventListener("click",()=>download("gene_daily_summary.csv",toCsv(dailyRows(),["date","total","cash","card","online","ticketSale","ticketUsed"]),"text/csv"));
  $("freeeCsvBtn").addEventListener("click",exportFreeeCsv);

  $("calPrevBtn")?.addEventListener("click",()=>{calendarCursor.setMonth(calendarCursor.getMonth()-1);renderCalendar();});
  $("calNextBtn")?.addEventListener("click",()=>{calendarCursor.setMonth(calendarCursor.getMonth()+1);renderCalendar();});
  $("chartImageForm")?.addEventListener("submit",saveChartImage);
  $("lineNotifyForm")?.addEventListener("submit",sendLineNotify);
  $("freeeAutoCsvBtn")?.addEventListener("click",exportFreeeCsv);

  window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;$("installBtn").classList.remove("hidden")});
  $("installBtn").addEventListener("click",async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$("installBtn").classList.add("hidden")});
}
function switchTab(tab){document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));document.querySelectorAll(".panel").forEach(p=>p.classList.toggle("active",p.id===tab));if(tab==="history")renderHistory()}
function refreshDatalists(){["patientNoList","patientNoList2","patientNoList3","patientNoList4"].forEach(id=>{const dl=$(id);dl.innerHTML="";state.patients.forEach(p=>{const o=document.createElement("option");o.value=p.no;o.label=p.name;dl.appendChild(o)})})}
function refreshMenuSelect(){const s=$("saleMenu");s.innerHTML="";state.menus.forEach(m=>{const o=document.createElement("option");o.value=m.name;o.textContent=`${m.name}（${yen(m.price)}）`;s.appendChild(o)})}
function applyMenuPrice(){const m=state.menus.find(x=>x.name===$("saleMenu").value);if(!m)return;$("saleAmount").value=m.price;if(m.ticketCount>0){$("saleType").value="回数券販売";$("ticketSaleAmount").value=m.price}else if(m.name.includes("回数券使用")){$("saleType").value="回数券使用";$("saleAmount").value=0;$("ticketUsed").value=1}applyPaymentDefaults()}
function applyPaymentDefaults(){const a=num($("saleAmount").value),t=$("saleType").value;if(t==="現金"){$("cardAmount").value="";$("onlineAmount").value="";$("ticketSaleAmount").value=""}if(t==="カード"){$("cardAmount").value=a;$("cashReceived").value="";$("onlineAmount").value=""}if(t==="オンライン"){$("onlineAmount").value=a;$("cashReceived").value="";$("cardAmount").value=""}if(t==="回数券販売")$("ticketSaleAmount").value=a;if(t==="回数券使用"){$("saleAmount").value=0;$("ticketUsed").value=$("ticketUsed").value||1}calcChange()}
function calcChange(){const r=num($("cashReceived").value),a=num($("saleAmount").value);$("changeDue").value=r?Math.max(r-a,0):""}
function saveSale(e){e.preventDefault();const id=$("saleId").value||uid();const no=$("salePatientNo").value.trim();const s={id,date:$("saleDate").value,patientNo:no,patientName:$("salePatientName").value||patientName(no),menu:$("saleMenu").value,type:$("saleType").value,amount:num($("saleAmount").value),cashReceived:num($("cashReceived").value),changeDue:num($("changeDue").value),cardAmount:num($("cardAmount").value),onlineAmount:num($("onlineAmount").value),ticketSaleAmount:num($("ticketSaleAmount").value),ticketUsed:num($("ticketUsed").value),note:$("saleNote").value.trim()};upsert(state.sales,s,"id");saveState();renderAll();clearSale();toast("売上を保存しました")}
function clearSale(){$("saleForm").reset();$("saleId").value="";setScrollDateValue("saleDate", today());$("ticketUsed").value=0;refreshMenuSelect();applyMenuPrice()}
window.editSale=function(id){const s=state.sales.find(x=>x.id===id);if(!s)return;Object.entries({saleId:s.id,saleDate:s.date,salePatientNo:s.patientNo,salePatientName:s.patientName,saleMenu:s.menu,saleType:s.type,saleAmount:s.amount,cashReceived:s.cashReceived,changeDue:s.changeDue,cardAmount:s.cardAmount,onlineAmount:s.onlineAmount,ticketSaleAmount:s.ticketSaleAmount,ticketUsed:s.ticketUsed,saleNote:s.note}).forEach(([k,v])=>$(k).value=v??"");switchTab("sales");scrollTo({top:0,behavior:"smooth"})}
function renderSales(){const tb=document.querySelector("#salesTable tbody");tb.innerHTML="";[...state.sales].sort((a,b)=>b.date.localeCompare(a.date)).forEach(s=>{const tr=document.createElement("tr");tr.innerHTML=`<td>${esc(s.date)}</td><td>${esc(s.patientNo)}</td><td>${esc(s.patientName)}</td><td>${esc(s.menu)}</td><td>${esc(s.type)}</td><td class="num">${yen(s.amount)}</td><td class="num">${s.cashReceived?yen(s.cashReceived):""}</td><td class="num">${s.changeDue?yen(s.changeDue):""}</td><td class="num">${s.cardAmount?yen(s.cardAmount):""}</td><td class="num">${s.onlineAmount?yen(s.onlineAmount):""}</td><td class="num">${s.ticketUsed||""}</td><td>${esc(s.note)}</td><td><button class="mini" onclick="editSale('${s.id}')">編集</button> <button class="danger" onclick="deleteItem('sales','${s.id}')">削除</button></td>`;tb.appendChild(tr)})}
function savePatient(e){e.preventDefault();const p={no:$("patientNo").value.trim(),name:$("patientName").value.trim(),kana:$("patientKana").value.trim(),phone:$("patientPhone").value.trim(),firstVisit:$("firstVisit").value,note:$("patientNote").value.trim()};if(!/^\d+$/.test(p.no)){toast("患者No.は数字のみです");return}upsert(state.patients,p,"no");saveState();renderAll();$("patientForm").reset();setScrollDateValue("firstVisit", today());toast("患者を保存しました")}
window.editPatient=function(no){const p=state.patients.find(x=>String(x.no)===String(no));if(!p)return;$("patientNo").value=p.no;$("patientName").value=p.name;$("patientKana").value=p.kana||"";$("patientPhone").value=p.phone||"";setScrollDateValue("firstVisit", p.firstVisit || today());$("patientNote").value=p.note||"";switchTab("patients");scrollTo({top:0,behavior:"smooth"})}
function renderPatients(){const q=$("patientSearch").value.trim();const tb=document.querySelector("#patientsTable tbody");tb.innerHTML="";state.patients.filter(p=>!q||String(p.no).includes(q)||p.name.includes(q)).sort((a,b)=>num(a.no)-num(b.no)).forEach(p=>{const tr=document.createElement("tr");tr.innerHTML=`<td>${esc(p.no)}</td><td>${esc(p.name)}</td><td>${esc(p.kana)}</td><td>${esc(p.phone)}</td><td>${esc(p.firstVisit)}</td><td>${esc(p.note)}</td><td><button class="mini" onclick="editPatient('${p.no}')">編集</button> <button class="mini" onclick="openHistory('${p.no}')">履歴</button> <button class="danger" onclick="deletePatient('${p.no}')">削除</button></td>`;tb.appendChild(tr)})}
window.openHistory=function(no){switchTab("history");$("historyPatientSelect").value=no;renderHistory()}
function refreshHistorySelect(){const s=$("historyPatientSelect");s.innerHTML="";state.patients.sort((a,b)=>num(a.no)-num(b.no)).forEach(p=>{const o=document.createElement("option");o.value=p.no;o.textContent=`${p.no}：${p.name}`;s.appendChild(o)})}
function saveVisitNote(e){e.preventDefault();const no=$("historyPatientSelect").value;if(!no){toast("患者を選択してください");return}const n={id:$("visitNoteId").value||uid(),patientNo:no,patientName:patientName(no),date:$("visitDate").value,chiefComplaint:$("visitChiefComplaint").value.trim(),treatmentNote:$("visitTreatmentNote").value.trim(),nextNote:$("visitNextNote").value.trim()};upsert(state.visitNotes,n,"id");saveState();renderAll();$("visitNoteForm").reset();setScrollDateValue("visitDate", today());toast("通院記録を保存しました")}
function renderHistory(){const no=$("historyPatientSelect").value;if(!no){$("historySummary").textContent="患者を登録してください。";return}const p=state.patients.find(x=>String(x.no)===String(no));const sales=state.sales.filter(s=>String(s.patientNo)===String(no));const notes=state.visitNotes.filter(n=>String(n.patientNo)===String(no));const intakes=state.intakes.filter(i=>String(i.patientNo)===String(no));const total=sales.reduce((a,s)=>a+num(s.amount),0);const visits=[...new Set([...sales.map(s=>s.date),...notes.map(n=>n.date),...intakes.map(i=>i.date)])].length;$("historySummary").textContent=`患者No：${no}\\n氏名：${p?.name||""}\\n来院・記録日数：${visits}回\\n売上合計：${yen(total)}\\n最終記録：${latestDate([...sales,...notes,...intakes])||"-"}`;const rows=[...sales.map(s=>({id:s.id,date:s.date,type:"売上",content:s.menu,amount:s.amount,note:s.note,src:"sales"})),...notes.map(n=>({id:n.id,date:n.date,type:"施術記録",content:n.chiefComplaint,amount:"",note:`${n.treatmentNote} ${n.nextNote}`,src:"visitNotes"})),...intakes.map(i=>({id:i.id,date:i.date,type:"問診",content:i.category,amount:"",note:i.text,src:"intakes"}))].sort((a,b)=>b.date.localeCompare(a.date));const tb=document.querySelector("#historyTable tbody");tb.innerHTML="";rows.forEach(r=>{const tr=document.createElement("tr");tr.innerHTML=`<td>${esc(r.date)}</td><td>${esc(r.type)}</td><td>${esc(r.content)}</td><td class="num">${r.amount!==""?yen(r.amount):""}</td><td>${esc(r.note)}</td><td><button class="danger" onclick="deleteItem('${r.src}','${r.id}')">削除</button></td>`;tb.appendChild(tr)})}
function latestDate(rows){return rows.map(r=>r.date).filter(Boolean).sort().pop()}
function ticketRows(){const map=new Map();state.sales.forEach(s=>{if(!s.patientNo)return;const r=map.get(s.patientNo)||{patientNo:s.patientNo,patientName:s.patientName||patientName(s.patientNo),purchased:0,used:0,amount:0};const m=state.menus.find(x=>x.name===s.menu);if(s.type==="回数券販売"||s.ticketSaleAmount>0){r.purchased+=num(m?.ticketCount);r.amount+=num(s.ticketSaleAmount||s.amount)}r.used+=num(s.ticketUsed);map.set(s.patientNo,r)});return[...map.values()].map(r=>({...r,remain:r.purchased-r.used}))}
function renderTickets(){const tb=document.querySelector("#ticketsTable tbody");tb.innerHTML="";ticketRows().sort((a,b)=>num(a.patientNo)-num(b.patientNo)).forEach(r=>{const tr=document.createElement("tr");tr.innerHTML=`<td>${esc(r.patientNo)}</td><td>${esc(r.patientName)}</td><td class="num">${r.purchased}</td><td class="num">${r.used}</td><td class="num">${r.remain}</td><td class="num">${yen(r.amount)}</td>`;tb.appendChild(tr)})}
function saveReservation(e){e.preventDefault();const no=$("reservationPatientNo").value.trim();const r={id:uid(),date:$("reservationDate").value,time:$("reservationTime").value,patientNo:no,patientName:patientName(no),type:$("reservationType").value,note:$("reservationNote").value.trim()};state.reservations.push(r);saveState();renderAll();$("reservationForm").reset();setScrollDateValue("reservationDate", today());toast("予約メモを保存しました")}
function renderReservations(){const tb=document.querySelector("#reservationsTable tbody");tb.innerHTML="";state.reservations.sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time)).forEach(r=>{const tr=document.createElement("tr");tr.innerHTML=`<td>${esc(r.date)}</td><td>${esc(r.time)}</td><td>${esc(r.patientNo)}</td><td>${esc(r.patientName)}</td><td>${esc(r.type)}</td><td>${esc(r.note)}</td><td><button class="danger" onclick="deleteItem('reservations','${r.id}')">削除</button></td>`;tb.appendChild(tr)})}
function saveReceipt(e){e.preventDefault();const f=$("receiptImage").files[0];const finish=(img="")=>{state.receipts.push({id:uid(),date:$("receiptDate").value,category:$("receiptCategory").value.trim(),amount:num($("receiptAmount").value),imageData:img,note:$("receiptNote").value.trim()});saveState();renderAll();$("receiptForm").reset();setScrollDateValue("receiptDate", today());toast("レシートを保存しました")};if(f){const r=new FileReader();r.onload=()=>finish(r.result);r.readAsDataURL(f)}else finish("")}
function renderReceipts(){const box=$("receiptGallery");box.innerHTML="";state.receipts.sort((a,b)=>b.date.localeCompare(a.date)).forEach(r=>{const d=document.createElement("div");d.className="card receipt-card";d.innerHTML=`${r.imageData?`<img src="${r.imageData}" alt="">`:""}<h3>${esc(r.category||"レシート")}</h3><p class="muted">${esc(r.date)} / ${yen(r.amount)}</p><p>${esc(r.note)}</p><button class="danger" onclick="deleteItem('receipts','${r.id}')">削除</button>`;box.appendChild(d)})}
function saveIntake(e){e.preventDefault();const no=$("intakePatientNo").value.trim();state.intakes.push({id:uid(),date:$("intakeDate").value,patientNo:no,patientName:patientName(no),category:$("intakeCategory").value,score:num($("intakeScore").value),text:$("intakeText").value.trim()});saveState();renderAll();$("intakeForm").reset();setScrollDateValue("intakeDate", today());toast("問診メモを保存しました")}
function renderIntakes(){const tb=document.querySelector("#intakeTable tbody");tb.innerHTML="";state.intakes.sort((a,b)=>b.date.localeCompare(a.date)).forEach(i=>{const tr=document.createElement("tr");tr.innerHTML=`<td>${esc(i.date)}</td><td>${esc(i.patientNo)}</td><td>${esc(i.patientName)}</td><td>${esc(i.category)}</td><td class="num">${i.score||""}</td><td>${esc(i.text)}</td><td><button class="danger" onclick="deleteItem('intakes','${i.id}')">削除</button></td>`;tb.appendChild(tr)})}
function saveMenu(e){e.preventDefault();const m={name:$("menuName").value.trim(),price:num($("menuPrice").value),ticketCount:num($("menuTicketCount").value)};upsert(state.menus,m,"name");saveState();renderAll();$("menuForm").reset();toast("メニューを保存しました")}
window.editMenu=function(name){const m=state.menus.find(x=>x.name===name);if(!m)return;$("menuName").value=m.name;$("menuPrice").value=m.price;$("menuTicketCount").value=m.ticketCount||0;switchTab("masters")}
function renderMenus(){const tb=document.querySelector("#menusTable tbody");tb.innerHTML="";state.menus.forEach(m=>{const tr=document.createElement("tr");tr.innerHTML=`<td>${esc(m.name)}</td><td class="num">${yen(m.price)}</td><td class="num">${m.ticketCount||0}</td><td><button class="mini" onclick="editMenu('${ea(m.name)}')">編集</button> <button class="danger" onclick="deleteMenu('${ea(m.name)}')">削除</button></td>`;tb.appendChild(tr)})}
function dailyRows(){const map=new Map();state.sales.forEach(s=>{const r=map.get(s.date)||{date:s.date,total:0,cash:0,card:0,online:0,ticketSale:0,ticketUsed:0};r.total+=num(s.amount);if(s.type==="現金"||s.cashReceived)r.cash+=num(s.amount);r.card+=num(s.cardAmount);r.online+=num(s.onlineAmount);r.ticketSale+=num(s.ticketSaleAmount);r.ticketUsed+=num(s.ticketUsed);map.set(s.date,r)});return[...map.values()].sort((a,b)=>b.date.localeCompare(a.date))}
function renderSummary(){const total=state.sales.reduce((a,s)=>a+num(s.amount),0),cash=state.sales.reduce((a,s)=>a+((s.type==="現金"||s.cashReceived)?num(s.amount):0),0),card=state.sales.reduce((a,s)=>a+num(s.cardAmount),0),online=state.sales.reduce((a,s)=>a+num(s.onlineAmount),0);$("sumTotal").textContent=yen(total);$("sumCash").textContent=yen(cash);$("sumCard").textContent=yen(card);$("sumOnline").textContent=yen(online);$("todaySales").textContent=yen(state.sales.filter(s=>s.date===today()).reduce((a,s)=>a+num(s.amount),0));const ym=today().slice(0,7);$("monthSales").textContent=yen(state.sales.filter(s=>s.date.startsWith(ym)).reduce((a,s)=>a+num(s.amount),0));$("patientCount").textContent=state.patients.length;$("ticketActiveCount").textContent=ticketRows().filter(r=>r.remain>0).length;const tb=document.querySelector("#dailyTable tbody");tb.innerHTML="";dailyRows().forEach(r=>{const tr=document.createElement("tr");tr.innerHTML=`<td>${r.date}</td><td class="num">${yen(r.total)}</td><td class="num">${yen(r.cash)}</td><td class="num">${yen(r.card)}</td><td class="num">${yen(r.online)}</td><td class="num">${yen(r.ticketSale)}</td><td class="num">${r.ticketUsed}</td>`;tb.appendChild(tr)})}
function renderDashboard(){const res=state.reservations.filter(r=>r.date===today()).sort((a,b)=>a.time.localeCompare(b.time));$("todayReservations").innerHTML=res.length?res.map(r=>`<div class="list-item"><strong>${esc(r.time||"--:--")} ${esc(r.patientName||r.patientNo)}</strong><span>${esc(r.type)} / ${esc(r.note)}</span></div>`).join(""):`<p class="muted">本日の予約メモはありません。</p>`;const rows=[...state.sales.map(s=>({date:s.date,title:`${s.patientName||s.patientNo} / ${s.menu}`,sub:yen(s.amount)})),...state.visitNotes.map(n=>({date:n.date,title:`${n.patientName||n.patientNo} / ${n.chiefComplaint}`,sub:n.treatmentNote}))].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8);$("recentVisits").innerHTML=rows.length?rows.map(r=>`<div class="list-item"><strong>${esc(r.date)} ${esc(r.title)}</strong><span>${esc(r.sub)}</span></div>`).join(""):`<p class="muted">履歴はまだありません。</p>`}
function exportFreeeCsv(){const rows=state.sales.map(s=>({date:s.date,account:"売上高",tax:"対象外または課税売上10%",amount:s.amount,wallet:s.type,partner:s.patientName,item:s.menu,tag:"gene",note:s.note}));download("gene_freee_import.csv",toCsv(rows,["date","account","tax","amount","wallet","partner","item","tag","note"]),"text/csv")}
window.deleteItem=function(c,id){if(!confirm("削除しますか？"))return;state[c]=state[c].filter(x=>x.id!==id);saveState();renderAll()}
window.deletePatient=function(no){if(!confirm("患者を削除しますか？売上履歴は残ります。"))return;state.patients=state.patients.filter(p=>String(p.no)!==String(no));saveState();renderAll()}
window.deleteMenu=function(name){if(!confirm("メニューを削除しますか？"))return;state.menus=state.menus.filter(m=>m.name!==name);saveState();renderAll()}

let calendarCursor = new Date();

function renderCalendar(){
  const grid = $("calendarGrid");
  const title = $("calendarTitle");
  if(!grid || !title) return;

  const y = calendarCursor.getFullYear();
  const m = calendarCursor.getMonth();
  title.textContent = `${y}年 ${m+1}月`;
  grid.innerHTML = "";

  ["日","月","火","水","木","金","土"].forEach(w=>{
    const h = document.createElement("div");
    h.className = "calendar-week";
    h.textContent = w;
    grid.appendChild(h);
  });

  const first = new Date(y,m,1);
  const start = first.getDay();
  const max = new Date(y,m+1,0).getDate();

  for(let i=0;i<start;i++){
    const empty = document.createElement("div");
    empty.className = "calendar-cell empty";
    grid.appendChild(empty);
  }

  for(let d=1; d<=max; d++){
    const date = `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const cell = document.createElement("div");
    cell.className = "calendar-cell";
    const dayReservations = state.reservations.filter(r=>r.date===date).sort((a,b)=>(a.time||"").localeCompare(b.time||""));
    cell.innerHTML = `<strong>${d}</strong>` + dayReservations.map(r=>`<div class="calendar-item">${esc(r.time||"")} ${esc(r.patientName||r.patientNo||"")}<br>${esc(r.note||r.type)}</div>`).join("");
    grid.appendChild(cell);
  }
}

function monthlyRows(){
  const map = new Map();
  state.sales.forEach(s=>{
    if(!s.date) return;
    const ym = s.date.slice(0,7);
    const row = map.get(ym) || {month:ym, sales:0, visits:0};
    row.sales += num(s.amount);
    row.visits += 1;
    map.set(ym,row);
  });
  return [...map.values()].sort((a,b)=>a.month.localeCompare(b.month)).slice(-12);
}

function drawBarChart(canvasId, labels, values, formatter){
  const canvas = $(canvasId);
  if(!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle = "#101010";
  ctx.fillRect(0,0,w,h);
  ctx.strokeStyle = "rgba(217,193,126,.35)";
  ctx.strokeRect(0,0,w,h);

  const max = Math.max(...values, 1);
  const pad = 46;
  const barW = (w - pad*2) / Math.max(values.length,1) * .62;
  const gap = (w - pad*2) / Math.max(values.length,1);

  ctx.fillStyle = "#d9c17e";
  ctx.font = "16px Yu Gothic";
  values.forEach((v,i)=>{
    const x = pad + i*gap + (gap-barW)/2;
    const bh = (h-pad*2) * (v/max);
    const y = h-pad-bh;
    ctx.fillRect(x,y,barW,bh);
    ctx.fillStyle = "#f7f0dc";
    ctx.textAlign = "center";
    ctx.fillText(labels[i].slice(5), x+barW/2, h-16);
    ctx.fillText(formatter(v), x+barW/2, Math.max(20,y-8));
    ctx.fillStyle = "#d9c17e";
  });
}

function renderCharts(){
  const rows = monthlyRows();
  drawBarChart("monthlySalesCanvas", rows.map(r=>r.month), rows.map(r=>r.sales), yen);
  drawBarChart("monthlyVisitsCanvas", rows.map(r=>r.month), rows.map(r=>r.visits), v=>`${v}回`);
}

function saveChartImage(e){
  e.preventDefault();
  const file = $("chartImageFile").files[0];
  if(!file){ toast("画像を選択してください"); return; }
  const reader = new FileReader();
  reader.onload = () => {
    const no = $("chartImagePatientNo").value.trim();
    state.chartImages.push({
      id: uid(),
      date: $("chartImageDate").value,
      patientNo: no,
      patientName: patientName(no),
      category: $("chartImageCategory").value.trim(),
      imageData: reader.result,
      note: $("chartImageNote").value.trim()
    });
    saveState();
    renderAll();
    $("chartImageForm").reset();
    setScrollDateValue("chartImageDate", today());
    toast("カルテ画像を保存しました");
  };
  reader.readAsDataURL(file);
}

function renderChartImages(){
  const box = $("chartImageGallery");
  if(!box) return;
  box.innerHTML = "";
  state.chartImages.slice().sort((a,b)=>b.date.localeCompare(a.date)).forEach(img=>{
    const div = document.createElement("div");
    div.className = "card receipt-card";
    div.innerHTML = `<img src="${img.imageData}" alt=""><h3>${esc(img.patientName||img.patientNo||"未指定")}</h3><p class="muted">${esc(img.date)} / ${esc(img.category)}</p><p>${esc(img.note)}</p><button class="danger" onclick="deleteItem('chartImages','${img.id}')">削除</button>`;
    box.appendChild(div);
  });
}

async function sendLineNotify(e){
  e.preventDefault();
  if(!settings.apiUrl){ $("setupPanel").classList.remove("hidden"); toast("同期URLを設定してください"); return; }
  const payload = {
    action:"linePush",
    apiKey:settings.apiKey,
    title:$("lineTitle").value.trim() || "gene通知",
    message:$("lineMessage").value.trim()
  };
  if(!payload.message){ toast("通知本文を入力してください"); return; }
  try{
    const res = await fetch(settings.apiUrl,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(payload)});
    const data = await res.json();
    if(!data.ok) throw new Error(data.error || "line error");
    state.lineLogs.push({id:uid(),date:new Date().toISOString(),title:payload.title,message:payload.message});
    saveState();
    renderAll();
    $("lineNotifyForm").reset();
    toast("LINE通知を送信しました");
  }catch(err){
    console.error(err);
    toast("LINE通知に失敗しました");
  }
}


function renderAll(){refreshDatalists();refreshMenuSelect();refreshHistorySelect();renderSales();renderPatients();renderHistory();renderTickets();renderReservations();renderReceipts();renderIntakes();renderMenus();renderSummary();renderDashboard();renderCalendar();renderCharts();renderChartImages()}
function hasUserData(s){
  if(!s) return false;
  return ["patients","sales","visitNotes","reservations","receipts","intakes","chartImages","lineLogs"].some(k => Array.isArray(s[k]) && s[k].length > 0);
}

async function syncCloud(){
  if(!settings.apiUrl){
    $("setupPanel").classList.remove("hidden");
    toast("同期URLを設定してください");
    return;
  }

  const localBeforeSync = JSON.parse(JSON.stringify(state));
  $("syncStatus").textContent = "同期中";

  try{
    const loadRes = await fetch(settings.apiUrl,{
      method:"POST",
      headers:{"Content-Type":"text/plain;charset=utf-8"},
      body:JSON.stringify({action:"load",apiKey:settings.apiKey})
    });

    const loaded = await loadRes.json();
    if(!loaded.ok) throw new Error(loaded.error || "load error");

    const cloudState = loaded.state;
    const localHasData = hasUserData(localBeforeSync);
    const cloudHasData = hasUserData(cloudState);

    let nextState;

    if(localHasData && !cloudHasData){
      nextState = localBeforeSync;
    }else if(!localHasData && cloudHasData){
      nextState = cloudState;
    }else if(localHasData && cloudHasData){
      const localTime = new Date(localBeforeSync.updatedAt || 0).getTime();
      const cloudTime = new Date(cloudState.updatedAt || 0).getTime();
      nextState = cloudTime > localTime ? cloudState : localBeforeSync;
    }else{
      nextState = localBeforeSync;
    }

    nextState.updatedAt = new Date().toISOString();

    const saveRes = await fetch(settings.apiUrl,{
      method:"POST",
      headers:{"Content-Type":"text/plain;charset=utf-8"},
      body:JSON.stringify({action:"save",apiKey:settings.apiKey,state:nextState})
    });

    const saved = await saveRes.json();
    if(!saved.ok) throw new Error(saved.error || "save error");

    state = nextState;
    saveState();
    renderAll();

    $("syncStatus").textContent = "同期済";
    toast("同期しました");
  }catch(e){
    console.error(e);
    state = localBeforeSync;
    saveState();
    renderAll();
    $("syncStatus").textContent = "同期失敗";
    toast("同期に失敗しました");
  }
}

function restoreBackup(e){const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const data=JSON.parse(r.result);if(!data.patients||!data.sales)throw new Error("invalid");state=data;saveState();renderAll();toast("復元しました")}catch{toast("復元できませんでした")}};r.readAsText(f)}
function registerSW(){if("serviceWorker"in navigator)navigator.serviceWorker.register("service-worker.js").catch(console.error)}
