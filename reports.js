
(function(){
  const reportNames = [
    "Returns & Rejects Report",
    "SLA Compliance Report",
    "Queue Aging Report",
    "High-Value Adjustments & Approvals",
    "Maker-Checker Performance Report"
  ];
  const pinned = reportNames.slice(0,5);

  function getFilters(){
    const gf = APP.getGlobalFilters();
    return {
      product: gf.product,
      from: gf.from,
      to: gf.to,
      clientId: UI.qs("#rClientId").value.trim(),
      exceptionType: UI.qs("#rEx").value
    };
  }

  function populate(){
    const sel = UI.qs("#rName");
    reportNames.forEach(n=>sel.insertAdjacentHTML("beforeend", `<option>${n}</option>`));
    sel.value = pinned[0];
    const pinnedWrap = UI.qs("#pinnedReports");
    pinnedWrap.innerHTML = pinned.map(n=>`<div class="chip" data-pin="${UI.escapeHtml(n)}">${UI.escapeHtml(n)}</div>`).join("");
    UI.qsa("[data-pin]").forEach(c=>c.addEventListener("click", ()=>{
      UI.qs("#rName").value = c.getAttribute("data-pin");
      preview();
    }));
  }

  function buildTable(rows){
    const head = UI.qs("#rHead");
    const body = UI.qs("#rBody");
    if (!rows || !rows.length){
      head.innerHTML = "";
      body.innerHTML = `<tr><td class="mini">No rows.</td></tr>`;
      return;
    }
    const cols = Object.keys(rows[0]);
    head.innerHTML = `<tr>${cols.map(c=>`<th>${UI.escapeHtml(c)}</th>`).join("")}</tr>`;
    body.innerHTML = rows.map(r=>`<tr>${cols.map(c=>`<td>${UI.escapeHtml(String(r[c]??""))}</td>`).join("")}</tr>`).join("");
  }

  function preview(){
    const name = UI.qs("#rName").value;
    const f = getFilters();
    // map exceptionType
    if (name==="Returns & Rejects Report" && f.exceptionType!=="All"){
      // filter later in UI after report generation? We'll post-filter
    }
    const rep = BP.generateReport(name, f);
    let rows = rep.rows || [];
    if (name==="Returns & Rejects Report" && f.exceptionType!=="All"){
      rows = rows.filter(r=>r.type===f.exceptionType);
    }
    const sample = rows.slice(0,200);
    buildTable(sample);
    UI.qs("#rMeta").textContent = `Rows: ${rows.length} • Preview: ${sample.length} • Export downloads full CSV.`;
  }

  function exportCSV(){
    const name = UI.qs("#rName").value;
    const f = getFilters();
    const rep = BP.generateReport(name, f);
    let csv = rep.csv || "";
    if (name==="Returns & Rejects Report" && f.exceptionType!=="All"){
      // regenerate filtered csv from filtered rows
      const rows = (rep.rows||[]).filter(r=>r.type===f.exceptionType);
      if (rows.length){
        const cols = Object.keys(rows[0]);
        const esc = (v)=>{ const s=String(v??""); return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s; };
        csv = cols.map(esc).join(",") + "\n" + rows.map(r=>cols.map(c=>esc(r[c])).join(",")).join("\n");
      } else {
        csv = "";
      }
    }
    const gf = APP.getGlobalFilters();
    const safe = name.toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/_+/g,"_").replace(/^_|_$/g,"");
    UI.downloadFile(`${safe}_${gf.product}_${gf.from}_to_${gf.to}.csv`, "text/csv", csv);
  }

  document.addEventListener("DOMContentLoaded", ()=>{
    populate();
    UI.qs("#preview").addEventListener("click", preview);
    UI.qs("#exportCSV").addEventListener("click", exportCSV);
    UI.qs("#rClientId").addEventListener("input", ()=>{ clearTimeout(preview._t); preview._t=setTimeout(preview, 200); });
    UI.qs("#rEx").addEventListener("change", preview);
    UI.qs("#rName").addEventListener("change", preview);
    preview();
  });
  document.addEventListener("bp:filtersChanged", preview);
})();
