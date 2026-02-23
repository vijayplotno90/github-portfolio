
(function(){
  const nowBadge = document.getElementById("nowBadge");
  const resetBtn = document.getElementById("resetData");
  if(nowBadge){
    const tick = ()=> nowBadge.textContent = new Date().toLocaleString(undefined, {weekday:"short", year:"numeric", month:"short", day:"2-digit", hour:"2-digit", minute:"2-digit"});
    tick(); setInterval(tick, 15000);
  }
  if(resetBtn){
    resetBtn.onclick = ()=>{
      CT.store.reset();
      location.href = "index.html";
    };
  }

  const gotoIncidents = document.getElementById("gotoIncidents");
  if(gotoIncidents) gotoIncidents.onclick = ()=> location.href = "incidents.html";

  window.addEventListener("ct:filters", (e)=> render(e.detail));
  render(readFiltersFromUrl());

  function readFiltersFromUrl(){
    const u = new URL(location.href);
    return {
      product: u.searchParams.get("product") || "combined",
      from: u.searchParams.get("from") || "",
      to: u.searchParams.get("to") || "",
      granularity: u.searchParams.get("granularity") || "day",
      q: u.searchParams.get("q") || ""
    };
  }

  function render(filters){
    // SLA risk scan for the selected scope
    CT.scanSlaAndNotify(filters);

    const k = CT.computeKPIs(filters);
    renderChips(k, filters);
    renderTrend(filters);
    renderRadar(k, filters);
    renderTopReasons(filters);
    renderQueues(filters);
    renderIncidents(filters);

    // Badges
    document.getElementById("slaRiskBadge").textContent = `SLA: ${k.sla["Near-breach"] + k.sla["At-risk"]} at-risk • ${k.sla["Breached"]} breached`;
    document.getElementById("stpBadge").textContent = `STP ${k.stpPct}% • Avg ${k.avgMins}m • P95 ${k.p95Mins}m`;
    const inc = CT.getIncidents().filter(i=>i.status!=="Resolved");
    document.getElementById("activeIncidentsBadge").textContent = `Incidents: ${inc.length}`;
  }

  function renderChips(k, filters){
    const cfg = CT.getConfig();
    const txns = CT.filterTxns(filters);

    const hv = txns.filter(t=>t.riskFlags && t.riskFlags.highValue).length;
    const qc2Waiting = CT.getQC().filter(q=> q.requiresSecondCheck && q.overallStatus==="Pending QC2").length;

    const chips = [
      {label:"Total Volume", value: k.total, meta:"click to drill", onClick: ()=> goTx({})},
      {label:"Total Value", value: CT.fmtMoney(k.sumValue, "USD"), meta:"proxy sum", onClick: ()=> goTx({})},
      {label:"Completed", value:`${k.completedPct}%`, meta:`${k.completed} txns`, onClick: ()=> goTx({status:"Completed"})},
      {label:"Pending", value:`${k.pendingPct}%`, meta:`${k.pending} txns`, onClick: ()=> goTx({status:"Pending"})},
      {label:"Rejected", value:`${k.rejectPct}%`, meta:`${k.rejected} txns`, onClick: ()=> goTx({status:"Rejected"})},
      {label:"Returned", value:`${k.returnPct}%`, meta:`${k.returned} txns`, onClick: ()=> goTx({status:"Returned"})},
      {label:"SLA Breached", value:k.sla["Breached"], meta:"requires owner + reason", onClick: ()=> goTx({sla:"Breached"})},
      {label:"SLA Near-breach", value:k.sla["Near-breach"], meta:"T-10 window", onClick: ()=> goTx({sla:"Near-breach"})},
      {label:"High-value (≥ 5M)", value: hv, meta:"QC2 gate on adjustments", onClick: ()=> goTx({highValue:1})},
      {label:"Awaiting QC2", value: qc2Waiting, meta:"control segregation", onClick: ()=> location.href="qc.html"}
    ];

    const host = document.getElementById("kpiChips");
    host.innerHTML = chips.map((c,i)=> `
      <div class="chip" data-i="${i}">
        <div class="label">${c.label}</div>
        <div class="value">${c.value}</div>
        <div class="meta">${c.meta}</div>
      </div>
    `).join("");
    host.querySelectorAll(".chip").forEach(el=>{
      const i = Number(el.dataset.i);
      el.onclick = ()=> chips[i].onClick();
    });

    function goTx(extra){
      const u = new URL(location.origin + location.pathname.replace("index.html","transactions.html"));
      // carry global filters
      u.searchParams.set("product", filters.product || "combined");
      if(filters.from) u.searchParams.set("from", filters.from);
      if(filters.to) u.searchParams.set("to", filters.to);
      if(filters.granularity) u.searchParams.set("granularity", filters.granularity);

      // extras
      Object.entries(extra).forEach(([k,v])=>{
        u.searchParams.set(k, String(v));
      });
      location.href = u.toString();
    }
  }

  function renderTrend(filters){
    const txns = CT.filterTxns(filters);
    const g = filters.granularity || "day";
    const buckets = bucketize(txns, g);

    const vol = buckets.map(b=>b.count);
    const val = buckets.map(b=>b.value);

    const chart = document.getElementById("trendChart");
    chart.innerHTML = `
      <div class="small">Buckets: ${buckets.length} • ${bucketLabel(g)} • Range: ${filters.from} → ${filters.to}</div>
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-top:10px;">
        <div class="card" style="padding:10px; background: rgba(0,0,0,0.10); border-radius: 16px;">
          <div class="small">Volume</div>
          ${UI.sparkline(vol, "var(--brand)")}
          <div class="small">Latest: <span class="mono">${vol[vol.length-1] || 0}</span></div>
        </div>
        <div class="card" style="padding:10px; background: rgba(0,0,0,0.10); border-radius: 16px;">
          <div class="small">Value (proxy, USD sum)</div>
          ${UI.sparkline(val.map(x=>Math.round(x/1000000)), "var(--brand2)")}
          <div class="small">Latest: <span class="mono">${(Math.round((val[val.length-1]||0)/100000)/10)}M</span></div>
        </div>
      </div>
      <div class="hr"></div>
      <div class="small mono" style="opacity:.9;">Tip: Use View toggle (Month/Week/Day/Hour) to change aggregation.</div>
    `;

    const dl = document.getElementById("downloadTrendCsv");
    dl.onclick = ()=>{
      const rows = buckets.map(b=>({bucket:b.key, volume:b.count, value:b.value}));
      const csv = rowsToCsv(rows);
      CT.downloadText("trend.csv", csv, "text/csv");
    };
  }

  function renderRadar(k, filters){
    const txns = CT.filterTxns(filters);
    const cfg = CT.getConfig();
    const pending = txns.filter(t=> t.status==="Pending" || t.status==="Manual hold").length;
    const qcPending = CT.getQC().filter(q=> q.overallStatus.startsWith("Pending")).length;
    const atRisk = k.sla["Near-breach"] + k.sla["At-risk"];
    const breached = k.sla["Breached"];

    const spike = computeSpike(txns);
    const spikeText = spike ? `${spike.kind} +${spike.pct}% WoW` : "No spike detected";

    const tiles = [
      {k:"Pending", v: pending, s:"transactions waiting", on:()=> navTx({status:"Pending"})},
      {k:"Checker Queue", v: qcPending, s:"QC pending items", on:()=> location.href="qc.html"},
      {k:"SLA At-risk", v: atRisk, s:"near-breach exposure", on:()=> navTx({sla:"At-risk"})},
      {k:"SLA Breached", v: breached, s:"requires reason + ack", on:()=> navTx({sla:"Breached"})},
      {k:"Spike", v: spikeText, s:"anomaly vs prior window", on:()=> location.href="exceptions.html"},
      {k:"High-value", v: `${txns.filter(t=>t.riskFlags && t.riskFlags.highValue).length}`, s:`≥ ${cfg.thresholds.highValueAmount.toLocaleString()}`, on:()=> navTx({highValue:1})}
    ];

    const host = document.getElementById("radarTiles");
    host.innerHTML = tiles.map((t,i)=> `
      <div class="kpi" data-i="${i}">
        <div class="k">${t.k}</div>
        <div class="v">${t.v}</div>
        <div class="s">${t.s}</div>
      </div>
    `).join("");
    host.querySelectorAll(".kpi").forEach(el=>{
      const i = Number(el.dataset.i);
      el.onclick = tiles[i].on;
    });

    function navTx(extra){
      const u = new URL(location.origin + location.pathname.replace("index.html","transactions.html"));
      u.searchParams.set("product", filters.product || "combined");
      if(filters.from) u.searchParams.set("from", filters.from);
      if(filters.to) u.searchParams.set("to", filters.to);
      if(filters.granularity) u.searchParams.set("granularity", filters.granularity);
      Object.entries(extra).forEach(([k,v])=> u.searchParams.set(k, String(v)));
      location.href = u.toString();
    }
  }

  function renderTopReasons(filters){
    const txns = CT.filterTxns(filters);
    const rej = topReasons(txns.filter(t=>t.status==="Rejected"));
    const ret = topReasons(txns.filter(t=>t.status==="Returned"));

    const host = document.getElementById("topReasons");
    host.innerHTML = `
      <div class="split">
        <div>
          <div class="small">Top Reject Reasons</div>
          ${reasonList(rej, "Rejected")}
        </div>
        <div>
          <div class="small">Top Return Reasons</div>
          ${reasonList(ret, "Returned")}
        </div>
      </div>
    `;
  }

  function reasonList(arr, status){
    if(!arr.length) return `<div class="small" style="margin-top:8px;">No ${status.toLowerCase()} items in range.</div>`;
    return `
      <table class="table">
        <thead><tr><th>Reason</th><th class="right">Count</th></tr></thead>
        <tbody>
          ${arr.slice(0,5).map(r=>`
            <tr data-reason="${r.code}">
              <td><span class="mono">${r.code}</span> <span class="small">•</span> ${r.text}</td>
              <td class="right mono">${r.count}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  function renderQueues(filters){
    const txns = CT.filterTxns(filters).filter(t=> t.status!=="Completed");
    const u = CT.getUser();

    const withSla = txns.map(t=>{
      const s = CT.slaState(t);
      return {...t, _slaState: s.state, _minsLeft: s.minsLeft, _ageMins: Math.floor((Date.now() - new Date(t.createdAt).getTime())/60000)};
    });

    // sort: SLA due soonest, then value, then age
    withSla.sort((a,b)=>{
      const da = new Date(a.slaDueAt).getTime(), db = new Date(b.slaDueAt).getTime();
      if(da!==db) return da-db;
      if((b.amount||0)!==(a.amount||0)) return (b.amount||0)-(a.amount||0);
      return (b._ageMins||0)-(a._ageMins||0);
    });

    const mine = withSla.filter(t=> {
      if(u.role==="maker") return t.owner==="L1 Ops";
      if(u.role==="checker") return t.status==="Manual hold" || (t.riskFlags && t.riskFlags.highValue);
      if(u.role==="support") return t.exceptionType !== null;
      if(u.role==="tech") return t.currentStage==="Network submission" || t.currentStage==="Settlement";
      return true;
    }).slice(0,8);

    const team = withSla.slice(0,10);

    renderQueueTable("myQueueTbl", mine);
    renderQueueTable("teamQueueTbl", team);
  }

  function renderQueueTable(id, rows){
    const host = document.getElementById(id);
    host.innerHTML = `
      <thead>
        <tr>
          <th>Txn</th><th>Client</th><th>Status</th><th>SLA</th><th class="right">Amount</th><th>Next action</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(t=>{
          const s = CT.slaState(t);
          const tag = s.state==="Breached" ? "bad" : s.state==="Near-breach" ? "warn" : s.state==="At-risk" ? "warn" : "good";
          return `
          <tr data-txn="${t.txnId}">
            <td class="mono nowrap">${t.txnId}</td>
            <td>${t.clientName}</td>
            <td><span class="tag ${t.status==="Rejected"||t.status==="Returned" ? "bad" : t.status==="Manual hold" ? "warn" : "info"}">${t.status}</span></td>
            <td><span class="tag ${tag}">${s.state} • ${s.minsLeft}m</span></td>
            <td class="right mono nowrap">${CT.fmtMoney(t.amount, t.currency)}</td>
            <td>${t.nextAction}</td>
          </tr>`;
        }).join("")}
      </tbody>
    `;

    host.querySelectorAll("tr[data-txn]").forEach(tr=>{
      tr.onclick = ()=> openTxnDetail(tr.dataset.txn);
    });
  }

  function renderIncidents(filters){
    const inc = CT.getIncidents();
    const host = document.getElementById("incidentTbl");
    host.innerHTML = `
      <thead><tr><th>Incident</th><th>Product</th><th>Severity</th><th>Status</th><th>Title</th><th>ETA</th></tr></thead>
      <tbody>
        ${inc.slice(0,6).map(i=>`
          <tr data-inc="${i.incidentId}">
            <td class="mono">${i.incidentId}</td>
            <td>${i.product.toUpperCase()}</td>
            <td><span class="tag ${i.severity==="S1"||i.severity==="S2"?"warn":"info"}">${i.severity}</span></td>
            <td>${i.status}</td>
            <td>${i.title}</td>
            <td class="nowrap">${i.eta ? CT.fmtDT(i.eta) : "—"}</td>
          </tr>
        `).join("")}
      </tbody>
    `;
    host.querySelectorAll("tr[data-inc]").forEach(tr=>{
      tr.onclick = ()=> location.href = `incidents.html?incident=${encodeURIComponent(tr.dataset.inc)}`;
    });
  }

  function openTxnDetail(txnId){
    // Delegate to Transactions page if you need full drilldown. Here we show a quick drawer.
    const t = CT.getTransactions().find(x=>x.txnId===txnId);
    if(!t) return;
    const s = CT.slaState(t);
    UI.openDrawer(detailHtml(t, s), `Transaction ${txnId}`);
    UI.setDrawerMeta(`${t.clientName} • ${t.product.toUpperCase()} • ${t.status} • ${t.currentStage}`);
    UI.setDrawerActions([
      {label:"Open in Transactions", kind:"primary", onClick: ()=> location.href=`transactions.html?q=${encodeURIComponent(txnId)}&open=1`},
      {label:"Close", onClick: UI.closeDrawer}
    ]);
  }

  function detailHtml(t, s){
    const cfg = CT.getConfig();
    const stages = cfg.stages;
    const done = new Set((t.stages||[]).map(x=>x.stage));
    const current = t.currentStage;
    return `
      <div class="card" style="padding:10px; background: rgba(0,0,0,0.14);">
        <div class="row" style="justify-content:space-between;">
          <span class="tag ${t.status==="Completed"?"good":t.status==="Pending"?"info":"warn"}">${t.status}</span>
          <span class="tag ${s.state==="Breached"?"bad":(s.state==="Near-breach"||s.state==="At-risk")?"warn":"good"}">SLA ${s.state} • ${s.minsLeft}m</span>
        </div>
        <div class="hr"></div>
        <div class="small">Amount</div>
        <div style="font-size:22px; font-weight:800;">${CT.fmtMoney(t.amount, t.currency)}</div>
        <div class="small" style="margin-top:8px;">Created: <span class="mono">${CT.fmtDT(t.createdAt)}</span></div>
        <div class="small">Due: <span class="mono">${CT.fmtDT(t.slaDueAt)}</span></div>
      </div>

      <div style="margin-top:12px;">
        <div class="small">Lifecycle roadmap</div>
        <div class="roadmap">
          ${stages.map(st=>{
            const isDone = done.has(st);
            const isNow = st===current;
            const stamp = (t.stages||[]).find(x=>x.stage===st);
            return `
              <div class="step ${isDone?"done":""} ${isNow?"now":""}">
                <div class="dot"></div>
                <div class="meta">
                  <div class="name">${st}</div>
                  <div class="time">${stamp ? CT.fmtDT(stamp.at) : "—"}</div>
                  <div class="actor">${stamp ? stamp.actor : ""}</div>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  function bucketLabel(g){
    if(g==="hour") return "daily steps (hour mode)";
    if(g==="day") return "daily";
    if(g==="week") return "weekly";
    return "monthly";
  }

  function bucketize(txns, granularity){
    const map = new Map();
    for(const t of txns){
      const d = new Date(t.createdAt);
      const key = keyFor(d, granularity);
      const cur = map.get(key) || {key, count:0, value:0};
      cur.count += 1;
      cur.value += (t.amount || 0);
      map.set(key, cur);
    }
    const arr = Array.from(map.values()).sort((a,b)=> a.key.localeCompare(b.key));
    // ensure stable length (at least 6)
    return arr.length ? arr : [{key:"—", count:0, value:0}];
  }

  function keyFor(d, g){
    const y=d.getFullYear();
    const m=String(d.getMonth()+1).padStart(2,"0");
    const day=String(d.getDate()).padStart(2,"0");
    if(g==="month") return `${y}-${m}`;
    if(g==="week"){
      const onejan = new Date(d.getFullYear(),0,1);
      const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay()+1)/7);
      return `${y}-W${String(week).padStart(2,"0")}`;
    }
    // day/hour -> day bucket for demo
    return `${y}-${m}-${day}`;
  }

  function rowsToCsv(rows){
    if(!rows.length) return "";
    const cols = Object.keys(rows[0]);
    const esc = (v)=>{
      const s = (v===null||v===undefined) ? "" : String(v);
      if(/[",\n]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
      return s;
    };
    return [cols.join(","), ...rows.map(r=>cols.map(c=>esc(r[c])).join(","))].join("\n");
  }

  function topReasons(rows){
    const m = new Map();
    for(const t of rows){
      const code = t.reasonCode || "—";
      const text = t.reasonText || "Unknown";
      const k = code+"|"+text;
      m.set(k, (m.get(k)||0)+1);
    }
    const arr = Array.from(m.entries()).map(([k,count])=>{
      const [code,text] = k.split("|");
      return {code,text,count};
    }).sort((a,b)=> b.count-a.count);
    return arr;
  }

  function computeSpike(txns){
    const now = new Date();
    const end = now.getTime();
    const start7 = end - 7*86400000;
    const start14 = end - 14*86400000;

    const recent = txns.filter(t=> {
      const tt = new Date(t.createdAt).getTime();
      return tt >= start7 && tt <= end;
    });
    const prior = txns.filter(t=>{
      const tt = new Date(t.createdAt).getTime();
      return tt >= start14 && tt < start7;
    });

    const rrej = recent.filter(t=>t.status==="Rejected").length;
    const rret = recent.filter(t=>t.status==="Returned").length;
    const prej = prior.filter(t=>t.status==="Rejected").length || 1;
    const pret = prior.filter(t=>t.status==="Returned").length || 1;

    const rejPct = Math.round(((rrej - prej)/prej)*100);
    const retPct = Math.round(((rret - pret)/pret)*100);

    const threshold = 20;
    if(rejPct >= threshold) return {kind:"Rejects", pct: rejPct};
    if(retPct >= threshold) return {kind:"Returns", pct: retPct};
    return null;
  }

})();
