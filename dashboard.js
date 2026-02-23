
(function(){
  function getFilters(){
    const gf = APP.getGlobalFilters();
    // map to BP filter keys
    return {product: gf.product, from: gf.from, to: gf.to, search: (gf.search||"")};
  }

  function renderChips(kpi){
    const el = UI.qs("#dashChips");
    const chips = [
      {k:"all", label:"All", count:kpi.total},
      {k:"risk", label:"SLA Risk", count:kpi.sla.Risk},
      {k:"breach", label:"SLA Breach", count:kpi.sla.Breach},
      {k:"reject", label:"Rejects", count:kpi.rej},
      {k:"return", label:"Returns", count:kpi.ret},
      {k:"high", label:"High Value", count:kpi.highValue}
    ];
    el.innerHTML = chips.map(c=>`<div class="chip" data-chip="${c.k}">${c.label}<span class="count">${UI.escapeHtml(String(c.count))}</span></div>`).join("");
    UI.qsa("[data-chip]", el).forEach(ch=>{
      ch.addEventListener("click", ()=>{
        const key = ch.getAttribute("data-chip");
        if (key==="reject") location.href = "transactions.html?status=Rejected";
        else if (key==="return") location.href = "transactions.html?status=Returned";
        else if (key==="risk") location.href = "transactions.html?sla=Risk";
        else if (key==="breach") location.href = "transactions.html?sla=Breach";
        else if (key==="high") location.href = "transactions.html?high=1";
        else location.href = "transactions.html";
      });
    });
  }

  function renderKPIs(kpi){
    const el = UI.qs("#kpiStrip");
    const cards = [
      {t:"Total Volume", v:UI.fmtNum(kpi.total), s:"Transactions", dot:"info", action:"transactions.html"},
      {t:"Total Value", v:UI.fmtNum(kpi.totalValue,0), s:"(demo sum of amounts)", dot:"info", action:"transactions.html"},
      {t:"Completed %", v:UI.fmtPct(kpi.completedRate,1), s:`Completed ${kpi.completed} / Pending ${kpi.pending}`, dot:"ok", action:"transactions.html?status=Completed"},
      {t:"Exceptions", v:UI.fmtNum(kpi.rej + kpi.ret), s:`Reject ${kpi.rej} • Return ${kpi.ret}`, dot:"bad", action:"exceptions.html"}
    ];
    el.innerHTML = cards.map(c=>`
      <div class="kpi" data-go="${UI.escapeHtml(c.action)}">
        <div class="t"><span>${c.t}</span><span class="badge kpi">${c.dot==="bad"?"⚠️":"✓"} </span></div>
        <div class="v">${c.v}</div>
        <div class="s">${c.s}</div>
      </div>
    `).join("");
    UI.qsa("[data-go]", el).forEach(x=>x.addEventListener("click", ()=>location.href=x.getAttribute("data-go")));
  }

  function renderTopReasons(top){
    const rejEl = UI.qs("#topRejectReasons");
    const retEl = UI.qs("#topReturnReasons");
    rejEl.innerHTML = top.reject.map(r=>`<div class="chip" data-reason="${r.code}">${r.code}<span class="count">${r.count}</span></div>`).join("") || `<span class="mini">No rejects in current filters.</span>`;
    retEl.innerHTML = top.ret.map(r=>`<div class="chip" data-reason="${r.code}">${r.code}<span class="count">${r.count}</span></div>`).join("") || `<span class="mini">No returns in current filters.</span>`;
    UI.qsa("[data-reason]").forEach(ch=>ch.addEventListener("click", ()=>{
      const code = ch.getAttribute("data-reason");
      location.href = "exceptions.html?reason="+encodeURIComponent(code);
    }));
  }

  function renderIncidents(){
    const inc = BP.getIncidents();
    const active = inc.filter(i=>i.status!=="Resolved");
    if (!active.length){
      UI.qs("#incTile").innerHTML = `<span class="badge ok">No active incidents</span>`;
      return;
    }
    const items = active.slice(0,3).map(i=>{
      return `<div style="display:flex;justify-content:space-between;gap:10px;margin-bottom:8px">
        <div><span class="badge bad">${i.severity}</span> <span style="font-weight:800">${UI.escapeHtml(i.title)}</span><div class="mini">${UI.escapeHtml(i.product)} • ${UI.escapeHtml(i.status)}</div></div>
        <button class="btn small" data-inc="${UI.escapeHtml(i.id)}">Open</button>
      </div>`;
    }).join("");
    UI.qs("#incTile").innerHTML = items + `<div class="mini">${active.length} active</div>`;
    UI.qsa("[data-inc]").forEach(b=>b.addEventListener("click", ()=>location.href=`incidents.html?open=${encodeURIComponent(b.getAttribute("data-inc"))}`));
  }

  function renderQueues(){
    const filters = getFilters();
    const my = BP.myQueue(filters);
    const team = BP.teamQueue(filters);

    function row(t){
      const sla = BP.computeSLAStateFor(t);
      return `
        <tr data-open="${UI.escapeHtml(t.id)}">
          <td class="mono">${UI.escapeHtml(t.id)}</td>
          <td>${UI.escapeHtml(t.clientName)}</td>
          <td>${UI.badgeForStatus(t.status)}</td>
          <td>${UI.badgeForSLA(sla.state)}</td>
          <td class="right">${UI.escapeHtml(t.currency)} ${UI.fmtNum(t.amount,0)}</td>
        </tr>
      `;
    }
    const myBody = UI.qs("#myQueueBody");
    myBody.innerHTML = my.length ? my.map(row).join("") : `<tr><td colspan="5" class="mini">Nothing pending for your role group.</td></tr>`;
    const teamBody = UI.qs("#teamQueueBody");
    teamBody.innerHTML = team.slice(0,12).map(row).join("") || `<tr><td colspan="5" class="mini">No open items.</td></tr>`;
    UI.qsa("tr[data-open]").forEach(tr=>tr.addEventListener("click", ()=>location.href=`transactions.html?open=${encodeURIComponent(tr.getAttribute("data-open"))}`));
  }

  function renderWorkload(){
    const filters = getFilters();
    const items = BP.workloadQueue(filters);
    const risk = items.filter(x=>x.slaState==="Risk").length;
    const breach = items.filter(x=>x.slaState==="Breach").length;
    UI.qs("#riskCount").textContent = "Risk: " + risk;
    UI.qs("#breachCount").textContent = "Breach: " + breach;

    const body = UI.qs("#workloadBody");
    body.innerHTML = items.map(x=>{
      const t = x.txn;
      return `<tr data-open="${UI.escapeHtml(t.id)}">
        <td class="mono">${UI.escapeHtml(t.id)}</td>
        <td>${UI.escapeHtml(t.clientName)}</td>
        <td>${UI.escapeHtml(t.product)}</td>
        <td>${UI.badgeForStatus(t.status)}</td>
        <td>${UI.escapeHtml(t.currentStage)}</td>
        <td>${UI.badgeForSLA(x.slaState)}</td>
        <td>${UI.escapeHtml(UI.durMinToText(x.remainingMin))}</td>
        <td>${UI.escapeHtml(t.owner)}</td>
        <td>${UI.escapeHtml(t.nextAction||"")}</td>
      </tr>`;
    }).join("") || `<tr><td colspan="9" class="mini">No SLA risk/breach in this window.</td></tr>`;

    UI.qsa("#workloadBody tr[data-open]").forEach(tr=>tr.addEventListener("click", ()=>location.href=`transactions.html?open=${encodeURIComponent(tr.getAttribute("data-open"))}`));
  }

  function renderTrends(){
    // basic bar chart using counts by time bucket
    const gf = APP.getGlobalFilters();
    const filters = getFilters();
    const txns = BP.applyTxnFilters(BP.getTransactions(), filters);
    const gran = gf.granularity || "Daily";

    const buckets = [];
    const labels = [];
    const values = [];
    const end = new Date(filters.to || new Date().toISOString().slice(0,10));
    const start = new Date(filters.from || new Date(Date.now()-30*86400000).toISOString().slice(0,10));

    function keyFor(d){
      const y=d.getFullYear();
      const m=String(d.getMonth()+1).padStart(2,"0");
      const day=String(d.getDate()).padStart(2,"0");
      if (gran==="Monthly") return `${y}-${m}`;
      if (gran==="Weekly"){
        // ISO week approx: use Monday-based
        const tmp=new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        const dayNum=tmp.getUTCDay()||7;
        tmp.setUTCDate(tmp.getUTCDate()+4-dayNum);
        const yearStart=new Date(Date.UTC(tmp.getUTCFullYear(),0,1));
        const week=Math.ceil((((tmp-yearStart)/86400000)+1)/7);
        return `${tmp.getUTCFullYear()}-W${String(week).padStart(2,"0")}`;
      }
      if (gran==="Hourly") return `${y}-${m}-${day} ${String(d.getHours()).padStart(2,"0")}:00`;
      return `${y}-${m}-${day}`;
    }

    // build all buckets in range, but cap at 60 for demo
    let cursor = new Date(start);
    let steps=0;
    while (cursor <= end && steps<60){
      const k = keyFor(cursor);
      if (!buckets.includes(k)) buckets.push(k);
      if (gran==="Monthly") cursor.setMonth(cursor.getMonth()+1);
      else if (gran==="Weekly") cursor = new Date(cursor.getTime() + 7*86400000);
      else if (gran==="Hourly") cursor = new Date(cursor.getTime() + 3600000);
      else cursor = new Date(cursor.getTime() + 86400000);
      steps++;
    }
    const map = {};
    buckets.forEach(b=>map[b]=0);
    txns.forEach(t=>{
      const d = new Date(t.createdAt);
      const k = keyFor(d);
      if (map[k]!==undefined) map[k] += 1;
    });
    buckets.forEach(b=>{
      labels.push(b.length>10 ? b.slice(5) : b);
      values.push(map[b]);
    });
    const canvas = UI.qs("#trendBars");
    // scale canvas for DPR
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(260 * dpr);
    canvas.style.height = "260px";
    UI.drawBar(canvas, labels.slice(-12), values.slice(-12));
    UI.qs("#trendMeta").textContent = `${gran} buckets • Showing last ${Math.min(12, labels.length)} • Total ${txns.length}`;
  }

  function renderAll(){
    const f = getFilters();
    const kpi = BP.kpis(f);
    renderChips(kpi);
    renderKPIs(kpi);
    renderTopReasons(BP.topReasons(f));
    renderIncidents();
    renderQueues();
    renderWorkload();
    renderTrends();
  }

  document.addEventListener("bp:filtersChanged", renderAll);
  document.addEventListener("DOMContentLoaded", ()=>{
    UI.qs("#refreshRadar").addEventListener("click", ()=>{ renderAll(); UI.toast("Refreshed","Radar updated"); });
  });
})();
