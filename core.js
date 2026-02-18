
(function(){
  const KEY = "bp_console_state_v2";
  const KEY_EVID = "bp_console_evidence_v2"; // indexedDB name
  // Bump version whenever seed semantics change so localStorage re-seeds.
  // This avoids users carrying forward stale demo data (e.g., old client names) across ZIP swaps.
  const VERSION = "2.0.2";
  const nowISO = () => new Date().toISOString();


// Deterministic helpers (same TXN ID -> same derived attributes)
function hash32(str){
  let h = 2166136261;
  str = String(str||"");
  for (let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h>>>0);
}
function mulberry32(seed){
  let a = (seed>>>0);
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function randIntR(rnd,a,b){ return Math.floor(rnd()*(b-a+1))+a; }
function pickR(arr, rnd){ return arr[Math.floor(rnd()*arr.length)]; }
function pad(n,len){ return String(n).padStart(len,'0'); }
function ymdFromISO(iso){ return String(iso||'').slice(0,10).replace(/-/g,''); }
function digitsFromHash(h, len){
  const mod = Math.pow(10, len);
  return pad(Number(h % mod), len);
}

  function randInt(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }
  function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]}
  function uuid(prefix){
    const s = Math.random().toString(16).slice(2) + Date.now().toString(16);
    return (prefix?prefix+"-":"")+s.slice(0,18).toUpperCase();
  }

  const config = {
    version: VERSION,
    rails: ["Combined","Kinexys","Partior","Deposit Token"],
    productBics: {
      "Kinexys": ["A","B","C","D","E"],
      "Partior": ["A","B","C","D","E"],
      "Deposit Token": ["A","B","C","D","E"]
    },
    // NOTE: For this prototype, client names must be anonymized.
    clients: [
      {id:"C-001", name:"Client1"},
      {id:"C-002", name:"Client2"}
    ],
    branches: ["NYC1","LDN1","SGP1","HKG1","DXB1","HYD1"],
    currencies: ["USD","EUR","GBP","JPY","SGD","HKD","AED","AUD","CNY"],
transactionTypesByProduct: {
  "Kinexys": ["Credit Principal","Debit Principal","Self Bal","Fee","Adjustment"],
  "Partior": ["Credit Principal","Debit Principal","Self Bal","Fee","Adjustment"],
  "Deposit Token": ["Credit Principal","Debit Principal","Self Bal","Fee","Adjustment"]
},
    // Keep in sync with the user’s earlier prototype filter options
    accountTypes: ["Client","BDA","IDDA","N-Ledger","N-Statement","Self Bal"],
    enquiryTypes: ["All","A","B","C","D","E"],
    coinBranches: ["All","A","B","C","D","E"],
    subProducts: ["All","Wallet","Kinexys","B2C","RTP","Graphite"],
    transactionSources: ["All","Online","Manual","File","API"],
    sourceSystems: ["All","SWIFT","SAP","BlockchainGW","CORE","MTS"],
    transactionStatuses: ["All","Completed","Pending","Rejected","Returned"],
    stages: {
      "default": ["Initiated","Validated","Funding/Limits","Compliance checks","Network submission","Settlement","Posting","Reconciliation","Closed"],
      "Kinexys": ["Initiated","Validated","Funding/Limits","Compliance checks","Network submission","Settlement","Posting","Reconciliation","Closed"],
      "Partior": ["Initiated","Validated","FX/PvP checks","Funding/Limits","Compliance checks","Network submission","Atomic settlement","Posting","Reconciliation","Closed"],
      "Deposit Token": ["Initiated","Validated","Funding/Limits","Compliance checks","On-chain submission","On-chain settlement","Posting","Reconciliation","Closed"]
    },
    slaMinutesByRail: {"Kinexys": 180, "Partior": 240, "Deposit Token": 120},
    nearBreachWindowMinutes: 30,
    highValueThresholdUSD: 5000000,
    reasonCodes: {
      reject: [
        {code:"VAL_001", title:"Schema validation failed", severity:"warning"},
        {code:"LIM_003", title:"Limits insufficient", severity:"warning"},
        {code:"CPL_010", title:"Compliance hold", severity:"error"},
        {code:"NET_002", title:"Network ref missing", severity:"warning"},
        {code:"DUP_004", title:"Duplicate suspicion", severity:"warning"}
      ],
      ret: [
        {code:"RET_015", title:"Beneficiary bank reject", severity:"warning"},
        {code:"RET_021", title:"Account closed/invalid", severity:"error"},
        {code:"RET_033", title:"FX settlement fail", severity:"warning"},
        {code:"RET_050", title:"Returns after completion", severity:"error"}
      ]
    },
    playbooks: {
      "VAL_001": {symptoms:["Rejected at Validated stage","Missing mandatory fields"], causes:["Mapping bug","Client payload field missing"], fixes:["Confirm required fields in Business View","Request corrected payload from client","If systematic: create Jira with sample payload"], escalate:["If >10 txns in 1 hour","If p95 validation time increases"], evidence:["Payload JSON","Client reference","Screenshots of error"]},
      "LIM_003": {symptoms:["Funding/Limits stage stuck","Reject reason limits"], causes:["Credit/limits exhausted","Wrong account type"], fixes:["Check available balance and limits","Move to correct booking unit if authorized","If urgent: initiate controlled adjustment with evidence"], escalate:["If high value >= threshold","If client VIP"], evidence:["Balance screenshot","Limit policy reference"]},
      "CPL_010": {symptoms:["Compliance checks stage hold","Manual review required"], causes:["Sanctions/AML match","Country/corridor rule"], fixes:["Verify KYC status","Raise Compliance assistance request","Do not release without approval"], escalate:["Immediate if SLA risk","If repeat offender"], evidence:["Screening result reference","Compliance ticket ID"]},
      "RET_050": {symptoms:["Returned after completion","Client escalation"], causes:["Downstream bank reject","Posting mismatch"], fixes:["Open incident if multiple clients impacted","Prepare evidence bundle","Product review for root cause"], escalate:["Always to Product + Tech"], evidence:["Network ref","Posting log","Client email thread"]},
      "DUP_004": {symptoms:["Duplicate suspicion flag","Same amount+beneficiary"], causes:["Retry storm","Client idempotency issue"], fixes:["Compare Unique Activity ID","Check message IDs and timestamps","If confirmed: place controlled hold and notify client"], escalate:["If widespread","If caused by release"], evidence:["Duplicate comparison table","IDs list"]}
    }
  };

// Backwards-compatible union for pages that still read config.transactionTypes
try{
  const union = Array.from(new Set(Object.values(config.transactionTypesByProduct||{}).flat().map(String)));
  config.transactionTypes = union.length ? union : (config.transactionTypes || []);
}catch(e){ /* ignore */ }

  function defaultUser(){
    return {
      id: "U-" + Math.random().toString(16).slice(2,7).toUpperCase(),
      name: "Ops Console User",
      role: "Ops Lead", // maps to entitlements
      checkerLane: "QC1", // QC1/QC2
      controlGroup: "Ops",
    };
  }

  const roleEntitlements = {
    "Ops Analyst (Maker)": {initiate:true, qc1:false, qc2:false, manageNotifs:false, createIncident:true, viewAll:true},
    "Ops Lead": {initiate:true, qc1:true, qc2:true, manageNotifs:true, createIncident:true, viewAll:true},
    "Checker 1": {initiate:false, qc1:true, qc2:false, manageNotifs:false, createIncident:true, viewAll:true},
    "Checker 2": {initiate:false, qc1:false, qc2:true, manageNotifs:false, createIncident:true, viewAll:true},
    "Manager": {initiate:true, qc1:true, qc2:true, manageNotifs:true, createIncident:true, viewAll:true},
    "Product": {initiate:false, qc1:false, qc2:false, manageNotifs:false, createIncident:false, viewAll:true},
    "Tech": {initiate:false, qc1:false, qc2:false, manageNotifs:false, createIncident:true, viewAll:true},
    "Admin": {initiate:true, qc1:true, qc2:true, manageNotifs:true, createIncident:true, viewAll:true}
  };


function seed(){
  // Fixed client master (stable across reloads)
  const clients = Array.isArray(config.clients) && config.clients.length
    ? config.clients.slice()
    : Array.from({length:20}, (_,i)=>({id:"ECI-"+pad(i+1,4), name:"Client "+(i+1)}));

  // Deterministic RNG for dataset shape (NOT for per-TXN semantics)
  const rnd = mulberry32(1337);

  const rails = ["Kinexys","Partior","Deposit Token"];

  // Accounts
  const accounts = [];
  const acctTypes = config.accountTypes || ["Client","BDA","IDDA","N-Ledger","N-Statement","Self Bal"];
  const curList = config.currencies || ["USD","EUR","GBP"];
  for (let i=0;i<60;i++){
    const c = clients[i % clients.length];
    const rail = rails[i % rails.length];
    const cur = curList[i % curList.length];
    const bcNum = "BC" + digitsFromHash(hash32(`ACCT|${i}|${c.id}|${rail}|${cur}`), 10);
    accounts.push({
      id: "ACCT-" + pad(i+1,4),
      blockchainAccountNumber: bcNum,
      accountName: `${c.name} • ${rail} • ${cur}`,
      branch: pickR(config.branches, rnd),
      branchName: "Branch " + pickR(["NY","LDN","SGP","HKG","DXB","HYD"], rnd),
      accountType: pickR(acctTypes, rnd),
      currency: cur,
      status: (i%17===0)?"Dormant":((i%13===0)?"Onboarding":"Active"),
      openDate: new Date(Date.now()-(30 + (i%900))*86400000).toISOString(),
      clientId: c.id,
      clientName: c.name,
      currentBalance: (50 + (i%200))*1000000,
      availableBalance: (40 + (i%180))*1000000,
      asOf: nowISO(),
      product: rail
    });
  }

  // Transactions
  const txns = [];
  const base = Date.now();
  const datePart = ymdFromISO(new Date(base).toISOString());

  function pickClientPair(txnId){
    const h = hash32(txnId);
    const payerIdx = h % clients.length;
    const step = 1 + (hash32(txnId+"|K") % (clients.length-1));
    const payeeIdx = (payerIdx + step) % clients.length;
    return {payer: clients[payerIdx], payee: clients[payeeIdx]};
  }

  function productFor(txnId){
    const h = hash32(txnId+"|P");
    return rails[h % rails.length];
  }

  function statusFor(txnId){
    const r = hash32(txnId+"|S") % 100;
    if (r < 62) return "Completed";
    if (r < 84) return "Pending";
    if (r < 93) return "Rejected";
    return "Returned";
  }

  function createdAtFor(txnId, status){
    if (status === "Completed"){
      const offDays = hash32(txnId+"|CD") % 180;
      const offMs = hash32(txnId+"|CM") % 86400000;
      return new Date(base - offDays*86400000 - offMs).toISOString();
    }
    if (status === "Pending"){
      const offMs = hash32(txnId+"|PD") % (6*3600000);
      return new Date(base - offMs).toISOString();
    }
    // Rejected/Returned
    const offMs = hash32(txnId+"|ED") % (48*3600000);
    return new Date(base - offMs).toISOString();
  }

  for (let i=0;i<900;i++){
    const seq = pad(i+1,6);
    const txnId = `TXN-${datePart}-${seq}`;

    const status = statusFor(txnId);
    const product = productFor(txnId);
    const stages = (config.stages && (config.stages[product]||config.stages.default)) || [];

    const createdAt = createdAtFor(txnId, status);
    const currencyList = (config.currencies || ["USD"]);
    const currency = currencyList[hash32(txnId+"|C") % currencyList.length];

    // Amounts: realistic scale with long-tail
    const amtSeed = hash32(txnId+"|A");
    const amtBand = amtSeed % 100;
    let amount;
    if (amtBand < 70) amount = 10000 + (amtSeed % 490000);           // 10k–500k
    else if (amtBand < 92) amount = 500000 + (amtSeed % 4500000);    // 0.5M–5M
    else amount = 5000000 + (amtSeed % 25000000);                    // 5M–30M
    amount = Math.round(amount*100)/100;

    const pair = pickClientPair(txnId);
    const payer = pair.payer;
    const payee = pair.payee;

    // Transaction type: product-scoped (structure ready for Ops exact strings)
    const types = (config.transactionTypesByProduct && config.transactionTypesByProduct[product])
      ? config.transactionTypesByProduct[product]
      : (config.transactionTypes || []);
    const transactionType = types.length ? types[hash32(txnId+"|T") % types.length] : "—";

    // Exception model: ONLY for Rejected/Returned
    const exceptionType = (status==="Rejected")?"Reject":((status==="Returned")?"Return":"None");
    let reasonCode = "";
    if (status==="Rejected"){
      const rc = (config.reasonCodes && config.reasonCodes.reject) ? config.reasonCodes.reject : [];
      if (rc.length) reasonCode = rc[hash32(txnId+"|R") % rc.length].code;
    } else if (status==="Returned"){
      const rc = (config.reasonCodes && config.reasonCodes.ret) ? config.reasonCodes.ret : [];
      if (rc.length) reasonCode = rc[hash32(txnId+"|R") % rc.length].code;
    }

    // Stage positioning
    const stageIdx = (status==="Completed")
      ? Math.max(0, stages.length-1)
      : (stages.length>3 ? (1 + (hash32(txnId+"|G") % (stages.length-2))) : 0);
    const currentStage = stages[stageIdx] || (stages[0]||"Initiated");

    const slaMinutes = (config.slaMinutesByRail && config.slaMinutesByRail[product]) ? config.slaMinutesByRail[product] : 180;
    const slaDueAt = new Date(new Date(createdAt).getTime() + slaMinutes*60000).toISOString();

    // IDs/refs: deterministic + system-looking
    const msgNum = digitsFromHash(hash32(txnId+"|M"), 10);
    const messageId = `MSG-${product.replace(/\s/g,'').toUpperCase()}-${datePart}-${msgNum}`;

    const nwGate = hash32(txnId+"|NW") % 100;
    const networkRef = (nwGate < 78) ? (`NW-${datePart}-${digitsFromHash(hash32(txnId+"|N"), 9)}`) : "";

    const uniqueActivityId = `UA-${datePart}-${digitsFromHash(hash32(txnId+"|UA"), 8)}`;
    const uniqueReferenceNumber = `UR-${datePart}-${digitsFromHash(hash32(txnId+"|UR"), 11)}`;

    // Enrichment (deterministic)
    const enquiryTypeList = (config.enquiryTypes||[]).filter(x=>x!=="All");
    const coinBranchList = (config.coinBranches||[]).filter(x=>x!=="All");
    const subProductsList = (config.subProducts||[]).filter(x=>x!=="All");
    const txnSourcesList = (config.transactionSources||[]).filter(x=>x!=="All");
    const srcSystemsList = (config.sourceSystems||[]).filter(x=>x!=="All");
    const productBics = (config.productBics && config.productBics[product]) ? config.productBics[product] : [];

    const acctPick = accounts[hash32(txnId+"|AC") % accounts.length];
    const acctNum = acctPick.blockchainAccountNumber;
    const accountNumberMasked = "XXXX-" + String(acctNum).slice(-4);

    const riskFlags = {
      highValue: amount >= (config.highValueThresholdUSD||5000000),
      repeatOffender: (hash32(txnId+"|RO") % 100) < 11,
      complianceHold: reasonCode === "CPL_010",
      duplicateSuspicion: reasonCode === "DUP_004"
    };

    txns.push({
      id: txnId,

      // Business layer parties (Client -> Client)
      payerClientId: payer.id,
      payerClientName: payer.name,
      payeeClientId: payee.id,
      payeeClientName: payee.name,
      payer: payer.name,
      payee: payee.name,

      // Compatibility fields (legacy)
      clientId: payer.id,
      clientName: payer.name,

      product,
      productBic: productBics.length ? productBics[hash32(txnId+"|B") % productBics.length] : "—",
      branch: pickR(config.branches, rnd),
      currency,
      amount,
      status,
      transactionType,
      currentStage,
      createdAt,
      slaMinutes,
      slaDueAt,
      exceptionType,
      reasonCode,
      networkRef,
      messageId,
      uniqueActivityId,
      uniqueReferenceNumber,
      enquiryType: enquiryTypeList.length ? enquiryTypeList[hash32(txnId+"|E") % enquiryTypeList.length] : "A",
      coinBranch: coinBranchList.length ? coinBranchList[hash32(txnId+"|CB") % coinBranchList.length] : "A",
      subProduct: subProductsList.length ? subProductsList[hash32(txnId+"|SP") % subProductsList.length] : "Wallet",
      transactionSource: txnSourcesList.length ? txnSourcesList[hash32(txnId+"|TS") % txnSourcesList.length] : "API",
      sourceSystem: srcSystemsList.length ? srcSystemsList[hash32(txnId+"|SS") % srcSystemsList.length] : "CORE",
      accountType: pickR(acctTypes, rnd),
      accountNumber: acctNum,
      accountNumberMasked,
      riskFlags,
      holds: [],
      links: {incidents:[], tickets:[], assistance:[], qc:[]},
      audit: []
    });
  }

  return {
    config,
    user: defaultUser(),
    accounts,
    transactions: txns,
    initiationRequests: [],
    incidents: [],
    notifications: [],
    audit: []
  };
}

function load(
){
    try{
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    }catch(e){
      return null;
    }
  }
  function save(state){
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  function ensureState(){
    let st = load();
    if (!st || !st.config || st.config.version !== VERSION){
      st = seed();
      save(st);
    } else {
      // Defensive migration: if any older state carried real client names, anonymize them.
      try{
        const allowed = new Set(["Client1","Client2"]);
        let dirty = false;
        const mapName = (cid)=> (cid==="C-002" ? "Client2" : "Client1");
        (st.transactions||[]).forEach(t=>{
          // Ensure business-layer parties exist
          if (!t.payerClientId) { t.payerClientId = "C-001"; dirty = true; }
          if (!t.payeeClientId) { t.payeeClientId = "C-002"; dirty = true; }
          const pName = mapName(t.payerClientId);
          const qName = mapName(t.payeeClientId);
          if (!allowed.has(String(t.payerClientName||""))){ t.payerClientName = pName; dirty = true; }
          if (!allowed.has(String(t.payeeClientName||""))){ t.payeeClientName = qName; dirty = true; }
          // Keep legacy fields aligned (so any old UI bindings don't leak names)
          if (!allowed.has(String(t.payer||""))){ t.payer = t.payerClientName; dirty = true; }
          if (!allowed.has(String(t.payee||""))){ t.payee = t.payeeClientName; dirty = true; }
          if (!allowed.has(String(t.clientName||""))){ t.clientName = t.payerClientName; dirty = true; }
        });
        if (dirty) save(st);
      }catch(e){ /* ignore migration errors */ }
    }
    // ensure user object exists
    if (!st.user) { st.user = defaultUser(); save(st); }
    return st;
  }

  function entitlements(user){
    return roleEntitlements[user.role] || roleEntitlements["Ops Analyst (Maker)"];
  }

  function pushAudit(entityType, entityId, event, detail){
    const st = ensureState();
    const record = {
      id: uuid("EVT"),
      ts: nowISO(),
      actor: st.user.name + " ("+st.user.role+")",
      entityType,
      entityId,
      event,
      detail: detail || {}
    };
    st.audit.push(record);
    // also attach to entity if supported
    if (entityType==="Transaction"){
      const t = st.transactions.find(x=>x.id===entityId);
      if (t){ t.audit = t.audit || []; t.audit.push(record); }
    }
    if (entityType==="InitiationRequest"){
      const q = st.initiationRequests.find(x=>x.id===entityId);
      if (q){ q.audit = q.audit || []; q.audit.push(record); }
    }
    if (entityType==="Incident"){
      const inc = st.incidents.find(x=>x.id===entityId);
      if (inc){ inc.audit = inc.audit || []; inc.audit.push(record); }
    }
    save(st);
    return record;
  }

  function computeSLAStateFor(txn){
    const st = ensureState();
    // Completed transactions are considered out of SLA scope (no noisy Breach by default).
    if (txn && txn.status==="Completed"){
      return {state:"Normal", remainingMin:0};
    }
    const due = new Date(txn.slaDueAt).getTime();
    const now = Date.now();
    const remainingMs = due - now;
    const remainingMin = Math.floor(remainingMs/60000);
    const near = st.config.nearBreachWindowMinutes;
    if (remainingMin < 0) return {state:"Breach", remainingMin};
    if (remainingMin <= near) return {state:"Risk", remainingMin};
    return {state:"Normal", remainingMin};
  }

  function matchProduct(productFilter, product){
    return (productFilter==="Combined" || !productFilter) ? true : product === productFilter;
  }

  function parseDayStart(x){
    if (!x) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(x))) return new Date(String(x)+"T00:00:00.000");
    return new Date(x);
  }
  function parseDayEnd(x){
    if (!x) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(x))) return new Date(String(x)+"T23:59:59.999");
    return new Date(x);
  }

  function applyTxnFilters(txns, filters){
    const f = filters || {};
    const txt = (x)=>String(x ?? "").toLowerCase();

    return txns.filter(t=>{
      // Rail (global)
      if (f.product && !matchProduct(f.product, t.product)) return false;

      // Multi-select filters (arrays)
      if (Array.isArray(f.enquiryTypes) && f.enquiryTypes.length && !f.enquiryTypes.includes(t.enquiryType)) return false;
      if (Array.isArray(f.productBics) && f.productBics.length && !f.productBics.includes(t.productBic)) return false;
      if (Array.isArray(f.coinBranches) && f.coinBranches.length && !f.coinBranches.includes(t.coinBranch)) return false;
      if (Array.isArray(f.currencies) && f.currencies.length && !f.currencies.includes(t.currency)) return false;
      if (Array.isArray(f.transactionTypes) && f.transactionTypes.length && !f.transactionTypes.includes(t.transactionType)) return false;
      if (Array.isArray(f.accountTypes) && f.accountTypes.length && !f.accountTypes.includes(t.accountType)) return false;
      if (Array.isArray(f.transactionSources) && f.transactionSources.length && !f.transactionSources.includes(t.transactionSource)) return false;
      if (Array.isArray(f.sourceSystems) && f.sourceSystems.length && !f.sourceSystems.includes(t.sourceSystem)) return false;
      if (Array.isArray(f.transactionStatuses) && f.transactionStatuses.length && !f.transactionStatuses.includes(t.status)) return false;
      if (Array.isArray(f.subProducts) && f.subProducts.length && !f.subProducts.includes(t.subProduct)) return false;

      // Legacy single-selects (kept for backwards compatibility)
      if (f.branch && f.branch!=="All" && t.branch!==f.branch) return false;
      if (f.currency && f.currency!=="All" && t.currency!==f.currency) return false;
      if (f.status && f.status!=="All" && t.status!==f.status) return false;

      // Text filters
      const payerId = t.payerClientId || t.clientId;
      const payeeId = t.payeeClientId || "";
      const payerName = t.payerClientName || t.clientName;
      const payeeName = t.payeeClientName || "";
      if (f.clientId && !(txt(payerId).includes(txt(f.clientId)) || txt(payeeId).includes(txt(f.clientId)))) return false;
      if (f.clientName && !(txt(payerName).includes(txt(f.clientName)) || txt(payeeName).includes(txt(f.clientName)))) return false;
      if (f.accountNumber && !txt(t.accountNumberMasked || t.accountNumber).includes(txt(f.accountNumber))) return false;
      if (f.uniqueActivityId && !txt(t.uniqueActivityId).includes(txt(f.uniqueActivityId))) return false;
      if (f.uniqueReferenceNumber && !txt(t.uniqueReferenceNumber).includes(txt(f.uniqueReferenceNumber))) return false;

      // Ops controls
      // Multi-select variants (arrays)
      if (Array.isArray(f.exceptionTypes) && f.exceptionTypes.length && !f.exceptionTypes.includes(t.exceptionType)) return false;
      if (Array.isArray(f.reasonCodes) && f.reasonCodes.length && !f.reasonCodes.includes(t.reasonCode)) return false;
      if (Array.isArray(f.slaStates) && f.slaStates.length){
        const sla = computeSLAStateFor(t).state;
        if (!f.slaStates.includes(sla)) return false;
      }

      if (f.exceptionType && f.exceptionType!=="All" && t.exceptionType!==f.exceptionType) return false;
      if (f.reasonCode && f.reasonCode!=="All" && t.reasonCode!==f.reasonCode) return false;
      if (f.slaState && f.slaState!=="All"){
        const sla = computeSLAStateFor(t).state;
        if (sla!==f.slaState) return false;
      }
      // Date range (inclusive end-of-day for To)
      const createdMs = new Date(t.createdAt).getTime();
      if (f.from){
        const fromMs = parseDayStart(f.from).getTime();
        if (createdMs < fromMs) return false;
      }
      if (f.to){
        const toMs = parseDayEnd(f.to).getTime();
        if (createdMs > toMs) return false;
      }

      // Free text search
      if (f.search){
        const s = txt(f.search);
        const hay = txt(
          t.id+" "+(t.payerClientName||t.clientName||"")+" "+(t.payerClientId||t.clientId||"")+" "+(t.payeeClientName||"")+" "+(t.payeeClientId||"")+" "+t.messageId+" "+t.networkRef+" "+t.uniqueActivityId+" "+
          (t.uniqueReferenceNumber||"")+" "+(t.accountNumberMasked||t.accountNumber||"")+" "+(t.subProduct||"")+" "+
          (t.transactionSource||"")+" "+(t.sourceSystem||"")
        );
        if (!hay.includes(s)) return false;
      }

      return true;
    });
  }

  function kpis(filters){
    const st = ensureState();
    const txns = applyTxnFilters(st.transactions, filters);
    const total = txns.length;
    const totalValue = txns.reduce((a,b)=>a+(Number(b.amount)||0),0);
    const completed = txns.filter(t=>t.status==="Completed").length;
    const rej = txns.filter(t=>t.status==="Rejected").length;
    const ret = txns.filter(t=>t.status==="Returned").length;
    const pending = txns.filter(t=>t.status==="Pending").length;
    const completedRate = total? (completed/total)*100 : 0;
    const stp = total? (completed/total)*100 : 0; // demo approximation
    const sla = {Breach:0, Risk:0, Normal:0};
    txns.forEach(t=>{ sla[computeSLAStateFor(t).state]++; });
    const hv = txns.filter(t=>t.riskFlags && t.riskFlags.highValue).length;

    // compute p95 end-to-end time (demo: based on stage index)
    const times = txns.map(t=>{
      const idx = (st.config.stages[t.product]||st.config.stages.default).indexOf(t.currentStage);
      return Math.max(5, idx*20 + randInt(0,25));
    }).sort((a,b)=>a-b);
    const p95 = times.length ? times[Math.floor(times.length*0.95)] : 0;
    const avg = times.length ? (times.reduce((a,b)=>a+b,0)/times.length) : 0;

    return {
      total, totalValue, completedRate, completed, pending, rej, ret,
      stp, avgMins: avg, p95Mins: p95, sla, highValue: hv
    };
  }

  function topReasons(filters){
    const st = ensureState();
    const txns = applyTxnFilters(st.transactions, filters);
    const rej = txns.filter(t=>t.exceptionType==="Reject" && t.reasonCode);
    const ret = txns.filter(t=>t.exceptionType==="Return" && t.reasonCode);
    function agg(list){
      const m = {};
      list.forEach(t=>{ m[t.reasonCode] = (m[t.reasonCode]||0)+1; });
      return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([code,count])=>({
        code, count,
        title: (st.config.reasonCodes.reject.concat(st.config.reasonCodes.ret).find(x=>x.code===code)||{}).title || ""
      }));
    }
    return {reject: agg(rej), ret: agg(ret)};
  }

  function workloadQueue(filters){
    const st = ensureState();
    const txns = applyTxnFilters(st.transactions, filters).filter(t=>t.status!=="Completed");
    const items = txns.map(t=>{
      const sla = computeSLAStateFor(t);
      return {
        txn: t,
        slaState: sla.state,
        remainingMin: sla.remainingMin
      };
    }).filter(x=>x.slaState!=="Normal");
    items.sort((a,b)=>a.remainingMin-b.remainingMin);
    return items.slice(0,50);
  }

  function myQueue(filters){
    const st = ensureState();
    const txns = applyTxnFilters(st.transactions, filters);
    // demo: "my queue" = owned by role family
    const role = st.user.role;
    let group = "L1 Ops";
    if (role.startsWith("Checker")) group = "QC/Control";
    if (role==="Tech") group = "Tech";
    if (role==="Product") group = "Product";
    if (role==="Manager" || role==="Admin") group = "L1 Ops";
    const q = txns.filter(t=>t.owner===group && t.status!=="Completed");
    q.sort((a,b)=>new Date(a.slaDueAt)-new Date(b.slaDueAt));
    return q.slice(0,50);
  }

  function teamQueue(filters){
    const st = ensureState();
    const txns = applyTxnFilters(st.transactions, filters).filter(t=>t.status!=="Completed");
    txns.sort((a,b)=>new Date(a.slaDueAt)-new Date(b.slaDueAt));
    return txns.slice(0,80);
  }

  // ---------- Initiation + QC ----------
  function nextSubmissionId(){
    const st = ensureState();
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,"0");
    const day = String(d.getDate()).padStart(2,"0");
    const prefix = `QC-${y}${m}${day}-`;
    const today = st.initiationRequests.filter(x=>x.id.startsWith(prefix));
    const seq = String(today.length+1).padStart(4,"0");
    return prefix + seq;
  }

  function createInitiationRequest(payload, evidenceRefs){
    const st = ensureState();
    const user = st.user;
    if (!entitlements(user).initiate) throw new Error("Not allowed");
    const id = nextSubmissionId();
    const isHighValue = Number(payload.amount||0) >= st.config.highValueThresholdUSD;
    const req = {
      id,
      status: "Draft",
      createdAt: nowISO(),
      updatedAt: nowISO(),
      submittedAt: null,
      submittedBy: null,
      product: payload.product,
      transactionType: payload.transactionType,
      productBic: payload.productBic,
      branch: payload.branch,
      accountType: payload.accountType,
      coinAccountNumber: payload.coinAccountNumber,
      currency: payload.currency,
      amount: Number(payload.amount),
      valueDate: payload.valueDate,
      linkedTxnId: payload.linkedTxnId || "",
      notes: payload.notes || "",
      evidence: evidenceRefs || [], // [{id,name,size,type}]
      qc: {
        requiresQC2: isHighValue || Number(payload.riskScore||0) >= 80,
        maker: {id:user.id, name:user.name},
        qc1: null,
        qc2: null
      },
      diff: null,
      audit: []
    };
    st.initiationRequests.push(req);
    pushAudit("InitiationRequest", id, "INIT_CREATE", {status:req.status, requiresQC2:req.qc.requiresQC2});
    save(st);
    return req;
  }

  function updateInitiationDraft(id, patch){
    const st = ensureState();
    const req = st.initiationRequests.find(x=>x.id===id);
    if (!req) throw new Error("Not found");
    if (req.status!=="Draft") throw new Error("Immutable after submit");
    Object.assign(req, patch);
    req.updatedAt = nowISO();
    // recompute requiresQC2
    req.qc.requiresQC2 = Number(req.amount||0) >= st.config.highValueThresholdUSD;
    pushAudit("InitiationRequest", id, "INIT_UPDATE", {patchKeys:Object.keys(patch||{})});
    save(st);
    return req;
  }

  function computeDiffForRequest(req){
    const st = ensureState();
    if (!req.linkedTxnId) return null;
    const txn = st.transactions.find(t=>t.id===req.linkedTxnId);
    if (!txn) return null;
    const fields = ["product","productBic","branch","accountType","coinAccountNumber","currency","amount","valueDate","transactionType"];
    const diffs = [];
    fields.forEach(k=>{
      const oldVal = txn[k] ?? "";
      const newVal = req[k] ?? "";
      if (String(oldVal) !== String(newVal)){
        diffs.push({field:k, before:oldVal, after:newVal});
      }
    });
    return {txnId: txn.id, diffs};
  }

  function submitToQC(id){
    const st = ensureState();
    const req = st.initiationRequests.find(x=>x.id===id);
    if (!req) throw new Error("Not found");
    if (req.status!=="Draft") throw new Error("Already submitted");
    if (!req.evidence || req.evidence.length<1) throw new Error("Evidence required");
    req.status = "Pending QC1";
    req.submittedAt = nowISO();
    req.submittedBy = {id: st.user.id, name: st.user.name};
    req.updatedAt = nowISO();
    req.diff = computeDiffForRequest(req);
    pushAudit("InitiationRequest", id, "QC_SUBMIT", {status:req.status});
    createNotification({
      kind:"qc_submit", severity:"warning",
      title:`QC submission ${id}`,
      body:`Pending QC1. ${req.qc.requiresQC2 ? "QC2 will be required after QC1." : "No QC2 required."}`,
      links:{qcId:id, txnId:req.linkedTxnId || null},
      actionRequired:true
    });
    save(st);
    return req;
  }

  function qcDecision(id, lane, decision, comment){
    const st = ensureState();
    const user = st.user;
    const ent = entitlements(user);
    const req = st.initiationRequests.find(x=>x.id===id);
    if (!req) throw new Error("Not found");
    if (!req.evidence || req.evidence.length<1) throw new Error("Evidence required");
    if (decision==="Reject" && (!comment || String(comment).trim().length<3)) throw new Error("Reject requires comment");

    // segregation rules:
    const makerId = req.qc.maker?.id;
    if (user.id===makerId) throw new Error("Maker cannot approve their own request");
    if (lane==="QC1"){
      if (!ent.qc1 && !(user.role==="Manager"||user.role==="Admin")) throw new Error("Not allowed");
      if (req.status!=="Pending QC1") throw new Error("Not in QC1 state");
      req.qc.qc1 = {id:user.id, name:user.name, ts: nowISO(), decision, comment};
      pushAudit("InitiationRequest", id, "QC1_"+decision.toUpperCase(), {comment});
      if (decision==="Reject"){
        req.status = "Rejected";
        createNotification({kind:"qc_reject", severity:"error", title:`QC1 rejected ${id}`, body:comment, links:{qcId:id, txnId:req.linkedTxnId||null}, actionRequired:true});
      } else {
        if (req.qc.requiresQC2){
          req.status = "Pending QC2";
          createNotification({kind:"qc_pending_qc2", severity:"warning", title:`Pending QC2 ${id}`, body:"Requires independent QC2 approval.", links:{qcId:id, txnId:req.linkedTxnId||null}, actionRequired:true});
        } else {
          req.status = "Approved";
          createNotification({kind:"qc_approve", severity:"success", title:`QC approved ${id}`, body:"QC1 approved; request completed.", links:{qcId:id, txnId:req.linkedTxnId||null}, actionRequired:false});
          applyApprovedRequestToTransaction(req);
        }
      }
    } else if (lane==="QC2"){
      if (!ent.qc2 && !(user.role==="Manager"||user.role==="Admin")) throw new Error("Not allowed");
      if (req.status!=="Pending QC2") throw new Error("Not in QC2 state");
      // ensure different approver
      if (req.qc.qc1 && req.qc.qc1.id===user.id) throw new Error("QC2 must be a different approver");
      req.qc.qc2 = {id:user.id, name:user.name, ts: nowISO(), decision, comment};
      pushAudit("InitiationRequest", id, "QC2_"+decision.toUpperCase(), {comment});
      if (decision==="Reject"){
        req.status = "Rejected";
        createNotification({kind:"qc_reject", severity:"error", title:`QC2 rejected ${id}`, body:comment, links:{qcId:id, txnId:req.linkedTxnId||null}, actionRequired:true});
      } else {
        req.status = "Approved";
        createNotification({kind:"qc_approve", severity:"success", title:`QC2 approved ${id}`, body:"Request completed after dual control.", links:{qcId:id, txnId:req.linkedTxnId||null}, actionRequired:false});
        applyApprovedRequestToTransaction(req);
      }
    } else {
      throw new Error("Unknown lane");
    }
    req.updatedAt = nowISO();
    save(st);
    return req;
  }

  function applyApprovedRequestToTransaction(req){
    const st = ensureState();
    if (!req.linkedTxnId) return;
    const txn = st.transactions.find(t=>t.id===req.linkedTxnId);
    if (!txn) return;
    // apply a controlled patch (demo)
    const patch = {
      product: req.product,
      productBic: req.productBic,
      branch: req.branch,
      currency: req.currency,
      amount: req.amount,
      transactionType: req.transactionType
    };
    Object.assign(txn, patch);
    txn.links = txn.links || {incidents:[], tickets:[], assistance:[], qc:[]};
    txn.links.qc.push(req.id);
    txn.audit = txn.audit || [];
    pushAudit("Transaction", txn.id, "ADJUST_APPLIED", {qcId:req.id, patch});
    save(st);
  }

  // ---------- Incidents ----------
  function createIncident(data){
    const st = ensureState();
    if (!entitlements(st.user).createIncident && st.user.role!=="Admin" && st.user.role!=="Manager") throw new Error("Not allowed");
    const id = uuid("INC");
    const inc = {
      id,
      product: data.product || "Combined",
      severity: data.severity || "S2",
      title: data.title || "Incident",
      status: "Declared",
      createdAt: nowISO(),
      updatedAt: nowISO(),
      owner: data.owner || "Tech",
      eta: data.eta || "",
      description: data.description || "",
      linkedTxns: data.linkedTxns || [],
      linkedTickets: data.linkedTickets || [],
      audit: []
    };
    st.incidents.unshift(inc);
    pushAudit("Incident", id, "INC_CREATE", {severity:inc.severity, status:inc.status});
    createNotification({kind:"incident", severity:"error", title:`Incident declared: ${inc.title}`, body:`${inc.severity} • ${inc.product}`, links:{incidentId:id}, actionRequired:true});
    save(st);
    return inc;
  }

  function linkIncidentToTxn(incidentId, txnId){
    const st = ensureState();
    const inc = st.incidents.find(x=>x.id===incidentId);
    const txn = st.transactions.find(x=>x.id===txnId);
    if (!inc || !txn) throw new Error("Not found");
    if (!inc.linkedTxns.includes(txnId)) inc.linkedTxns.push(txnId);
    txn.links = txn.links || {incidents:[], tickets:[], assistance:[], qc:[]};
    if (!txn.links.incidents.includes(incidentId)) txn.links.incidents.push(incidentId);
    inc.updatedAt = nowISO();
    pushAudit("Incident", incidentId, "INC_LINK_TXN", {txnId});
    pushAudit("Transaction", txnId, "LINK_INCIDENT", {incidentId});
    save(st);
  }

  function updateIncident(incidentId, patch){
    const st = ensureState();
    const inc = st.incidents.find(x=>x.id===incidentId);
    if (!inc) throw new Error("Not found");
    Object.assign(inc, patch);
    inc.updatedAt = nowISO();
    pushAudit("Incident", incidentId, "INC_UPDATE", {patchKeys:Object.keys(patch||{})});
    save(st);
    return inc;
  }

  // ---------- Notifications ----------
  function createNotification(n){
    const st = ensureState();
    const id = uuid("NOTIF");
    const rec = Object.assign({
      id,
      createdAt: nowISO(),
      read: false,
      actionRequired: !!n.actionRequired
    }, n);
    st.notifications.unshift(rec);
    pushAudit("Notification", id, "NOTIF_CREATE", {kind:rec.kind, severity:rec.severity});
    save(st);
    return rec;
  }

  function updateNotification(id, patch){
    const st = ensureState();
    const n = st.notifications.find(x=>x.id===id);
    if (!n) throw new Error("Not found");
    Object.assign(n, patch);
    save(st);
    return n;
  }

  function bulkUpdateNotifications(ids, patch){
    const st = ensureState();
    ids.forEach(id=>{
      const n = st.notifications.find(x=>x.id===id);
      if (n) Object.assign(n, patch);
    });
    save(st);
  }

  function deleteNotifications(ids){
    const st = ensureState();
    st.notifications = st.notifications.filter(n=>!ids.includes(n.id));
    save(st);
  }

  // ---------- Search ----------
  function globalSearch(query, limit){
    const st = ensureState();
    const q = String(query||"").trim().toLowerCase();
    if (!q) return [];
    const res = [];
    for (const t of st.transactions){
      const hay = (t.id+" "+t.clientName+" "+t.clientId+" "+t.messageId+" "+t.networkRef+" "+t.uniqueActivityId).toLowerCase();
      if (hay.includes(q)){
        res.push({type:"Transaction", id:t.id, title:`${t.id} • ${t.clientName}`, subtitle:`${t.product} • ${t.currency} ${t.amount} • ${t.status}`});
        if (res.length>=(limit||12)) break;
      }
    }
    if (res.length<(limit||12)){
      for (const qc of st.initiationRequests){
        const hay = (qc.id+" "+(qc.linkedTxnId||"")+" "+qc.product+" "+qc.currency).toLowerCase();
        if (hay.includes(q)){
          res.push({type:"QC", id:qc.id, title:`${qc.id} • ${qc.status}`, subtitle:`${qc.product} • ${qc.currency} ${qc.amount}`});
          if (res.length>=(limit||12)) break;
        }
      }
    }
    return res;
  }

  // ---------- Reports ----------
  function csvEscape(v){
    const s = String(v??"");
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
    return s;
  }
  function toCSV(rows){
    if (!rows.length) return "";
    const cols = Object.keys(rows[0]);
    const head = cols.map(csvEscape).join(",");
    const body = rows.map(r=>cols.map(c=>csvEscape(r[c])).join(",")).join("\n");
    return head + "\n" + body;
  }

  function generateReport(name, filters){
    const st = ensureState();
    const f = filters || {};
    const from = f.from || "";
    const to = f.to || "";
    if (name==="Returns & Rejects Report"){
      const txns = applyTxnFilters(st.transactions, Object.assign({}, f, {exceptionType:"All"}))
        .filter(t=>t.status==="Rejected" || t.status==="Returned");
      const rows = txns.slice(0,5000).map(t=>({
        transaction_id:t.id,
        date_time:t.createdAt,
        product:t.product,
        branch:t.branch,
        client_id:t.clientId,
        client_name:t.clientName,
        type:t.exceptionType,
        currency:t.currency,
        amount:t.amount,
        status:t.status,
        reason:t.reasonCode
      }));
      return {rows, csv: toCSV(rows)};
    }
    if (name==="SLA Compliance Report"){
      const txns = applyTxnFilters(st.transactions, f);
      const rows = txns.slice(0,5000).map(t=>{
        const sla = computeSLAStateFor(t);
        return {
          transaction_id:t.id,
          product:t.product,
          client_id:t.clientId,
          client_name:t.clientName,
          status:t.status,
          stage:t.currentStage,
          created_at:t.createdAt,
          sla_due_at:t.slaDueAt,
          sla_state:sla.state,
          remaining_minutes:sla.remainingMin
        };
      });
      return {rows, csv: toCSV(rows)};
    }
    if (name==="Queue Aging Report"){
      const txns = applyTxnFilters(st.transactions, f).filter(t=>t.status!=="Completed");
      const rows = txns.slice(0,5000).map(t=>{
        const ageMin = Math.floor((Date.now()-new Date(t.createdAt).getTime())/60000);
        const bucket = ageMin<60?"<1h":ageMin<240?"1-4h":ageMin<1440?"4-24h":">24h";
        return {transaction_id:t.id, product:t.product, owner:t.owner, status:t.status, age_minutes:ageMin, age_bucket:bucket, sla_due_at:t.slaDueAt};
      });
      return {rows, csv: toCSV(rows)};
    }
    if (name==="High-Value Adjustments & Approvals"){
      const rows = st.initiationRequests.filter(q=>Number(q.amount||0) >= st.config.highValueThresholdUSD).slice(0,5000).map(q=>({
        submission_id:q.id,
        status:q.status,
        product:q.product,
        currency:q.currency,
        amount:q.amount,
        maker:q.qc.maker?.name||"",
        qc1:q.qc.qc1?.name||"",
        qc2:q.qc.qc2?.name||"",
        evidence_count:(q.evidence||[]).length,
        submitted_at:q.submittedAt||""
      }));
      return {rows, csv: toCSV(rows)};
    }
    if (name==="Maker-Checker Performance Report"){
      const rows = [];
      const map = {};
      st.initiationRequests.forEach(q=>{
        const maker = q.qc.maker?.name || "Unknown";
        const checker = q.qc.qc2?.name || q.qc.qc1?.name || "";
        const type = q.qc.requiresQC2 ? "Dual" : "Single";
        const key = maker+"|"+checker+"|"+type;
        map[key] = map[key] || {maker, checker, type, count:0, total_amount_usd:0, last_activity:""};
        map[key].count += 1;
        map[key].total_amount_usd += Number(q.amount||0);
        map[key].last_activity = q.updatedAt;
      });
      Object.values(map).forEach(x=>rows.push(x));
      return {rows, csv: toCSV(rows)};
    }
    return {rows:[], csv:""};
  }

  // ---------- Evidence storage via IndexedDB ----------
  function idbOpen(){
    return new Promise((resolve,reject)=>{
      const req = indexedDB.open(KEY_EVID, 1);
      req.onupgradeneeded = ()=>{
        const db = req.result;
        if (!db.objectStoreNames.contains("evidence")){
          db.createObjectStore("evidence", {keyPath:"id"});
        }
      };
      req.onsuccess = ()=>resolve(req.result);
      req.onerror = ()=>reject(req.error);
    });
  }

  async function saveEvidenceFile(file){
    const db = await idbOpen();
    const id = uuid("EVID");
    const meta = {id, name:file.name, size:file.size, type:file.type || "application/octet-stream", createdAt: nowISO()};
    return new Promise((resolve,reject)=>{
      const tx = db.transaction("evidence","readwrite");
      tx.objectStore("evidence").put({id, meta, blob:file});
      tx.oncomplete = ()=>resolve(meta);
      tx.onerror = ()=>reject(tx.error);
    });
  }

  async function getEvidenceBlob(id){
    const db = await idbOpen();
    return new Promise((resolve,reject)=>{
      const tx = db.transaction("evidence","readonly");
      const req = tx.objectStore("evidence").get(id);
      req.onsuccess = ()=>resolve(req.result ? req.result.blob : null);
      req.onerror = ()=>reject(req.error);
    });
  }

  async function deleteEvidence(id){
    const db = await idbOpen();
    return new Promise((resolve,reject)=>{
      const tx = db.transaction("evidence","readwrite");
      tx.objectStore("evidence").delete(id);
      tx.oncomplete = ()=>resolve(true);
      tx.onerror = ()=>reject(tx.error);
    });
  }

  // Public API
  window.BP = {
    ensureState,
    saveState: save,
    loadState: load,
    config: () => ensureState().config,
    user: () => ensureState().user,
    setUser: (patch)=>{
      const st = ensureState();
      st.user = Object.assign(st.user||defaultUser(), patch||{});
      save(st);
      pushAudit("User", st.user.id, "USER_UPDATE", {patchKeys:Object.keys(patch||{})});
      return st.user;
    },
    entitlements: () => entitlements(ensureState().user),
    kpis,
    topReasons,
    workloadQueue,
    myQueue,
    teamQueue,
    applyTxnFilters,
    computeSLAStateFor,
    globalSearch,
    pushAudit,
    // entities
    getTransactions: ()=>ensureState().transactions,
    getAccounts: ()=>ensureState().accounts,
    getInitiationRequests: ()=>ensureState().initiationRequests,
    getIncidents: ()=>ensureState().incidents,
    getNotifications: ()=>ensureState().notifications,
    // actions
    createInitiationRequest,
    updateInitiationDraft,
    submitToQC,
    qcDecision,
    createIncident,
    linkIncidentToTxn,
    updateIncident,
    createNotification,
    updateNotification,
    bulkUpdateNotifications,
    deleteNotifications,
    generateReport,
    // evidence
    saveEvidenceFile,
    getEvidenceBlob,
    deleteEvidence
  };
})();
