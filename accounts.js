
(function(){
  let f = {
    clientName:"", clientId:"", status:"All", currency:"All", branch:"All", from:"", to:""
  };

  function populate(){
    const st = BP.ensureState();
    const cur = UI.qs("#aCur");
    const br = UI.qs("#aBranch");
    st.config.currencies.forEach(c=>cur.insertAdjacentHTML("beforeend", `<option>${c}</option>`));
    st.config.branches.forEach(b=>br.insertAdjacentHTML("beforeend", `<option>${b}</option>`));
  }

  function read(){
    f.clientName = UI.qs("#aClientName").value.trim();
    f.clientId = UI.qs("#aClientId").value.trim();
    f.status = UI.qs("#aStatus").value;
    f.currency = UI.qs("#aCur").value;
    f.branch = UI.qs("#aBranch").value;
    f.from = UI.qs("#aFrom").value;
    f.to = UI.qs("#aTo").value;
  }

  function apply(accounts){
    return accounts.filter(a=>{
      if (f.clientName && !a.clientName.toLowerCase().includes(f.clientName.toLowerCase())) return false;
      if (f.clientId && !a.clientId.toLowerCase().includes(f.clientId.toLowerCase())) return false;
      if (f.status!=="All" && a.status!==f.status) return false;
      if (f.currency!=="All" && a.currency!==f.currency) return false;
      if (f.branch!=="All" && a.branch!==f.branch) return false;
      if (f.from && new Date(a.openDate) < new Date(f.from)) return false;
      if (f.to && new Date(a.openDate) > new Date(f.to)) return false;
      return true;
    });
  }

  function render(){
    read();
    const st = BP.ensureState();
    let accounts = apply(st.accounts);
    accounts.sort((a,b)=>b.currentBalance-a.currentBalance);

    const body = UI.qs("#acctBody");
    body.innerHTML = accounts.slice(0,250).map(a=>`
      <tr data-open="${UI.escapeHtml(a.id)}">
        <td class="mono">${UI.escapeHtml(String(a.blockchainAccountNumber))}</td>
        <td>${UI.escapeHtml(a.accountName)}</td>
        <td>${UI.escapeHtml(a.branch)}<div class="mini">${UI.escapeHtml(a.branchName)}</div></td>
        <td>${UI.escapeHtml(a.accountType)}</td>
        <td>${UI.escapeHtml(a.currency)}</td>
        <td class="right">${UI.fmtNum(a.currentBalance,0)}</td>
        <td class="right">${UI.fmtNum(a.availableBalance,0)}</td>
        <td class="mini">${UI.escapeHtml(UI.fmtDT(a.asOf))}</td>
        <td>${UI.escapeHtml(a.clientName)}<div class="mini">${UI.escapeHtml(a.clientId)}</div></td>
        <td>${a.status==="Active"?'<span class="badge ok">Active</span>':(a.status==="Onboarding"?'<span class="badge warn">Onboarding</span>':'<span class="badge">Dormant</span>')}</td>
      </tr>
    `).join("") || `<tr><td colspan="10" class="mini">No results.</td></tr>`;

    UI.qs("#acctMeta").textContent = `Showing ${Math.min(250, accounts.length)} of ${accounts.length} • Click row for details.`;

    UI.qsa("#acctBody tr[data-open]").forEach(tr=>tr.addEventListener("click", ()=>openAcct(tr.getAttribute("data-open"))));
  }

  function openAcct(id){
    const st = BP.ensureState();
    const a = st.accounts.find(x=>x.id===id);
    if (!a) return;
    const recent = st.transactions
      .filter(t=>String(t.accountNumber)===String(a.blockchainAccountNumber))
      .sort((x,y)=>new Date(y.createdAt).getTime()-new Date(x.createdAt).getTime())
      .slice(0,12);

    const miniTxns = recent.length ? `
      <div class="table-wrap slim" style="margin-top:10px">
        <table class="table">
          <thead><tr><th>Txn ID</th><th>Status</th><th class="right">Amount</th><th>Created</th><th class="right">Open</th></tr></thead>
          <tbody>
            ${recent.map(t=>`
              <tr>
                <td class="mono">${UI.escapeHtml(t.id)}</td>
                <td>${UI.badgeForStatus(t.status)}</td>
                <td class="right">${UI.fmtNum(t.amount,0)}</td>
                <td>${UI.escapeHtml(UI.fmtDT(t.createdAt))}</td>
                <td class="right"><button class="btn small" data-open-txn="${UI.escapeHtml(t.id)}">Open</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : `<div class="mini">No transactions linked to this account in the sample dataset.</div>`;
    const body = `
      <div class="chips" style="margin-bottom:10px">
        <span class="badge">${UI.escapeHtml(a.status)}</span>
        <span class="badge">As of: ${UI.escapeHtml(UI.fmtDT(a.asOf))}</span>
        <span class="badge">Product: ${UI.escapeHtml(a.product||"—")}</span>
      </div>

      <div class="chips" style="margin-bottom:10px">
        <button class="btn small primary" data-acct-tab="overview">Overview</button>
        <button class="btn small" data-acct-tab="balances">Balances</button>
        <button class="btn small" data-acct-tab="limits">Limits & Controls</button>
        <button class="btn small" data-acct-tab="activity">Activity</button>
      </div>

      <div data-acct-pane="overview">
        <div class="filters">
          <div class="f w6"><label>Account</label><div class="mono">${UI.escapeHtml(a.id)}</div></div>
          <div class="f w6"><label>Blockchain Account #</label><div class="mono">${UI.escapeHtml(String(a.blockchainAccountNumber))}</div></div>
          <div class="f w12"><label>Name</label><div>${UI.escapeHtml(a.accountName)}</div></div>
          <div class="f w6"><label>Client</label><div>${UI.escapeHtml(a.clientName)} <span class="mini">(${UI.escapeHtml(a.clientId)})</span></div></div>
          <div class="f w3"><label>Currency</label><div>${UI.escapeHtml(a.currency)}</div></div>
          <div class="f w3"><label>Type</label><div>${UI.escapeHtml(a.accountType)}</div></div>
          <div class="f w6"><label>Branch</label><div>${UI.escapeHtml(a.branch)} <span class="mini">${UI.escapeHtml(a.branchName)}</span></div></div>
          <div class="f w6"><label>Open Date</label><div>${UI.escapeHtml(UI.fmtDT(a.openDate))}</div></div>
        </div>
        <hr/>
        <div class="mini" style="font-weight:800;color:var(--text);margin-bottom:8px">Onboarding checklist (demo)</div>
        <div class="chips">
          <span class="badge ok">KYC</span>
          <span class="badge ok">Rail mapping</span>
          <span class="badge warn">Limits review</span>
          <span class="badge">Restrictions: none</span>
        </div>
      </div>

      <div data-acct-pane="balances" style="display:none">
        <div class="filters">
          <div class="f w6"><label>Current Balance</label><div style="font-weight:800">${UI.escapeHtml(UI.fmtNum(a.currentBalance,0))}</div></div>
          <div class="f w6"><label>Available Balance</label><div style="font-weight:800">${UI.escapeHtml(UI.fmtNum(a.availableBalance,0))}</div></div>
          <div class="f w6"><label>Hold Amount (demo)</label><div>${UI.escapeHtml(UI.fmtNum(Math.max(0, a.currentBalance-a.availableBalance),0))}</div></div>
          <div class="f w6"><label>Last refreshed</label><div>${UI.escapeHtml(UI.fmtDT(a.asOf))}</div></div>
        </div>
        <div class="mini" style="margin-top:8px">Balances are sample data in this prototype; in production they come from core banking + on-chain reconciliation.</div>
      </div>

      <div data-acct-pane="limits" style="display:none">
        <div class="filters">
          <div class="f w6"><label>High value gate</label><div>≥ ${UI.escapeHtml(UI.fmtNum(st.config.highValueThresholdUSD,0))} USD requires QC2</div></div>
          <div class="f w6"><label>Daily limit (demo)</label><div>${UI.escapeHtml(UI.fmtNum(25000000,0))}</div></div>
          <div class="f w6"><label>Per-txn limit (demo)</label><div>${UI.escapeHtml(UI.fmtNum(10000000,0))}</div></div>
          <div class="f w6"><label>Compliance holds</label><div>Enabled</div></div>
        </div>
        <div class="mini" style="margin-top:8px">Controls are surfaced here so Ops sees guardrails, not just statuses.</div>
      </div>

      <div data-acct-pane="activity" style="display:none">
        <div class="mini" style="font-weight:800;color:var(--text);margin-bottom:8px">Recent transactions linked to this account</div>
        ${miniTxns}
      </div>
    `;

    UI.openDrawer({title:`${a.accountName}`, meta:`${a.clientName} • ${a.currency} • ${a.status}`, body});

    // Wire tabs + open-transaction buttons (drawer content)
    setTimeout(()=>{
      const pane = (name)=> UI.qs(`[data-acct-pane="${name}"]`);
      const btns = UI.qsa("[data-acct-tab]");
      function show(name){
        ["overview","balances","limits","activity"].forEach(n=>{
          const p = pane(n);
          if (p) p.style.display = (n===name) ? "block" : "none";
        });
        btns.forEach(b=>{
          const on = b.getAttribute("data-acct-tab")===name;
          b.classList.toggle("primary", on);
        });
      }
      btns.forEach(b=>b.addEventListener("click", ()=>show(b.getAttribute("data-acct-tab"))));
      show("overview");

      UI.qsa("[data-open-txn]").forEach(b=>{
        b.addEventListener("click", (e)=>{
          e.stopPropagation();
          const tid = b.getAttribute("data-open-txn");
          // Jump to Transactions page and open drawer
          location.href = `transactions.html?open=${encodeURIComponent(tid)}`;
        });
      });
    }, 0);
  }

  function reset(){
    UI.qs("#aClientName").value="";
    UI.qs("#aClientId").value="";
    UI.qs("#aStatus").value="All";
    UI.qs("#aCur").value="All";
    UI.qs("#aBranch").value="All";
    UI.qs("#aFrom").value="";
    UI.qs("#aTo").value="";
    render();
  }

  function exportCSV(){
    read();
    const st = BP.ensureState();
    const rows = apply(st.accounts).slice(0,5000).map(a=>({
      account_id:a.id,
      blockchain_account_number:a.blockchainAccountNumber,
      account_name:a.accountName,
      branch:a.branch,
      branch_name:a.branchName,
      account_type:a.accountType,
      currency:a.currency,
      status:a.status,
      client_id:a.clientId,
      client_name:a.clientName,
      current_balance:a.currentBalance,
      available_balance:a.availableBalance,
      as_of:a.asOf
    }));
    if (!rows.length){ UI.toast("No data",""); return; }
    const cols = Object.keys(rows[0]);
    const esc = (v)=>{ const s=String(v??""); return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s; };
    const csv = cols.map(esc).join(",") + "\n" + rows.map(r=>cols.map(c=>esc(r[c])).join(",")).join("\n");
    UI.downloadFile(`accounts_${new Date().toISOString().slice(0,10)}.csv`, "text/csv", csv);
  }

  function bind(){
    ["#aClientName","#aClientId","#aStatus","#aCur","#aBranch","#aFrom","#aTo"].forEach(sel=>{
      UI.qs(sel).addEventListener("input", ()=>{ clearTimeout(bind._t); bind._t=setTimeout(render, 150); });
      UI.qs(sel).addEventListener("change", render);
    });
    UI.qs("#resetAcct").addEventListener("click", reset);
    UI.qs("#exportAcct").addEventListener("click", exportCSV);
  }

  document.addEventListener("DOMContentLoaded", ()=>{
    populate();
    bind();
    render();
  });
  document.addEventListener("bp:filtersChanged", render);
})();
