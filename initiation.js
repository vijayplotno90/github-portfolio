
(function(){
  let step = 1;
  let evidence = []; // metas [{id,name,size,type,createdAt}]
  let draftId = null;

  function setStep(n){
    step = n;
    ["1","2","3"].forEach(s=>{
      const el = document.querySelector(`#step${s}`);
      if (el) el.style.display = (Number(s)===n) ? "block" : "none";
    });
    UI.qsa("#stepper .step").forEach(st=>{
      const sn = Number(st.getAttribute("data-step"));
      st.classList.toggle("active", sn===n);
      st.classList.toggle("done", sn<n);
    });
  }

  function gateRole(){
    const ent = BP.entitlements();
    const gate = UI.qs("#initRoleGate");
    if (!ent.initiate){
      gate.style.display = "inline-flex";
      gate.textContent = "RBAC: initiation is not permitted for the current session.";
      UI.qs("#toReview").disabled = true;
      UI.qs("#createDraft").disabled = true;
      UI.qs("#submitToQC").disabled = true;
      return false;
    }
    gate.style.display = "none";
    UI.qs("#toReview").disabled = false;
    UI.qs("#createDraft").disabled = false;
    UI.qs("#submitToQC").disabled = false;
    return true;
  }

  function populate(){
    const st = BP.ensureState();
    const txnType = UI.qs("#iTxnType");
    const product = UI.qs("#iProduct");
    const bic = UI.qs("#iBic");
    const br = UI.qs("#iBranch");
    const acctType = UI.qs("#iAcctType");
    const cur = UI.qs("#iCur");
    const fundBr = UI.qs("#iFundBranch");
    const fundType = UI.qs("#iFundAcctType");
    const fundCur = UI.qs("#iFundCur");

    st.config.transactionTypes.forEach(x=>txnType.insertAdjacentHTML("beforeend", `<option>${x}</option>`));
    ["Kinexys","Partior","Deposit Token"].forEach(x=>product.insertAdjacentHTML("beforeend", `<option>${x}</option>`));
    st.config.branches.forEach(x=>br.insertAdjacentHTML("beforeend", `<option>${x}</option>`));
    st.config.accountTypes.forEach(x=>acctType.insertAdjacentHTML("beforeend", `<option>${x}</option>`));
    st.config.currencies.forEach(x=>cur.insertAdjacentHTML("beforeend", `<option>${x}</option>`));

    // Funding selectors
    st.config.branches.forEach(x=>fundBr.insertAdjacentHTML("beforeend", `<option>${x}</option>`));
    st.config.transactionTypes.forEach(x=>fundType.insertAdjacentHTML("beforeend", `<option>${x}</option>`));
    st.config.currencies.forEach(x=>fundCur.insertAdjacentHTML("beforeend", `<option>${x}</option>`));

    function fillBic(){
      const p = product.value;
      bic.innerHTML = "";
      (st.config.productBics[p]||[]).forEach(x=>bic.insertAdjacentHTML("beforeend", `<option>${x}</option>`));
    }
    product.addEventListener("change", fillBic);
    fillBic();

    // defaults
    txnType.value = "Adjustment";
    cur.value = "USD";
    fundCur.value = "USD";
    const today = new Date().toISOString().slice(0,10);
    UI.qs("#iValDate").value = today;

    // sensible defaults
    fundBr.value = br.value;
    fundType.value = "Funding";

    // prefill from txn query param
    const qpTxn = APP.params().txn;
    if (qpTxn){
      const t = st.transactions.find(x=>x.id===qpTxn);
      if (t){
        product.value = t.product;
        fillBic();
        bic.value = t.productBic;
        br.value = t.branch;
        cur.value = t.currency;
        UI.qs("#iAmt").value = t.amount;
        UI.qs("#iLinked").value = t.id;
        UI.qs("#iCoin").value = String(t.accountNumber||"");
        UI.toast("Prefilled", "Linked to "+t.id);
      }
    }
  }

  function sizeText(n){
    const b = Number(n||0);
    if (b<1024) return b+" B";
    if (b<1024*1024) return (b/1024).toFixed(1)+" KB";
    return (b/(1024*1024)).toFixed(1)+" MB";
  }

  function renderEvidence(){
    const body = UI.qs("#evidBody");
    if (!evidence.length){
      body.innerHTML = `<tr><td colspan="4" class="mini">No attachments yet.</td></tr>`;
      return;
    }
    body.innerHTML = evidence.map(e=>`
      <tr>
        <td>${UI.escapeHtml(e.name)}</td>
        <td class="mini">${UI.escapeHtml(e.type)}</td>
        <td class="right mini">${UI.escapeHtml(sizeText(e.size))}</td>
        <td class="right"><button class="btn small danger" data-del="${UI.escapeHtml(e.id)}">Remove</button></td>
      </tr>
    `).join("");
    UI.qsa("[data-del]").forEach(b=>{
      b.addEventListener("click", async ()=>{
        const id = b.getAttribute("data-del");
        try{
          await BP.deleteEvidence(id);
        }catch(e){}
        evidence = evidence.filter(x=>x.id!==id);
        renderEvidence();
        UI.toast("Removed", "Attachment removed");
      });
    });
  }

  async function onFiles(){
    const files = UI.qs("#iFile").files;
    if (!files || !files.length) return;
    for (const f of files){
      try{
        const meta = await BP.saveEvidenceFile(f);
        evidence.push(meta);
      }catch(e){
        UI.toast("Evidence error", e.message || "Failed to save evidence");
      }
    }
    UI.qs("#iFile").value = "";
    renderEvidence();
    UI.toast("Saved", `${files.length} file(s) added`);
  }

  function collect(){
    const payload = {
      transactionType: UI.qs("#iTxnType").value,
      product: UI.qs("#iProduct").value,
      productBic: UI.qs("#iBic").value,
      branch: UI.qs("#iBranch").value,
      accountType: UI.qs("#iAcctType").value,
      coinAccountNumber: UI.qs("#iCoin").value.trim(),
      coinAccountName: UI.qs("#iCoinName").value.trim(),
      coinAccountEciName: UI.qs("#iCoinEci").value.trim(),
      currency: UI.qs("#iCur").value,
      amount: UI.qs("#iAmt").value,
      valueDate: UI.qs("#iValDate").value,
      fundingBranch: UI.qs("#iFundBranch").value,
      fundingAccountType: UI.qs("#iFundAcctType").value,
      fundingAccountNumber: UI.qs("#iFundAcctNo").value.trim(),
      fundingAccountCurrency: UI.qs("#iFundCur").value,
      fundingDdaBalance: UI.qs("#iFundBal").value.trim(),
      fundingEciName: UI.qs("#iFundEci").value.trim(),
      remittance: [
        UI.qs("#iRem1").value.trim(),
        UI.qs("#iRem2").value.trim(),
        UI.qs("#iRem3").value.trim(),
        UI.qs("#iRem4").value.trim(),
      ],
      linkedTxnId: UI.qs("#iLinked").value.trim(),
      notes: UI.qs("#iNotes").value.trim()
    };
    return payload;
  }

  function validate(payload){
    const req = [
      "transactionType","product","productBic","branch","accountType","coinAccountNumber","currency","amount","valueDate",
      "fundingBranch","fundingAccountType","fundingAccountNumber","fundingAccountCurrency"
    ];
    for (const k of req){
      if (!payload[k] || String(payload[k]).trim()==="") return {ok:false, msg:`Missing required field: ${k}`};
    }
    const amt = Number(payload.amount);
    if (!isFinite(amt) || amt<=0) return {ok:false, msg:"Amount must be > 0"};
    if (!payload.valueDate.match(/^\d{4}-\d{2}-\d{2}$/)) return {ok:false, msg:"Invalid value date"};
    // Remittance lines are capped in HTML (maxlength=35). Keep a safety check.
    if (Array.isArray(payload.remittance)){
      for (const line of payload.remittance){
        if (String(line||"").length>35) return {ok:false, msg:"Remittance lines must be <= 35 characters"};
      }
    }
    return {ok:true};
  }

  function renderReview(){
    const st = BP.ensureState();
    const p = collect();
    const v = validate(p);
    const hv = Number(p.amount||0) >= st.config.highValueThresholdUSD;
    const panel = UI.qs("#reviewPanel");
    if (!v.ok){
      panel.innerHTML = `<div class="badge bad">${UI.escapeHtml(v.msg)}</div>`;
      return false;
    }
    if (evidence.length<1){
      panel.innerHTML = `<div class="badge bad">Evidence required (attach at least 1 file)</div>`;
      return false;
    }
    panel.innerHTML = `
      <div class="chips" style="margin-bottom:10px">
        <span class="badge info">Draft will be created</span>
        <span class="badge ${hv?'warn':'ok'}">${hv?'High value (QC2 required)':'Below threshold (QC1 only)'}</span>
        <span class="badge">Evidence: ${evidence.length}</span>
      </div>
      <div class="filters">
        <div class="f w6"><label>Rail/Product</label><div>${UI.escapeHtml(p.product)}</div></div>
        <div class="f w6"><label>Transaction Type</label><div>${UI.escapeHtml(p.transactionType)}</div></div>
        <div class="f w6"><label>Product BIC</label><div class="mono">${UI.escapeHtml(p.productBic)}</div></div>
        <div class="f w6"><label>Branch</label><div>${UI.escapeHtml(p.branch)}</div></div>
        <div class="f w6"><label>Account Type</label><div>${UI.escapeHtml(p.accountType)}</div></div>
        <div class="f w6"><label>COIN Account Number</label><div class="mono">${UI.escapeHtml(p.coinAccountNumber)}</div></div>
        <div class="f w6"><label>COIN Account Name</label><div>${UI.escapeHtml(p.coinAccountName||"—")}</div></div>
        <div class="f w6"><label>COIN Account ECI Name</label><div>${UI.escapeHtml(p.coinAccountEciName||"—")}</div></div>
        <div class="f w3"><label>Currency</label><div>${UI.escapeHtml(p.currency)}</div></div>
        <div class="f w3"><label>Amount</label><div style="font-weight:800">${UI.escapeHtml(UI.fmtNum(p.amount,0))}</div></div>
        <div class="f w3"><label>Value Date</label><div>${UI.escapeHtml(p.valueDate)}</div></div>
        <div class="f w3"><label>Linked Txn</label><div class="mono">${UI.escapeHtml(p.linkedTxnId||"—")}</div></div>
        <div class="f w6"><label>Funding Branch</label><div>${UI.escapeHtml(p.fundingBranch)}</div></div>
        <div class="f w6"><label>Funding Account Type</label><div>${UI.escapeHtml(p.fundingAccountType)}</div></div>
        <div class="f w6"><label>Funding Account Number</label><div class="mono">${UI.escapeHtml(p.fundingAccountNumber)}</div></div>
        <div class="f w3"><label>Funding Currency</label><div>${UI.escapeHtml(p.fundingAccountCurrency)}</div></div>
        <div class="f w3"><label>Funding DDA Balance</label><div>${UI.escapeHtml(p.fundingDdaBalance||"—")}</div></div>
        <div class="f w6"><label>Funding ECI Name</label><div>${UI.escapeHtml(p.fundingEciName||"—")}</div></div>
        <div class="f w12"><label>Remittance</label><div class="mono">${UI.escapeHtml((p.remittance||[]).filter(Boolean).join(" | ") || "—")}</div></div>
        <div class="f w12"><label>Notes</label><div>${UI.escapeHtml(p.notes||"—")}</div></div>
      </div>
    `;
    return true;
  }

  function createDraft(){
    const p = collect();
    const v = validate(p);
    if (!v.ok){ UI.toast("Validation", v.msg); return; }
    if (evidence.length<1){ UI.toast("Validation", "Attach evidence before creating draft"); return; }
    try{
      const req = BP.createInitiationRequest(p, evidence);
      draftId = req.id;
      UI.toast("Draft created", draftId);
      renderSubmitPanel(req);
      setStep(3);
    }catch(e){
      UI.toast("Error", e.message);
    }
  }

  function renderSubmitPanel(req){
    const hv = req.qc.requiresQC2;
    UI.qs("#submitPanel").innerHTML = `
      <div class="chips" style="margin-bottom:10px">
        <span class="badge info">Submission ID</span>
        <span class="badge kpi mono">${UI.escapeHtml(req.id)}</span>
        <span class="badge ${hv?'warn':'ok'}">${hv?'Requires QC2':'QC1 only'}</span>
        <span class="badge">Evidence: ${(req.evidence||[]).length}</span>
      </div>
      <div class="mini">After submit: edits are locked. Item appears in QC Queue and notifications are created.</div>
    `;
  }

  function submit(){
    if (!draftId){ UI.toast("Missing draft", "Create a draft first"); return; }
    try{
      const req = BP.submitToQC(draftId);
      renderSubmitPanel(req);
      UI.toast("Submitted", "Pending QC1");
      UI.showModal({
        title:"Submitted to QC",
        sub:"Next: go to QC Queue to approve/reject.",
        body:`<div class="mini">Submission <span class="mono">${UI.escapeHtml(req.id)}</span> is now <b>${UI.escapeHtml(req.status)}</b>.</div>`,
        buttons:[
          {label:"Stay", onClick:UI.hideModal},
          {label:"Open QC Queue", className:"primary", onClick:()=>{ UI.hideModal(); location.href=`qc.html?open=${encodeURIComponent(req.id)}`; }}
        ]
      });
    }catch(e){
      UI.toast("Error", e.message);
    }
  }

  function bind(){
    UI.qs("#iFile").addEventListener("change", onFiles);
    UI.qs("#toReview").addEventListener("click", ()=>{
      if (!gateRole()) return;
      const ok = renderReview();
      if (!ok) { UI.toast("Fix required", "Resolve validation issues before review"); return; }
      setStep(2);
    });
    UI.qs("#backToCreate").addEventListener("click", ()=>setStep(1));
    UI.qs("#createDraft").addEventListener("click", createDraft);
    UI.qs("#backToReview").addEventListener("click", ()=>{ renderReview(); setStep(2); });
    UI.qs("#submitToQC").addEventListener("click", submit);
  }

  document.addEventListener("DOMContentLoaded", ()=>{
    populate();
    renderEvidence();
    bind();
    gateRole();
    setStep(1);
  });
  document.addEventListener("bp:filtersChanged", ()=>{
    // no-op; initiation independent of global filters
  });
})();
