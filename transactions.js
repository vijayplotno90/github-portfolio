
(function(){
  // Demo-grade filters UX (P1 #9):
  // - Filters panel defaults OPEN on load (ignores prior collapse state)
  // - Collapsed rail shows Filters toggle + Reset + applied filter count
  // - Reset clears all filters back to initial defaults and re-renders

  function baseFilters(){
    const gf = APP.getGlobalFilters();
    const p = APP.params();
    // Compact, checkbox-driven filters aligned to the user's earlier prototype.
    // Empty arrays = "All".
    const f = {
      product: gf.product,
      from: gf.from,
      to: gf.to,
      clientId: p.clientId || "",
      clientName: p.clientName || "",

      enquiryTypes: [],
      productBics: [],
      coinBranches: [],
      currencies: [],
      accountTypes: [],
      transactionSources: [],
      sourceSystems: [],
      transactionStatuses: [],
      subProducts: [],

      transactionTypes: [],

      exceptionTypes: [],
      slaStates: [],
      reasonCodes: [],

      accountNumber: "",
      uniqueActivityId: "",
      uniqueReferenceNumber: "",
      search: ""
    };

    // support deep links (legacy)
    if (p.status) f.transactionStatuses = [p.status];
    if (p.ex) f.exceptionTypes = [p.ex];
    if (p.reason) f.reasonCodes = [p.reason];
    if (p.sla) f.slaStates = [p.sla];
    return f;
  }

  // Defaults captured on first load (used for applied-count + reset)
  let DEFAULT = null; // { global: {product, from, to, search}, local: <filters model> }

  function makeDefaultLocalFilters(globalFilters){
    const gf = globalFilters || APP.getGlobalFilters();
    return {
      product: gf.product,
      from: gf.from,
      to: gf.to,
      clientId: "",
      clientName: "",

      enquiryTypes: [],
      productBics: [],
      coinBranches: [],
      currencies: [],
      accountTypes: [],
      transactionSources: [],
      sourceSystems: [],
      transactionStatuses: [],
      subProducts: [],

      transactionTypes: [],

      exceptionTypes: [],
      slaStates: [],
      reasonCodes: [],

      accountNumber: "",
      uniqueActivityId: "",
      uniqueReferenceNumber: "",
      search: ""
    };
  }

  let filters = baseFilters();

  function debounce(fn, ms){
    let t = null;
    return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), ms||150); };
  }

  const debouncedRender = debounce(()=>render(), 120);

  function unique(arr){
    return Array.from(new Set((arr||[]).map(String)));
  }

  function normArr(a){
    return unique(a||[]).map(String).sort();
  }

  function arrEquals(a,b){
    const aa = normArr(a);
    const bb = normArr(b);
    if (aa.length!==bb.length) return false;
    for (let i=0;i<aa.length;i++) if (aa[i]!==bb[i]) return false;
    return true;
  }

  // Count how many filter categories are applied vs defaults.
  // IMPORTANT: multi-select "All" is represented by an empty array.
  function getAppliedFilterCount(f){
    if (!DEFAULT) return 0;
    const defG = DEFAULT.global;
    const defL = DEFAULT.local;
    let n = 0;
    const nonEmpty = (v)=> String(v||"").trim()!=="";
    const arrApplied = (a, def)=> Array.isArray(a) && (a.length>0) && !arrEquals(a, def||[]);

    // Text filters
    if (nonEmpty(f.search)) n++;
    if (nonEmpty(f.clientName)) n++;
    if (nonEmpty(f.clientId)) n++;
    if (nonEmpty(f.accountNumber)) n++;
    if (nonEmpty(f.uniqueActivityId)) n++;
    if (nonEmpty(f.uniqueReferenceNumber)) n++;

    // Global single-selects & dates
    if (String(f.product||"") !== String(defG.product||"")) n++;
    if (String(f.from||"") !== String(defG.from||"")) n++;
    if (String(f.to||"") !== String(defG.to||"")) n++;

    // Multi-select categories
    if (arrApplied(f.transactionStatuses, defL.transactionStatuses)) n++;
    if (arrApplied(f.exceptionTypes, defL.exceptionTypes)) n++;
    if (arrApplied(f.currencies, defL.currencies)) n++;
    if (arrApplied(f.slaStates, defL.slaStates)) n++;
    if (arrApplied(f.reasonCodes, defL.reasonCodes)) n++;
    if (arrApplied(f.enquiryTypes, defL.enquiryTypes)) n++;
    if (arrApplied(f.productBics, defL.productBics)) n++;
    if (arrApplied(f.coinBranches, defL.coinBranches)) n++;
    if (arrApplied(f.accountTypes, defL.accountTypes)) n++;
    if (arrApplied(f.transactionSources, defL.transactionSources)) n++;
    if (arrApplied(f.sourceSystems, defL.sourceSystems)) n++;
    if (arrApplied(f.subProducts, defL.subProducts)) n++;
    if (arrApplied(f.transactionTypes, defL.transactionTypes)) n++;

    return n;
  }

  function updateAppliedCountUI(f){
    const n = getAppliedFilterCount(f);
    const chip = UI.qs("#txnAppliedCount");
    if (chip) chip.textContent = String(n);
  }



let _typeKey = null;
function getTxnTypeOptions(){
  const st = BP.ensureState();
  const prod = (APP.getGlobalFilters().product || "Combined");
  const by = st.config.transactionTypesByProduct || {};
  const union = unique(Object.values(by).flat().length ? Object.values(by).flat() : (st.config.transactionTypes || []));
  if (prod && prod !== "Combined" && Array.isArray(by[prod]) && by[prod].length){
    return {key: prod, options: by[prod]};
  }
  return {key: "ALL", options: union};
}

function remountMultiSelect(selector, options, key){
  const old = UI.qs(selector);
  if (!old) return;
  const parent = old.parentNode;
  const repl = old.cloneNode(false);
  repl.id = old.id;
  repl.className = old.className;
  Array.from(old.attributes||[]).forEach(a=>{ if (a && a.name) repl.setAttribute(a.name, a.value); });
  parent.replaceChild(repl, old);
  UI.mountMultiSelect(repl, options, (sel)=>{ filters[key] = sel; debouncedRender(); });

  // keep selection if still valid
  if (Array.isArray(filters[key]) && filters[key].length){
    const set = new Set((options||[]).map(String));
    const keep = filters[key].filter(v=>set.has(String(v)));
    filters[key] = keep;
    UI.msSetValues(repl, keep);
    const box = repl.querySelector('input[type=checkbox]');
    if (box) box.dispatchEvent(new Event('change', {bubbles:true}));
  }
}

function ensureTxnTypeFilterMounted(){
  const t = getTxnTypeOptions();
  if (t.key !== _typeKey){
    _typeKey = t.key;
    remountMultiSelect('#msTxnType', t.options, 'transactionTypes');
  }
}
  function populateFilters(){
    const st = BP.ensureState();

    // Helper: mount multi-select and wire it to filters
    function ms(id, options, key){
      const el = UI.qs(id);
      UI.mountMultiSelect(el, options, (sel)=>{ filters[key] = sel; debouncedRender(); });
      // seed initial values if any
      if (filters[key] && filters[key].length){
        UI.msSetValues(el, filters[key]);
        const box = el.querySelector('input[type=checkbox]');
        if (box) box.dispatchEvent(new Event('change', {bubbles:true}));
      }
    }

    ms("#msEnquiry", st.config.enquiryTypes, "enquiryTypes");

    const allBics = unique(Object.values(st.config.productBics||{}).flat());
    ms("#msBic", allBics, "productBics");

    ms("#msCoinBranch", st.config.coinBranches, "coinBranches");
    ms("#msCurrency", st.config.currencies, "currencies");
    ms("#msAcctType", st.config.accountTypes, "accountTypes");
    ms("#msTxnSource", st.config.transactionSources, "transactionSources");
    ms("#msSourceSystem", st.config.sourceSystems, "sourceSystems");
    ms("#msTxnStatus", st.config.transactionStatuses, "transactionStatuses");
    ms("#msSubProduct", st.config.subProducts, "subProducts");

    ensureTxnTypeFilterMounted();

    ms("#msExType", ["None","Reject","Return"], "exceptionTypes");
    ms("#msSLA", ["Normal","Risk","Breach"], "slaStates");
    const codes = unique(st.config.reasonCodes.reject.concat(st.config.reasonCodes.ret).map(x=>x.code));
    ms("#msReason", codes, "reasonCodes");
  }

  function readUI(){
    filters.clientId = UI.qs("#fClientId").value.trim();
    filters.clientName = UI.qs("#fClientName").value.trim();

    // Multi-selects
    const ms = (id)=> UI.msGetValues(UI.qs(id));
    filters.enquiryTypes = ms("#msEnquiry");
    filters.productBics = ms("#msBic");
    filters.coinBranches = ms("#msCoinBranch");
    filters.currencies = ms("#msCurrency");
    filters.accountTypes = ms("#msAcctType");
    filters.transactionSources = ms("#msTxnSource");
    filters.sourceSystems = ms("#msSourceSystem");
    filters.transactionStatuses = ms("#msTxnStatus");
    filters.subProducts = ms("#msSubProduct");
    filters.transactionTypes = ms("#msTxnType");
    filters.exceptionTypes = ms("#msExType");
    filters.slaStates = ms("#msSLA");
    filters.reasonCodes = ms("#msReason");

    // Text filters
    filters.accountNumber = UI.qs("#fAccount").value.trim();
    filters.uniqueActivityId = UI.qs("#fUA").value.trim();
    filters.uniqueReferenceNumber = UI.qs("#fUR").value.trim();
    filters.search = UI.qs("#fSearch").value.trim();

    filters.product = APP.getGlobalFilters().product;
    filters.from = APP.getGlobalFilters().from;
    filters.to = APP.getGlobalFilters().to;
  }

  function writeUI(){
    UI.qs("#fClientId").value = filters.clientId || "";
    UI.qs("#fClientName").value = filters.clientName || "";
    UI.qs("#fAccount").value = filters.accountNumber || "";
    UI.qs("#fUA").value = filters.uniqueActivityId || "";
    UI.qs("#fUR").value = filters.uniqueReferenceNumber || "";
    UI.qs("#fSearch").value = filters.search || "";

    const sync = (id, values)=>{
      const el = UI.qs(id);
      if (!el) return;
      UI.msSetValues(el, values || []);
      const box = el.querySelector('input[type=checkbox]');
      if (box) box.dispatchEvent(new Event('change', {bubbles:true}));
    };

    sync("#msEnquiry", filters.enquiryTypes);
    sync("#msBic", filters.productBics);
    sync("#msCoinBranch", filters.coinBranches);
    sync("#msCurrency", filters.currencies);
    sync("#msAcctType", filters.accountTypes);
    sync("#msTxnSource", filters.transactionSources);
    sync("#msSourceSystem", filters.sourceSystems);
    sync("#msTxnStatus", filters.transactionStatuses);
    sync("#msSubProduct", filters.subProducts);
    sync("#msTxnType", filters.transactionTypes);
    sync("#msExType", filters.exceptionTypes);
    sync("#msSLA", filters.slaStates);
    sync("#msReason", filters.reasonCodes);
  }

  

  function reasonTitle(code){
    if (!code) return "";
    const st = BP.ensureState();
    const all = (st.config.reasonCodes.reject||[]).concat(st.config.reasonCodes.ret||[]);
    const hit = all.find(x=>String(x.code)===String(code));
    return hit ? hit.title : "";
  }

  
// Business semantics (Ops): From/To are always Client -> Client.
// For this prototype, client entities must be anonymized (Client1 / Client2 only).
function _anonClientLabel(raw, fallback){
  const s = String(raw||"").trim();
  if (s === "Client1" || s === "Client2") return s;
  const f = String(fallback||"").trim();
  if (f === "Client1" || f === "Client2") return f;
  return "Client1";
}
function _fallbackByTxnId(t, which){
  // Deterministic fallback: same txn always maps the same direction.
  const id = String((t && (t.id||t.transactionId)) || "");
  let h = 0;
  for (let i=0;i<id.length;i++){ h = (h*31 + id.charCodeAt(i)) >>> 0; }
  const payer = (h % 2 === 0) ? "Client1" : "Client2";
  const payee = (payer === "Client1") ? "Client2" : "Client1";
  return which === "to" ? payee : payer;
}
function partyFrom(t){
  return _anonClientLabel(t.payerClientName || t.payer, _fallbackByTxnId(t, "from"));
}
function partyTo(t){
  return _anonClientLabel(t.payeeClientName || t.payee, _fallbackByTxnId(t, "to"));
}

  function stageDotsHTML(t){
    const st = BP.ensureState();
    const stages = st.config.stages[t.product] || st.config.stages.default;
    const idx = Math.max(0, stages.indexOf(t.currentStage));
    return stages.map((s,i)=>{
      const done = (t.status==="Completed") ? true : (i < idx);
      const cur = (t.status!=="Completed") && (i===idx);
      const cls = cur ? "cur" : (done ? "done" : "");
      return `<span class="stage-dot ${cls}" title="${UI.escapeHtml(s)}"></span>`;
    }).join("");
  }

  function reasonOrLocation(t){
    if (t.status==="Pending") return `Pending at ${UI.escapeHtml(t.currentStage)}`;
    if (t.status==="Rejected" || t.status==="Returned"){
      const title = reasonTitle(t.reasonCode);
      const code = t.reasonCode ? String(t.reasonCode) : "";
      if (title && code) return `${UI.escapeHtml(title)} <span class="mini">(${UI.escapeHtml(code)})</span>`;
      if (code) return UI.escapeHtml(code);
      return "—";
    }
    return "—";
  }
function riskFlagsText(r){
    const flags = [];
    if (r.highValue) flags.push("High");
    if (r.repeatOffender) flags.push("Repeat");
    if (r.complianceHold) flags.push("Compliance");
    if (r.duplicateSuspicion) flags.push("Dup");
    return flags.length ? flags.join(", ") : "—";
  }

  function render(){
    ensureTxnTypeFilterMounted();
    readUI();

    // Update applied filter count on every render (load, change, reset)
    updateAppliedCountUI(filters);

    let txns = BP.applyTxnFilters(BP.getTransactions(), filters);

    // special high-value param
    const p = APP.params();
    if (p.high==="1"){
      txns = txns.filter(t=>t.riskFlags && t.riskFlags.highValue);
    }

    // sort: SLA due soonest, then value desc, then age desc
    txns.sort((a,b)=>{
      const da = new Date(a.slaDueAt).getTime();
      const db = new Date(b.slaDueAt).getTime();
      if (da!==db) return da-db;
      if (b.amount!==a.amount) return b.amount-a.amount;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    const body = UI.qs("#txnBody");
    body.innerHTML = txns.slice(0,250).map(t=>{
      const statusCell = `
        <div class="status-stack">
          ${UI.badgeForStatus(t.status)}
          <div class="stagebar" aria-label="Stage progress">${stageDotsHTML(t)}</div>
        </div>
      `;
      return `
        <tr data-open="${UI.escapeHtml(t.id)}">
          <td class="mono">${UI.escapeHtml(t.id)}</td>
          <td>${UI.escapeHtml(t.transactionType||"—")}</td>
          <td>${UI.escapeHtml(partyFrom(t))}</td>
          <td>${UI.escapeHtml(partyTo(t))}</td>
          <td class="right">${UI.fmtNum(t.amount,0)}</td>
          <td>${UI.escapeHtml(UI.fmtDT(t.createdAt))}</td>
          <td>${statusCell}</td>
          <td>${reasonOrLocation(t)}</td>
        </tr>
      `;
    }).join("") || `<tr><td colspan="8" class="mini">No results.</td></tr>`;

    UI.qs("#txnMeta").textContent = `Showing ${Math.min(250, txns.length)} of ${txns.length} • Tip: click a row for timeline + payload + actions.`;

    UI.qsa("#txnBody tr[data-open]").forEach(tr=>{
      tr.addEventListener("click", ()=> openTxn(tr.getAttribute("data-open")));
    });

    // open from query param
    const openId = APP.params().open;
    if (openId && !render._opened){
      render._opened = true;
      openTxn(openId);
    }
  }

  function stageTimeline(txn){
    const st = BP.ensureState();
    const stages = st.config.stages[txn.product] || st.config.stages.default;
    const idx = stages.indexOf(txn.currentStage);
    const created = new Date(txn.createdAt).getTime();
    const stepMs = (txn.slaMinutes*60000)/Math.max(1, stages.length-1);
    return stages.map((s,i)=>{
      const done = i<idx || (txn.status==="Completed");
      const cur = i===idx && txn.status!=="Completed";
      const ts = new Date(created + i*stepMs).toISOString();
      const prevTs = new Date(created + Math.max(0,i-1)*stepMs).toISOString();
      const durMin = i===0 ? 0 : Math.round((new Date(ts).getTime() - new Date(prevTs).getTime())/60000);
      return {s, done, cur, ts, durMin};
    });
  }

  // Deterministic legs generator (same txn → same legs)
  function hash32(str){
    let h = 2166136261;
    for (let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h>>>0);
  }
  function mulberry32(seed){
    let a = seed>>>0;
    return function(){
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pick(arr, rnd){
    if (!arr || !arr.length) return "—";
    return arr[Math.floor(rnd()*arr.length)];
  }
  function numStr(len, rnd){
    let s = "";
    for (let i=0;i<len;i++) s += String(Math.floor(rnd()*10));
    return s;
  }
  function isoDayPlus(iso, days){
    const d = new Date(iso);
    d.setDate(d.getDate() + (days||0));
    return d.toISOString();
  }
  function asMoney(n){
    const x = Number(n||0);
    return Math.round(x*100)/100;
  }

  const LEG_COLS = [
    "Leg ID",
    "Sequence",
    "Agreement Structure ID",
    "Debit/Credit",
    "Account Number",
    "Alternate Account Number",
    "Account Type",
    "Account Domain",
    "Destination System",
    "Message Type",
    "Trancode",
    "Branch",
    "Branch Short Name",
    "Reporting Unit",
    "Currency",
    "Amount",
    "Revised Booking Date",
    "Value Date",
    "Exposure Date",
    "Posted By (Posting Stage)",
    "Narrative",
    "Overridden Narrative",
    "Priority Posting"
  ];

  function getTxnLegs(txn){
    if (Array.isArray(txn.legs) && txn.legs.length===8) return txn.legs;
    // Generate deterministic legs based on txn id + amount + currency
    const st = BP.ensureState();
    const seed = hash32(`${txn.id}|${txn.amount}|${txn.currency}`);
    const rnd = mulberry32(seed);

    const n = 8; // fixed 8 legs (Ops expectation)
    const stages = (st.config.stages[txn.product] || st.config.stages.default || []).slice();
    const postingStage = stages.length ? pick(stages, rnd) : "Posting";

    const acctTypes = (st.config.accountTypes || ["DDA","VOSTRO","NOSTRO","WALLET","LEDGER"]);
    const acctDomains = ["Wallet","Ledger","Core","Nostro","Vostro","Settlement","Treasury"];
    const destSystems = ["Kinexys","Partior","Graphite","Swift","Core Banking","Ledger"];
    const msgTypes = ["pacs.008","pacs.004","camt.054","pain.001","internal"];
    const branches = ["HYD01","MUM01","BLR01","LUX01","NYC01","LDN01"];
    const branchShort = {HYD01:"HYD",MUM01:"MUM",BLR01:"BLR",LUX01:"LUX",NYC01:"NYC",LDN01:"LDN"};
    const ru = ["APO","OPS","TREAS","CASH","WALLET"];

    const baseAmt = Number(txn.amount||0);
    // Ops drilldowns in this prototype expect the same business amount repeated across all legs.
    // (Do not vary leg amounts with fee legs here.)
    const legAmt = asMoney(baseAmt);

    // Branch must be single per transaction (stable + realistic)
    const txnBranch = pick(branches, rnd);

    const legs = [];
    for (let i=1;i<=n;i++){
      const isFirst = i===1;
      const isLast = i===n;
      const dc = isFirst ? "DEBIT" : (isLast ? "CREDIT" : (rnd()>0.5 ? "DEBIT" : "CREDIT"));
      const acct = numStr(12, rnd);
      const alt = "ALT-" + acct.slice(-6);
      legs.push({
        "Leg ID": `LEG-${txn.id.slice(-6)}-${i}`,
        "Sequence": i,
        "Agreement Structure ID": `AS-${Math.floor(rnd()*900000+100000)}`,
        "Debit/Credit": dc,
        "Account Number": acct,
        "Alternate Account Number": alt,
        "Account Type": pick(acctTypes, rnd),
        "Account Domain": pick(acctDomains, rnd),
        "Destination System": pick(destSystems, rnd),
        "Message Type": pick(msgTypes, rnd),
        "Trancode": "TR" + numStr(4, rnd),
        "Branch": txnBranch,
        "Branch Short Name": branchShort[txnBranch] || txnBranch,
        "Reporting Unit": pick(ru, rnd),
        "Currency": txn.currency || "USD",
        "Amount": legAmt,
        "Revised Booking Date": isoDayPlus(txn.createdAt, 0),
        "Value Date": isoDayPlus(txn.createdAt, 0),
        "Exposure Date": isoDayPlus(txn.createdAt, 0),
        "Posted By (Posting Stage)": postingStage,
        "Narrative": `${(txn.payerClientName || txn.clientName || "Client")} ${txn.transactionType || "Payment"}`,
        "Overridden Narrative": (rnd()>0.85) ? "Ops override" : "—",
        "Priority Posting": (rnd()>0.8) ? "Y" : "N"
      });
    }
    return legs;
  }

  function normalizeLeg(leg){
    // Accept either exact Ops naming (preferred) or camelCase variants.
    const out = {};
    LEG_COLS.forEach(k=>{
      if (leg && Object.prototype.hasOwnProperty.call(leg, k)) out[k] = leg[k];
      else {
        // minimal variant mapping
        const camel = k
          .replace(/\s\(.*\)/, "")
          .replace(/[^A-Za-z0-9]+(.)/g, (_,c)=>c.toUpperCase())
          .replace(/^./, c=>c.toLowerCase());
        out[k] = (leg && leg[camel]!==undefined) ? leg[camel] : "—";
      }
    });
    return out;
  }

  function toCSV(rows, cols){
    const esc = (v)=>{ const s=String(v??""); return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s; };
    const head = cols.map(esc).join(",");
    const body = rows.map(r=>cols.map(c=>esc(r[c])).join(",")).join("\n");
    return head + "\n" + body;
  }

  function renderStepper(txn, timeline){
    const isRejected = txn.status==="Rejected";
    const isReturned = txn.status==="Returned";
    const failedTag = isReturned ? "RETURNED" : "REJECTED";
    const idx = Math.max(0, timeline.findIndex(x=>x.cur));

    const stepHtml = timeline.map((x,i)=>{
      let cls = "";
      let icon = "○";
      let tag = "";

      const isCur = (txn.status==="Pending") && x.cur;
      const isFail = (isRejected || isReturned) && (i===idx);

      if (x.done){ cls = "done"; icon = "✓"; }
      else if (isCur){ cls = "current"; icon = "●"; tag = `<span class="tag">PENDING</span>`; }
      else if (isFail){ cls = "failed"; icon = "✕"; tag = `<span class="tag">${failedTag}</span>`; }
      else { cls = ""; icon = "○"; }

      const tip = `Stage: ${x.s}\nTime: ${UI.fmtDT(x.ts)}\nEst. duration: ${UI.durMinToText(x.durMin)}`;
      const step = `
        <div class="step ${cls}" role="listitem">
          <div class="node" title="${UI.escapeHtml(tip)}">${UI.escapeHtml(icon)}</div>
          <div class="lbl">${UI.escapeHtml(x.s)}</div>
          ${tag}
        </div>
      `;

      // connector color based on progress up to this step
      let connCls = "";
      if (x.done) connCls = "done";
      if (isCur) connCls = "current";
      if (isFail) connCls = "failed";
      const conn = (i < timeline.length-1) ? `<div class="conn ${connCls}"></div>` : "";
      return step + conn;
    }).join("");

    return `
      <div class="stepper-wrap">
        <div class="stepper" role="list" aria-label="Processing roadmap">${stepHtml}</div>
      </div>
    `;
  }

  function renderSnapshot(txn, sla){
    const isException = (txn.status==="Rejected" || txn.status==="Returned");
    const reasonTxt = (isException && txn.reasonCode)
      ? (reasonTitle(txn.reasonCode) ? `${reasonTitle(txn.reasonCode)} (${txn.reasonCode})` : String(txn.reasonCode))
      : "—";
    const exTxt = (isException && txn.exceptionType && txn.exceptionType!=="None") ? txn.exceptionType : "—";

    const cell = (k, v, extraCls="")=>{
      const htmlV = (v===undefined || v===null || v==="") ? "—" : String(v);
      const tip = htmlV.replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim();
      return `<td class="snap-td ${extraCls}" title="${UI.escapeHtml(tip)}"><span class="snap-k">${UI.escapeHtml(k)}</span><span class="snap-sep">: </span><span class="snap-v">${htmlV}</span></td>`;
    };

    const statusHtml = UI.badgeForStatus(txn.status);
    const slaHtml = UI.badgeForSLA(sla.state) + ` <span class="mini">(Due: ${UI.escapeHtml(UI.fmtDT(txn.slaDueAt))} • Rem: ${UI.escapeHtml(UI.durMinToText(sla.remainingMin))})</span>`;

    const rows = [
      [ cell("Transaction ID", `<span class="mono">${UI.escapeHtml(txn.id)}</span>`, "mono"),
        cell("From", UI.escapeHtml(partyFrom(txn))),
        cell("To", UI.escapeHtml(partyTo(txn))) ],

      [ cell("Product", UI.escapeHtml(txn.product || "—")),
        cell("Sub-product", UI.escapeHtml(txn.subProduct || "—")),
        cell("Product BIC", UI.escapeHtml(txn.productBic || "—"), "mono") ],

      [ cell("Type", UI.escapeHtml(txn.transactionType || "—")),
        cell("Currency", UI.escapeHtml(txn.currency || "—")),
        cell("Amount", UI.escapeHtml(UI.fmtNum(txn.amount,0))) ],

      [ cell("Status", statusHtml),
        cell("Current stage", UI.escapeHtml(txn.currentStage || "—")),
        cell("SLA", slaHtml) ],

      [ cell("Message ID", `<span class="mono">${UI.escapeHtml(txn.messageId || "—")}</span>`, "mono"),
        cell("Network Ref", `<span class="mono">${UI.escapeHtml(txn.networkRef || "—")}</span>`, "mono"),
        cell("Unique Activity ID", `<span class="mono">${UI.escapeHtml(txn.uniqueActivityId || "—")}</span>`, "mono") ],

      [ cell("Unique Reference #", `<span class="mono">${UI.escapeHtml(txn.uniqueReferenceNumber || "—")}</span>`, "mono"),
        cell("Account #", `<span class="mono">${UI.escapeHtml(String(txn.accountNumberMasked || txn.accountNumber || "—"))}</span>`, "mono"),
        cell("Account type", UI.escapeHtml(txn.accountType || "—")) ],

      [ cell("Source system", UI.escapeHtml(txn.sourceSystem || "—")),
        cell("Transaction source", UI.escapeHtml(txn.transactionSource || "—")),
        cell("Branch", UI.escapeHtml(txn.branch || "—"), "mono") ],

      [ cell("Coin branch", UI.escapeHtml(txn.coinBranch || "—")),
        cell("Enquiry type", UI.escapeHtml(txn.enquiryType || "—")),
        cell("Exception type", UI.escapeHtml(exTxt)) ],

      [ cell("Reason", UI.escapeHtml(reasonTxt)),
        cell("Created", UI.escapeHtml(UI.fmtDT(txn.createdAt))),
        `<td class="snap-td empty"></td>` ]
    ];

    return `
      <table class="snap-table">
        <tbody>
          ${rows.map(r=>`<tr>${r.join("")}</tr>`).join("")}
        </tbody>
      </table>
    `;
  }



  function renderLegsSection(txn){
    const legsRaw = getTxnLegs(txn);
    const legs = legsRaw.map(normalizeLeg);
    const rowsHtml = legs.map(l=>`<tr>${LEG_COLS.map(c=>{
      const val = l[c];
      const isMono = /ID|Account|Trancode|Branch|Unit/i.test(c);
      return `<td class="${isMono?"mono":""}">${UI.escapeHtml(val)}</td>`;
    }).join("")}</tr>`).join("");

    return `
      <div class="legs-head">
        <div class="mini">${legs.length} legs</div>
        <button class="btn small" id="exportLegsCSV">Export Legs CSV</button>
      </div>
      <div class="legs-wrap" role="region" aria-label="Transaction legs table">
        <table class="legs-table">
          <thead><tr>${LEG_COLS.map(c=>`<th>${UI.escapeHtml(c)}</th>`).join("")}</tr></thead>
          <tbody>${rowsHtml || `<tr><td colspan="${LEG_COLS.length}" class="mini">No legs.</td></tr>`}</tbody>
        </table>
      </div>
    `;
  }

  function openTxn(txnId){
    const st = BP.ensureState();
    const t = st.transactions.find(x=>x.id===txnId);
    if (!t){ UI.toast("Not found", txnId); return; }
    const sla = BP.computeSLAStateFor(t);
    const timeline = stageTimeline(t);
    const ent = BP.entitlements();

    const raw = JSON.stringify(t, null, 2);

    const body = `
      <div class="drill">
        <section class="drill-sec">
          <div class="sec-hd">
            <div>
              <h3>Processing roadmap</h3>
              <div class="sec-sub">Visual stepper with prototype timestamps and stage duration tooltips.</div>
            </div>
            <div class="sec-right">
              ${UI.badgeForSLA(sla.state)}
              <span class="badge">Due: ${UI.escapeHtml(UI.fmtDT(t.slaDueAt))}</span>
              <span class="badge">Remaining: ${UI.escapeHtml(UI.durMinToText(sla.remainingMin))}</span>
            </div>
          </div>
          ${renderStepper(t, timeline)}
        </section>

        <section class="drill-sec">
          <div class="sec-hd">
            <div>
              <h3>Payment snapshot details</h3>
              <div class="sec-sub">Text-only key fields (3 columns).</div>
            </div>
          </div>
          ${renderSnapshot(t, sla)}
        </section>

        <section class="drill-sec">
          <div class="sec-hd">
            <div>
              <h3>Transaction legs</h3>
              <div class="sec-sub">Scrollable legs table with sticky header. Deterministic mock legs generated if missing.</div>
            </div>
          </div>
          ${renderLegsSection(t)}
        </section>

        <section class="drill-sec payload">
          <details>
            <summary>
              <span>Payload (JSON)</span>
              <span class="mini">Click to expand</span>
            </summary>
            <div class="payload-bd">
              <div class="payload-actions">
                <button class="btn small" id="copyPayloadJson">Copy</button>
                <button class="btn small" id="dlPayloadJson">Download JSON</button>
              </div>
              <pre id="payloadPre">${UI.escapeHtml(raw)}</pre>
            </div>
          </details>
        </section>
      </div>
    `;

    const footer = `
      <button class="btn small" data-act="assist">Request assistance</button>
      <button class="btn small" data-act="ticket">Create Jira ticket</button>
      <button class="btn small" data-act="linkCase">Link case</button>
      <button class="btn small primary" data-act="initForm" ${ent.initiate? "":"disabled"}>Open initiation form</button>
    `;

    UI.openDrawer({
      title: `${t.id} • ${(t.payerClientName||t.clientName||"—")} → ${(t.payeeClientName||t.payee||"—")}`,
      meta: `${t.product} • ${t.currency} ${UI.fmtNum(t.amount,0)} • ${t.status}`,
      body,
      footer
    });

    // Payload: download + copy
    const dl = document.getElementById("dlPayloadJson");
    if (dl){
      dl.addEventListener("click", (ev)=>{
        ev.stopPropagation();
        UI.downloadFile(`payload_${t.id}.json`, "application/json", raw);
      });
    }
    const cp = document.getElementById("copyPayloadJson");
    if (cp){
      cp.addEventListener("click", async (ev)=>{
        ev.stopPropagation();
        try{
          if (navigator.clipboard && navigator.clipboard.writeText){
            await navigator.clipboard.writeText(raw);
            UI.toast("Copied", "Payload JSON copied");
            return;
          }
        }catch(e){ /* fall through */ }
        // Fallback
        const ta = document.createElement("textarea");
        ta.value = raw;
        document.body.appendChild(ta);
        ta.select();
        try{ document.execCommand("copy"); UI.toast("Copied", "Payload JSON copied"); }
        catch(e){ UI.toast("Copy failed", "Browser blocked clipboard"); }
        ta.remove();
      });
    }

    // Export legs CSV
    const ex = document.getElementById("exportLegsCSV");
    if (ex){
      ex.addEventListener("click", (ev)=>{
        ev.stopPropagation();
        const legs = getTxnLegs(t).map(normalizeLeg);
        const csv = toCSV(legs, LEG_COLS);
        UI.downloadFile(`legs_${t.id}.csv`, "text/csv", csv);
      });
    }

    // Actions (footer)
    UI.qsa("[data-act]").forEach(btn=>{
      btn.addEventListener("click", async ()=>{
        const act = btn.getAttribute("data-act");
        if (act==="initForm"){
          location.href = `initiation.html?txn=${encodeURIComponent(t.id)}`;
          return;
        }
        if (act==="assist"){
          const n = BP.createNotification({
            kind:"assistance",
            severity:"warning",
            title:`Assistance requested for ${t.id}`,
            body:`Category: Ops help • Linked to transaction`,
            links:{txnId:t.id},
            actionRequired:true
          });
          t.links = t.links || {incidents:[], tickets:[], assistance:[], qc:[]};
          t.links.assistance = t.links.assistance || [];
          t.links.assistance.push(n.id);
          BP.pushAudit("Transaction", t.id, "ASSIST_REQUEST", {notifId:n.id});
          BP.saveState(st);
          UI.toast("Requested", "Assistance ticket created");
          return;
        }
        if (act==="ticket"){
          const ticket = "JIRA-" + Math.floor(Math.random()*90000+10000);
          t.links = t.links || {incidents:[], tickets:[], assistance:[], qc:[]};
          t.links.tickets = t.links.tickets || [];
          t.links.tickets.push(ticket);
          BP.pushAudit("Transaction", t.id, "TICKET_CREATE", {ticket});
          BP.saveState(st);
          UI.toast("Ticket created", ticket);
          return;
        }
        if (act==="linkCase"){
          const incs = BP.getIncidents();
          if (!incs.length){
            UI.toast("No cases", "Create one in Incidents page first.");
            return;
          }
          UI.showModal({
            title:"Link case",
            sub:"Select a case to link to this transaction.",
            body: `
              <div class="filters">
                <div class="f w12">
                  <label>Case</label>
                  <select id="casePick">${incs.map(i=>`<option value="${UI.escapeHtml(i.id)}">${UI.escapeHtml(i.id)} • ${UI.escapeHtml(i.title)} • ${UI.escapeHtml(i.status)}</option>`).join("")}</select>
                </div>
              </div>
            `,
            buttons:[
              {label:"Cancel", onClick:UI.hideModal},
              {label:"Link", className:"primary", onClick:()=>{
                const id = document.getElementById("casePick").value;
                try{
                  BP.linkIncidentToTxn(id, t.id);
                  UI.hideModal();
                  UI.toast("Linked", `${id} → ${t.id}`);
                }catch(e){
                  UI.toast("Error", e.message);
                }
              }}
            ]
          });
          return;
        }
      });
    });
  }

  function exportCSV(){
    readUI();
    const txns = BP.applyTxnFilters(BP.getTransactions(), filters).slice(0,5000).map(t=>{
      const sla = BP.computeSLAStateFor(t);
      return {
        txn_id:t.id,
        payer_client:t.payerClientName||t.clientName,
        payer_client_id:t.payerClientId||t.clientId,
        payee_client:t.payeeClientName||t.payee||"",
        payee_client_id:t.payeeClientId||"",
        product:t.product,
        currency:t.currency,
        amount:t.amount,
        status:t.status,
        stage:t.currentStage,
        created_at:t.createdAt,
        sla_due_at:t.slaDueAt,
        sla_state:sla.state,
        exception_type:t.exceptionType,
        reason_code:t.reasonCode || "",
        message_id:t.messageId,
        network_ref:t.networkRef || ""
      };
    });
    const csv = (function(){
      if (!txns.length) return "";
      const cols = Object.keys(txns[0]);
      const esc = (v)=>{ const s=String(v??""); return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s; };
      const head = cols.map(esc).join(",");
      const body = txns.map(r=>cols.map(c=>esc(r[c])).join(",")).join("\n");
      return head+"\n"+body;
    })();
    const f = APP.getGlobalFilters();
    UI.downloadFile(`transactions_${f.product}_${f.from}_to_${f.to}.csv`, "text/csv", csv);
  }

  function resetFilters(){
    // Reset global filters back to initial demo defaults (captured at load)
    if (DEFAULT && DEFAULT.global){
      APP.setGlobalFilters(Object.assign({}, DEFAULT.global));
      const gf = APP.getGlobalFilters();
      const elProd = UI.qs("[data-global-product]");
      const elFrom = UI.qs("[data-global-from]");
      const elTo = UI.qs("[data-global-to]");
      const elSearch = UI.qs("[data-global-search]");
      if (elProd) elProd.value = gf.product || "Combined";
      if (elFrom) elFrom.value = gf.from || "";
      if (elTo) elTo.value = gf.to || "";
      if (elSearch) elSearch.value = gf.search || "";
      filters = makeDefaultLocalFilters(gf);
    } else {
      // Fallback
      filters = makeDefaultLocalFilters(APP.getGlobalFilters());
    }
    writeUI();
    render();
  }

  function bind(){
    ["#fClientId","#fClientName","#fAccount","#fUA","#fUR","#fSearch"].forEach(sel=>{
      UI.qs(sel).addEventListener("input", ()=>{ clearTimeout(bind._t); bind._t=setTimeout(render, 150); });
      UI.qs(sel).addEventListener("change", render);
    });
    UI.qs("#resetTxnFilters").addEventListener("click", resetFilters);
    const railReset = UI.qs("#resetTxnFiltersRail");
    if (railReset) railReset.addEventListener("click", resetFilters);
    // Advanced filters toggle (saves vertical space)
    const adv = UI.qs("#txnFiltersAdv");
    const toggle = UI.qs("#toggleTxnFilters");
    if (toggle && adv){
      toggle.addEventListener("click", ()=>{
        const open = adv.classList.toggle("show");
        toggle.textContent = open ? "Less filters" : "More filters";
      });
    }
    UI.qs("#exportTxnCSV").addEventListener("click", exportCSV);

    // Filter panel (left) collapse/expand — keeps the grid visible.
    const panel = UI.qs("#txnFilterPanel");
    const toggles = UI.qsa("[data-txn-filterpanel-toggle]");
    const key = "bp_ui_txnFiltersCollapsed";
    const setCollapsed = (v)=>{
      if (!panel) return;
      panel.classList.toggle("collapsed", !!v);
      // We still store for in-session convenience, but we IGNORE this on load for demo.
      try{ localStorage.setItem(key, v?"1":"0"); }catch(e){}
    };
    if (panel){
      // Demo-friendly default: always OPEN on load, regardless of prior state.
      setCollapsed(false);
      try{ localStorage.setItem(key, "0"); }catch(e){}
    }
    (toggles||[]).forEach(btn=>{
      btn.addEventListener("click", ()=>{
        if (!panel) return;
        setCollapsed(!panel.classList.contains("collapsed"));
      });
    });

  }

  document.addEventListener("DOMContentLoaded", ()=>{
    // Capture defaults ONCE (used for applied-count + reset)
    const g0 = Object.assign({}, APP.getGlobalFilters());
    DEFAULT = { global: g0, local: makeDefaultLocalFilters(g0) };

    populateFilters();
    writeUI();
    bind();
    render();
  });
  document.addEventListener("bp:filtersChanged", ()=>render());
})();
