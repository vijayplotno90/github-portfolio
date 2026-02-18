
(function(){
  let mode = "rejects"; // rejects/returns
  let selectedReason = null;

  function getFilters(){
    const gf = APP.getGlobalFilters();
    return {product: gf.product, from: gf.from, to: gf.to};
  }

  function setMode(m){
    mode = m;
    UI.qsa("#exTabs .tab").forEach(t=>t.classList.toggle("active", t.getAttribute("data-tab")===m));
    UI.qs("#exTitle").textContent = m==="rejects" ? "Reject Reasons" : "Return Reasons";
    render();
  }

  function reasonsList(){
    const st = BP.ensureState();
    return mode==="rejects" ? st.config.reasonCodes.reject : st.config.reasonCodes.ret;
  }

  function filteredTxns(){
    const f = getFilters();
    const txns = BP.applyTxnFilters(BP.getTransactions(), f);
    if (mode==="rejects") return txns.filter(t=>t.status==="Rejected");
    return txns.filter(t=>t.status==="Returned");
  }

  function renderReasonChips(){
    const txns = filteredTxns();
    const list = reasonsList();
    const map = {};
    txns.forEach(t=>{
      if (!t.reasonCode) return;
      map[t.reasonCode] = (map[t.reasonCode]||0)+1;
    });
    const ordered = Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,12);
    const el = UI.qs("#reasonChips");
    if (!ordered.length){
      el.innerHTML = `<span class="mini">No ${mode==="rejects"?"rejects":"returns"} in current filters.</span>`;
      return;
    }
    el.innerHTML = ordered.map(([code,count])=>{
      const meta = list.find(x=>x.code===code) || {};
      const cls = meta.severity==="error" ? "bad" : (meta.severity==="warning" ? "warn" : "");
      const active = selectedReason===code ? "active" : "";
      return `<div class="chip ${active}" data-reason="${UI.escapeHtml(code)}">${UI.escapeHtml(code)} <span class="count">${count}</span></div>`;
    }).join("");
    UI.qsa("[data-reason]").forEach(ch=>ch.addEventListener("click", ()=>{
      selectedReason = ch.getAttribute("data-reason");
      renderPlaybook();
      renderReasonChips();
    }));
  }

  function renderHeatmap(){
    const txns = filteredTxns();
    const map = {};
    txns.forEach(t=>{
      const key = t.clientName+"|"+t.currency;
      map[key] = (map[key]||0)+1;
    });
    const rows = Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,30).map(([k,count])=>{
      const [client,cur]=k.split("|");
      return {client,cur,count};
    });
    const body = UI.qs("#heatBody");
    body.innerHTML = rows.map(r=>`
      <tr>
        <td>${UI.escapeHtml(r.client)}</td>
        <td>${UI.escapeHtml(r.cur)}</td>
        <td class="right">${UI.escapeHtml(String(r.count))}</td>
      </tr>
    `).join("") || `<tr><td colspan="3" class="mini">No data.</td></tr>`;
  }

  function renderPlaybook(){
    const st = BP.ensureState();
    const code = selectedReason || APP.params().reason;
    if (!code){
      UI.qs("#playbookPanel").innerHTML = `<div class="mini">Select a reason code to view playbook.</div>`;
      return;
    }
    const pb = st.config.playbooks[code];
    if (!pb){
      UI.qs("#playbookPanel").innerHTML = `
        <div class="badge warn">No playbook configured for ${UI.escapeHtml(code)}</div>
        <div class="mini" style="margin-top:8px">Add it in config.playbooks to standardize fixes.</div>
      `;
      return;
    }
    UI.qs("#playbookPanel").innerHTML = `
      <div class="chips" style="margin-bottom:10px">
        <span class="badge bad">${UI.escapeHtml(code)}</span>
        <a class="btn small" href="transactions.html?reason=${encodeURIComponent(code)}">Open Transactions</a>
      </div>

      <div class="mini" style="font-weight:800;color:var(--text);margin-top:10px">Symptoms</div>
      <ul class="mini">${pb.symptoms.map(s=>`<li>${UI.escapeHtml(s)}</li>`).join("")}</ul>

      <div class="mini" style="font-weight:800;color:var(--text);margin-top:10px">Likely root causes</div>
      <ul class="mini">${pb.causes.map(s=>`<li>${UI.escapeHtml(s)}</li>`).join("")}</ul>

      <div class="mini" style="font-weight:800;color:var(--text);margin-top:10px">Fix steps (Ops)</div>
      <ol class="mini">${pb.fixes.map(s=>`<li>${UI.escapeHtml(s)}</li>`).join("")}</ol>

      <div class="mini" style="font-weight:800;color:var(--text);margin-top:10px">Escalate when</div>
      <ul class="mini">${pb.escalate.map(s=>`<li>${UI.escapeHtml(s)}</li>`).join("")}</ul>

      <div class="mini" style="font-weight:800;color:var(--text);margin-top:10px">Required evidence</div>
      <ul class="mini">${pb.evidence.map(s=>`<li>${UI.escapeHtml(s)}</li>`).join("")}</ul>
    `;
  }

  function render(){
    renderReasonChips();
    renderHeatmap();
    renderPlaybook();
  }

  document.addEventListener("DOMContentLoaded", ()=>{
    UI.qsa("#exTabs .tab").forEach(tab=>{
      tab.addEventListener("click", ()=>setMode(tab.getAttribute("data-tab")));
    });
    // auto select from query param
    const qp = APP.params().reason;
    if (qp) selectedReason = qp;
    // default mode from query param type
    const type = APP.params().type;
    if (type==="return") setMode("returns");
    else setMode("rejects");
    render();
  });
  document.addEventListener("bp:filtersChanged", render);
})();
