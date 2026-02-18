
(function(){
  let tab = "maker"; // maker/qc1/qc2/all

  function setTab(t){
    tab = t;
    UI.qsa("#qcTabs .tab").forEach(x=>x.classList.toggle("active", x.getAttribute("data-qc")===t));
    render();
  }

  function ageBucket(req){
    const ts = new Date(req.submittedAt || req.createdAt).getTime();
    const min = Math.floor((Date.now()-ts)/60000);
    if (min<30) return "<30m";
    if (min<60) return "30-60m";
    if (min<240) return "1-4h";
    return ">4h";
  }

  function visibleRequests(){
    const st = BP.ensureState();
    const u = st.user;
    const list = st.initiationRequests.slice().sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt));

    if (tab==="maker"){
      // show my drafts + my submitted
      return list.filter(r=>r.qc?.maker?.id===u.id);
    }
    if (tab==="qc1"){
      return list.filter(r=>r.status==="Pending QC1");
    }
    if (tab==="qc2"){
      return list.filter(r=>r.status==="Pending QC2");
    }
    return list;
  }

  function statusBadge(s){
    if (s==="Draft") return `<span class="badge">Draft</span>`;
    if (s==="Pending QC1") return `<span class="badge warn">Pending QC1</span>`;
    if (s==="Pending QC2") return `<span class="badge warn">Pending QC2</span>`;
    if (s==="Approved") return `<span class="badge ok">Approved</span>`;
    if (s==="Rejected") return `<span class="badge bad">Rejected</span>`;
    return `<span class="badge">${UI.escapeHtml(s)}</span>`;
  }

  function render(){
    const reqs = visibleRequests();
    const body = UI.qs("#qcBody");
    body.innerHTML = reqs.slice(0,250).map(r=>{
      return `
        <tr>
          <td class="mono">${UI.escapeHtml(r.id)}</td>
          <td>${statusBadge(r.status)}</td>
          <td>${UI.escapeHtml(r.product)}</td>
          <td>${UI.escapeHtml(r.valueDate)}</td>
          <td>${UI.escapeHtml(r.currency)}</td>
          <td class="right">${UI.fmtNum(r.amount,0)} ${r.qc?.requiresQC2 ? '<span class="badge warn" style="margin-left:6px">QC2</span>':''}</td>
          <td>${UI.escapeHtml(ageBucket(r))}</td>
          <td>${UI.escapeHtml(r.qc?.maker?.name||"")}</td>
          <td>${r.qc?.qc1 ? `<span class="mini">${UI.escapeHtml(r.qc.qc1.name)}<br/>${UI.escapeHtml(r.qc.qc1.decision)}</span>`:"—"}</td>
          <td>${r.qc?.qc2 ? `<span class="mini">${UI.escapeHtml(r.qc.qc2.name)}<br/>${UI.escapeHtml(r.qc.qc2.decision)}</span>`:"—"}</td>
          <td class="right"><button class="btn small" data-open="${UI.escapeHtml(r.id)}">Open</button></td>
        </tr>
      `;
    }).join("") || `<tr><td colspan="11" class="mini">No QC items.</td></tr>`;

    UI.qs("#qcMeta").textContent = `Showing ${Math.min(250, reqs.length)} of ${reqs.length} • Open an item for diff, evidence, audit, approve/reject.`;

    UI.qsa("[data-open]").forEach(b=>b.addEventListener("click", ()=>openQC(b.getAttribute("data-open"))));

    const openId = APP.params().open;
    if (openId && !render._opened){
      render._opened = true;
      openQC(openId);
    }
  }

  function renderEvidenceList(req){
    if (!req.evidence || !req.evidence.length) return `<div class="badge bad">No evidence attached (cannot approve)</div>`;
    const rows = req.evidence.map(e=>`
      <tr>
        <td>${UI.escapeHtml(e.name)}</td>
        <td class="mini">${UI.escapeHtml(e.type)}</td>
        <td class="right mini">${UI.escapeHtml(String(e.size||0))}</td>
        <td class="right"><button class="btn small" data-dl="${UI.escapeHtml(e.id)}">Download</button></td>
      </tr>
    `).join("");
    return `
      <div class="table-wrap slim">
        <table class="table">
          <thead><tr><th>File</th><th>Type</th><th class="right">Size</th><th class="right">Action</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  async function downloadEvidence(id){
    const blob = await BP.getEvidenceBlob(id);
    if (!blob){ UI.toast("Missing evidence", "Evidence not found in this browser"); return; }
    UI.downloadFile("evidence_"+id, blob.type || "application/octet-stream", blob);
  }

  function openQC(id){
    const st = BP.ensureState();
    const req = st.initiationRequests.find(x=>x.id===id);
    if (!req){ UI.toast("Not found", id); return; }
    const ent = BP.entitlements();
    const role = st.user.role;
    const canQC1 = ent.qc1 || role==="Manager" || role==="Admin";
    const canQC2 = ent.qc2 || role==="Manager" || role==="Admin";

    const diff = (req.diff && req.diff.diffs && req.diff.diffs.length) ? `
      <div class="mini" style="font-weight:800;color:var(--text);margin-bottom:8px">Diff view (requested vs current)</div>
      <div class="table-wrap slim">
        <table class="table">
          <thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead>
          <tbody>
            ${req.diff.diffs.map(d=>`<tr><td class="mono">${UI.escapeHtml(d.field)}</td><td>${UI.escapeHtml(String(d.before))}</td><td>${UI.escapeHtml(String(d.after))}</td></tr>`).join("")}
          </tbody>
        </table>
      </div>
    ` : `<div class="mini">No linked transaction diff (either not linked or txn not found).</div>`;

    const audit = (req.audit||[]).slice().reverse().slice(0,40).map(e=>`
      <div style="padding:8px 0;border-bottom:1px solid var(--line)">
        <div class="mini" style="font-weight:800;color:var(--text)">${UI.escapeHtml(e.event)} <span class="mini">• ${UI.escapeHtml(UI.fmtDT(e.ts))}</span></div>
        <div class="mini">${UI.escapeHtml(e.actor)}</div>
      </div>
    `).join("") || `<div class="mini">No audit events yet.</div>`;

    const routing = req.qc?.requiresQC2 ? `<span class="badge warn">Requires QC2</span>` : `<span class="badge ok">QC1 only</span>`;

    const body = `
      <div class="chips" style="margin-bottom:10px">
        ${statusBadge(req.status)}
        ${routing}
        <span class="badge">Evidence: ${(req.evidence||[]).length}</span>
        ${req.linkedTxnId ? `<a class="chip" href="transactions.html?open=${encodeURIComponent(req.linkedTxnId)}">Open Txn</a>` : ""}
      </div>

      <div class="filters">
        <div class="f w6"><label>Submission</label><div class="mono">${UI.escapeHtml(req.id)}</div></div>
        <div class="f w6"><label>Maker</label><div>${UI.escapeHtml(req.qc?.maker?.name||"")}</div></div>
        <div class="f w6"><label>Product</label><div>${UI.escapeHtml(req.product)}</div></div>
        <div class="f w6"><label>Transaction Type</label><div>${UI.escapeHtml(req.transactionType)}</div></div>
        <div class="f w6"><label>Currency</label><div>${UI.escapeHtml(req.currency)}</div></div>
        <div class="f w6"><label>Amount</label><div style="font-weight:800">${UI.escapeHtml(UI.fmtNum(req.amount,0))}</div></div>
        <div class="f w6"><label>Value Date</label><div>${UI.escapeHtml(req.valueDate)}</div></div>
        <div class="f w6"><label>Linked Txn</label><div class="mono">${UI.escapeHtml(req.linkedTxnId||"—")}</div></div>
        <div class="f w12"><label>Notes</label><div>${UI.escapeHtml(req.notes||"—")}</div></div>
      </div>

      <hr/>
      <div class="tabs" id="qcTabs2">
        <div class="tab active" data-t="evidence">Evidence</div>
        <div class="tab" data-t="diff">Diff</div>
        <div class="tab" data-t="audit">Audit</div>
      </div>
      <div id="qc2-evidence">${renderEvidenceList(req)}</div>
      <div id="qc2-diff" style="display:none">${diff}</div>
      <div id="qc2-audit" style="display:none">${audit}</div>

      <hr/>
      <div class="mini" style="font-weight:800;color:var(--text);margin-bottom:8px">QC Actions</div>
      <div class="chips">
        <button class="btn small primary" data-qcact="approve1" ${canQC1 && req.status==="Pending QC1" ? "" : "disabled"}>QC1 Approve</button>
        <button class="btn small danger" data-qcact="reject1" ${canQC1 && req.status==="Pending QC1" ? "" : "disabled"}>QC1 Reject</button>
        <button class="btn small primary" data-qcact="approve2" ${canQC2 && req.status==="Pending QC2" ? "" : "disabled"}>QC2 Approve</button>
        <button class="btn small danger" data-qcact="reject2" ${canQC2 && req.status==="Pending QC2" ? "" : "disabled"}>QC2 Reject</button>
      </div>
      <div class="mini" style="margin-top:8px">Reject requires a comment. Maker cannot approve their own submission. QC2 must be a different approver.</div>
    `;

    UI.openDrawer({title:`${req.id}`, meta:`${req.product} • ${req.currency} ${UI.fmtNum(req.amount,0)} • ${req.status}`, body});

    // tabs
    UI.qsa("#qcTabs2 .tab").forEach(tabEl=>{
      tabEl.addEventListener("click", ()=>{
        UI.qsa("#qcTabs2 .tab").forEach(x=>x.classList.remove("active"));
        tabEl.classList.add("active");
        const id = tabEl.getAttribute("data-t");
        ["evidence","diff","audit"].forEach(k=>{
          const pane = document.getElementById("qc2-"+k);
          if (pane) pane.style.display = (k===id) ? "block" : "none";
        });
      });
    });

    // evidence download
    UI.qsa("[data-dl]").forEach(b=>b.addEventListener("click", ()=>downloadEvidence(b.getAttribute("data-dl"))));

    function doDecision(lane, decision){
      const needComment = (decision==="Reject");
      const promptBody = needComment ? `
        <div class="filters">
          <div class="f w12">
            <label>Comment (required)</label>
            <textarea id="qcComment" rows="4" style="width:100%" placeholder="Provide reason for rejection…"></textarea>
          </div>
        </div>` : `<div class="mini">Confirm ${lane} ${decision}?</div>`;
      UI.showModal({
        title:`${lane} ${decision}`,
        sub:`Submission ${req.id}`,
        body: promptBody,
        buttons:[
          {label:"Cancel", onClick:UI.hideModal},
          {label:`Confirm`, className: decision==="Reject" ? "danger" : "primary", onClick:()=>{
            const comment = needComment ? (document.getElementById("qcComment").value.trim()) : "";
            try{
              BP.qcDecision(req.id, lane, decision, comment);
              UI.hideModal();
              UI.toast("Updated", `${lane} ${decision}`);
              render();
              openQC(req.id);
            }catch(e){
              UI.toast("Error", e.message);
            }
          }}
        ]
      });
    }

    UI.qsa("[data-qcact]").forEach(b=>{
      b.addEventListener("click", ()=>{
        const act = b.getAttribute("data-qcact");
        if (act==="approve1") doDecision("QC1","Approve");
        if (act==="reject1") doDecision("QC1","Reject");
        if (act==="approve2") doDecision("QC2","Approve");
        if (act==="reject2") doDecision("QC2","Reject");
      });
    });
  }

  function exportCSV(){
    const rows = BP.getInitiationRequests().slice(0,5000).map(r=>({
      submission_id:r.id,
      status:r.status,
      product:r.product,
      currency:r.currency,
      amount:r.amount,
      value_date:r.valueDate,
      maker:r.qc?.maker?.name||"",
      qc1:r.qc?.qc1?.name||"",
      qc2:r.qc?.qc2?.name||"",
      evidence_count:(r.evidence||[]).length,
      submitted_at:r.submittedAt||"",
      updated_at:r.updatedAt||""
    }));
    if (!rows.length){ UI.toast("No data", "Nothing to export"); return; }
    const cols = Object.keys(rows[0]);
    const esc = (v)=>{ const s=String(v??""); return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s; };
    const csv = cols.map(esc).join(",") + "\n" + rows.map(r=>cols.map(c=>esc(r[c])).join(",")).join("\n");
    const d = new Date().toISOString().slice(0,10);
    UI.downloadFile(`qc_queue_${d}.csv`, "text/csv", csv);
  }

  document.addEventListener("DOMContentLoaded", ()=>{
    UI.qsa("#qcTabs .tab").forEach(t=>t.addEventListener("click", ()=>setTab(t.getAttribute("data-qc"))));
    UI.qs("#refreshQC").addEventListener("click", ()=>{ render(); UI.toast("Refreshed","QC updated"); });
    UI.qs("#exportQC").addEventListener("click", exportCSV);
    render();
  });
  document.addEventListener("bp:filtersChanged", render);
})();
