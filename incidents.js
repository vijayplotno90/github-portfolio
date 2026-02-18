
(function(){
  function severityBadge(s){
    const cls = s==="S1" ? "bad" : (s==="S2" ? "warn" : "");
    return `<span class="badge ${cls}">${UI.escapeHtml(s)}</span>`;
  }
  function statusBadge(s){
    const cls = (s==="Resolved") ? "ok" : (s==="Mitigated" ? "warn" : "bad");
    return `<span class="badge ${cls}">${UI.escapeHtml(s)}</span>`;
  }

  function render(){
    const incs = BP.getIncidents();
    const body = UI.qs("#incBody");
    body.innerHTML = incs.slice(0,250).map(i=>`
      <tr>
        <td class="mono">${UI.escapeHtml(i.id)}</td>
        <td>${severityBadge(i.severity)}</td>
        <td>${statusBadge(i.status)}</td>
        <td>${UI.escapeHtml(i.product)}</td>
        <td>${UI.escapeHtml(i.owner)}</td>
        <td>${UI.escapeHtml(i.eta||"—")}</td>
        <td>${UI.escapeHtml(String((i.linkedTxns||[]).length))}</td>
        <td class="mini">${UI.escapeHtml(UI.fmtDT(i.updatedAt))}</td>
        <td class="right"><button class="btn small" data-open="${UI.escapeHtml(i.id)}">Open</button></td>
      </tr>
    `).join("") || `<tr><td colspan="9" class="mini">No incidents created yet.</td></tr>`;

    UI.qsa("[data-open]").forEach(b=>b.addEventListener("click", ()=>openIncident(b.getAttribute("data-open"))));

    const openId = APP.params().open;
    if (openId && !render._opened){
      render._opened = true;
      openIncident(openId);
    }
  }

  function openIncident(id){
    const st = BP.ensureState();
    const i = st.incidents.find(x=>x.id===id);
    if (!i){ UI.toast("Not found", id); return; }

    const txLinks = (i.linkedTxns||[]).slice(0,40).map(tid=>`<a class="chip" href="transactions.html?open=${encodeURIComponent(tid)}">${UI.escapeHtml(tid)}</a>`).join(" ") || "—";

    const audit = (i.audit||[]).slice().reverse().slice(0,40).map(e=>`
      <div style="padding:8px 0;border-bottom:1px solid var(--line)">
        <div class="mini" style="font-weight:800;color:var(--text)">${UI.escapeHtml(e.event)} <span class="mini">• ${UI.escapeHtml(UI.fmtDT(e.ts))}</span></div>
        <div class="mini">${UI.escapeHtml(e.actor)}</div>
      </div>
    `).join("") || `<div class="mini">No audit events yet.</div>`;

    const body = `
      <div class="chips" style="margin-bottom:10px">
        ${severityBadge(i.severity)} ${statusBadge(i.status)}
        <span class="badge">Impacted: ${(i.linkedTxns||[]).length}</span>
      </div>

      <div class="filters">
        <div class="f w12"><label>Title</label><input id="iTitle" value="${UI.escapeHtml(i.title)}"/></div>
        <div class="f w3"><label>Severity</label>
          <select id="iSev">
            <option ${i.severity==="S1"?"selected":""}>S1</option>
            <option ${i.severity==="S2"?"selected":""}>S2</option>
            <option ${i.severity==="S3"?"selected":""}>S3</option>
            <option ${i.severity==="S4"?"selected":""}>S4</option>
          </select>
        </div>
        <div class="f w3"><label>Status</label>
          <select id="iStatus">
            ${["Declared","Investigating","Mitigated","Resolved"].map(s=>`<option ${i.status===s?"selected":""}>${s}</option>`).join("")}
          </select>
        </div>
        <div class="f w3"><label>Product</label>
          <select id="iProd">
            ${BP.config().rails.filter(x=>x!=="Combined").map(r=>`<option ${i.product===r?"selected":""}>${r}</option>`).join("")}
          </select>
        </div>
        <div class="f w3"><label>Owner</label><input id="iOwner" value="${UI.escapeHtml(i.owner||"Tech")}"/></div>
        <div class="f w6"><label>ETA</label><input id="iETA" value="${UI.escapeHtml(i.eta||"")}"/></div>
        <div class="f w6"><label>Description</label><input id="iDesc" value="${UI.escapeHtml(i.description||"")}"/></div>
      </div>

      <hr/>
      <div class="mini" style="font-weight:800;color:var(--text);margin-bottom:8px">Impacted transactions</div>
      <div class="mini">${txLinks}</div>
      <hr/>
      <div class="mini" style="font-weight:800;color:var(--text);margin-bottom:8px">Audit</div>
      ${audit}
    `;

    UI.openDrawer({
      title: `${i.id} • ${i.title}`,
      meta: `${i.product} • ${i.severity} • ${i.status}`,
      body,
      footer: `
        <button class="btn" id="closeInc">Close</button>
        <button class="btn primary" id="saveInc">Save</button>
      `
    });

    document.getElementById("closeInc").onclick = UI.closeDrawer;
    document.getElementById("saveInc").onclick = ()=>{
      try{
        BP.updateIncident(i.id, {
          title: document.getElementById("iTitle").value.trim(),
          severity: document.getElementById("iSev").value,
          status: document.getElementById("iStatus").value,
          product: document.getElementById("iProd").value,
          owner: document.getElementById("iOwner").value.trim(),
          eta: document.getElementById("iETA").value.trim(),
          description: document.getElementById("iDesc").value.trim()
        });
        UI.toast("Saved", i.id);
        render();
        openIncident(i.id);
      }catch(e){
        UI.toast("Error", e.message);
      }
    };
  }

  function newIncident(){
    UI.showModal({
      title:"Create Incident",
      sub:"Creates an incident tile and a notification (demo).",
      body: `
        <div class="filters">
          <div class="f w12"><label>Title</label><input id="nTitle" placeholder="e.g., Partior settlement lag"/></div>
          <div class="f w3"><label>Severity</label><select id="nSev"><option>S1</option><option selected>S2</option><option>S3</option><option>S4</option></select></div>
          <div class="f w3"><label>Product</label>
            <select id="nProd"><option>Kinexys</option><option>Partior</option><option>Deposit Token</option></select>
          </div>
          <div class="f w6"><label>Description</label><input id="nDesc" placeholder="Short impact statement"/></div>
        </div>
      `,
      buttons:[
        {label:"Cancel", onClick:UI.hideModal},
        {label:"Create", className:"primary", onClick:()=>{
          try{
            const inc = BP.createIncident({
              title: document.getElementById("nTitle").value.trim() || "Incident",
              severity: document.getElementById("nSev").value,
              product: document.getElementById("nProd").value,
              description: document.getElementById("nDesc").value.trim()
            });
            UI.hideModal();
            UI.toast("Created", inc.id);
            render();
            openIncident(inc.id);
          }catch(e){
            UI.toast("Error", e.message);
          }
        }}
      ]
    });
  }

  function exportCSV(){
    const rows = BP.getIncidents().slice(0,5000).map(i=>({
      incident_id:i.id, title:i.title, severity:i.severity, status:i.status, product:i.product, owner:i.owner, eta:i.eta||"",
      impacted_txns:(i.linkedTxns||[]).length, created_at:i.createdAt, updated_at:i.updatedAt
    }));
    if (!rows.length){ UI.toast("No data",""); return; }
    const cols = Object.keys(rows[0]);
    const esc = (v)=>{ const s=String(v??""); return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s; };
    const csv = cols.map(esc).join(",") + "\n" + rows.map(r=>cols.map(c=>esc(r[c])).join(",")).join("\n");
    UI.downloadFile(`incidents_${new Date().toISOString().slice(0,10)}.csv`, "text/csv", csv);
  }

  document.addEventListener("DOMContentLoaded", ()=>{
    UI.qs("#newIncident").addEventListener("click", newIncident);
    UI.qs("#exportInc").addEventListener("click", exportCSV);
    render();
  });
  document.addEventListener("bp:filtersChanged", render);
})();
