
(function(){
  const DEFAULT_FILTERS = ()=>{
    const d = new Date();
    const to = new Date();
    const from = new Date(d.getTime() - 30*86400000); // last 30 days default
    const iso = (x)=> x.toISOString().slice(0,10);
    return {product:"Combined", from: iso(from), to: iso(to), granularity:"Daily", search:""};
  };

  function getGlobalFilters(){
    const st = BP.ensureState();
    st.ui = st.ui || {};
    st.ui.filters = st.ui.filters || DEFAULT_FILTERS();
    return st.ui.filters;
  }
  function setGlobalFilters(patch){
    const st = BP.ensureState();
    st.ui = st.ui || {};
    st.ui.filters = Object.assign(getGlobalFilters(), patch||{});
    BP.saveState(st);
    return st.ui.filters;
  }

  function setActiveNav(){
    const page = document.body.getAttribute("data-page") || "";
    UI.qsa(".nav a").forEach(a=>{
      const p = a.getAttribute("data-page");
      if (p===page) a.classList.add("active"); else a.classList.remove("active");
    });
  }

  function mountTopbar(){
    const f = getGlobalFilters();
    const elProd = UI.qs("[data-global-product]");
    const elFrom = UI.qs("[data-global-from]");
    const elTo = UI.qs("[data-global-to]");
    const elGran = UI.qs("[data-global-granularity]");
    const elSearch = UI.qs("[data-global-search]");
    if (elProd){ elProd.value = f.product || "Combined"; elProd.onchange=()=>{ setGlobalFilters({product:elProd.value}); fireFiltersChanged(); }; }
    if (elFrom){ elFrom.value = f.from || ""; elFrom.onchange=()=>{ setGlobalFilters({from:elFrom.value}); fireFiltersChanged(); }; }
    if (elTo){ elTo.value = f.to || ""; elTo.onchange=()=>{ setGlobalFilters({to:elTo.value}); fireFiltersChanged(); }; }
    if (elGran){ elGran.value = f.granularity || "Daily"; elGran.onchange=()=>{ setGlobalFilters({granularity:elGran.value}); fireFiltersChanged(); }; }
    if (elSearch){
      elSearch.value = f.search || "";
      // Update search on input (fast ops workflow) + Enter for folks who like it.
      let t = null;
      const commit = ()=>{
        setGlobalFilters({search: elSearch.value.trim()});
        fireFiltersChanged();
      };
      elSearch.addEventListener("input", ()=>{
        clearTimeout(t);
        t = setTimeout(commit, 180);
      });
      elSearch.addEventListener("keydown",(e)=>{
        if (e.key==="Enter") commit();
      });
    }
  }

  function mountClock(){
    const els = UI.qsa("[data-clock]");
    if (!els.length) return;
    const fmt = ()=>{
      const d = new Date();
      const date = d.toLocaleDateString(undefined, {day:"2-digit", month:"short", year:"numeric"});
      const time = d.toLocaleTimeString(undefined, {hour:"2-digit", minute:"2-digit"});
      return `${date} • ${time}`;
    };
    const paint = ()=>{ const s = fmt(); els.forEach(el=> el.textContent = s); };
    paint();
    setInterval(paint, 30000);
  }

  function mountUserBox(){
    const u = BP.user();
    const roleSel = UI.qs("[data-role]");
    const laneWrap = UI.qs("[data-lane-wrap]");
    const laneSel = UI.qs("[data-lane]");
    if (roleSel){
      roleSel.value = u.role;
      roleSel.onchange = ()=>{
        const role = roleSel.value;
        // auto lane defaults
        let patch = {role};
        if (role==="Checker 1") patch.checkerLane="QC1";
        if (role==="Checker 2") patch.checkerLane="QC2";
        BP.setUser(patch);
        toggleLane();
        UI.toast("Role updated", role);
        fireFiltersChanged(true);
      };
    }
    function toggleLane(){
      const u2 = BP.user();
      const show = u2.role==="Checker 1" || u2.role==="Checker 2";
      if (laneWrap){
        laneWrap.classList.toggle("show", show);
      }
      if (laneSel){
        laneSel.value = u2.checkerLane || (u2.role==="Checker 2" ? "QC2":"QC1");
        laneSel.onchange=()=>{
          BP.setUser({checkerLane: laneSel.value});
          UI.toast("Lane set", laneSel.value);
          fireFiltersChanged(true);
        };
      }
    }
    toggleLane();
  }

  // Ctrl+K global search overlay (simple modal)
  function mountGlobalSearch(){
    document.addEventListener("keydown",(e)=>{
      if ((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==="k"){
        e.preventDefault();
        openSearchModal();
      }
    });
    const btn = UI.qs("[data-open-search]");
    if (btn) btn.addEventListener("click", openSearchModal);

    function openSearchModal(){
      UI.showModal({
        title:"Global Search",
        sub:"Search Transaction ID / Client / Message ID / Network Ref / Unique Activity ID / QC Submission",
        body: `
          <div class="filters">
            <div class="f w6">
              <label>Search</label>
              <input data-sq placeholder="e.g., TXN-000123, Client 1, MSG-..., NW-..., QC-..." />
            </div>
            <div class="f w6">
              <label>Results</label>
              <div class="table-wrap slim">
                <table class="table">
                  <thead><tr><th>Type</th><th>Item</th><th>Context</th><th class="right">Open</th></tr></thead>
                  <tbody data-sres><tr><td colspan="4" class="mini">Type to search…</td></tr></tbody>
                </table>
              </div>
            </div>
          </div>
        `,
        buttons:[
          {label:"Close", className:"", onClick: UI.hideModal}
        ]
      });
      const inp = UI.qs("[data-sq]", document);
      const body = UI.qs("[data-sres]", document);
      inp.focus();
      let t = null;
      inp.addEventListener("input", ()=>{
        clearTimeout(t);
        t = setTimeout(()=>{
          const q = inp.value.trim();
          const res = BP.globalSearch(q, 12);
          if (!q) { body.innerHTML = `<tr><td colspan="4" class="mini">Type to search…</td></tr>`; return; }
          if (!res.length){ body.innerHTML = `<tr><td colspan="4" class="mini">No matches</td></tr>`; return; }
          body.innerHTML = res.map(r=>`
            <tr>
              <td>${UI.escapeHtml(r.type)}</td>
              <td class="mono">${UI.escapeHtml(r.id)}</td>
              <td>${UI.escapeHtml(r.subtitle||"")}</td>
              <td class="right"><button class="btn small" data-open="${UI.escapeHtml(r.type)}|${UI.escapeHtml(r.id)}">Open</button></td>
            </tr>
          `).join("");
          UI.qsa("[data-open]", body).forEach(b=>{
            b.addEventListener("click", ()=>{
              const [type,id] = b.getAttribute("data-open").split("|");
              UI.hideModal();
              if (type==="Transaction"){
                location.href = `transactions.html?open=${encodeURIComponent(id)}`;
              } else if (type==="QC"){
                location.href = `qc.html?open=${encodeURIComponent(id)}`;
              }
            });
          });
        }, 180);
      });
    }
  }

  function fireFiltersChanged(force){
    document.dispatchEvent(new CustomEvent("bp:filtersChanged", {detail:{force:!!force, filters:getGlobalFilters()}}));
  }

  // Public helper to parse query params
  function params(){
    const p = {};
    location.search.replace(/^\?/,"").split("&").filter(Boolean).forEach(kv=>{
      const [k,v]=kv.split("=");
      p[decodeURIComponent(k)] = decodeURIComponent(v||"");
    });
    return p;
  }

  document.addEventListener("DOMContentLoaded", ()=>{
    BP.ensureState();
    setActiveNav();
    mountTopbar();
    mountUserBox();
    mountGlobalSearch();
    mountClock();
    fireFiltersChanged(true);
  });

  window.APP = { getGlobalFilters, setGlobalFilters, fireFiltersChanged, params };
})();
