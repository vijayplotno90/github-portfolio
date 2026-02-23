
(function(){
  function computeStats(list){
    const total = list.length;
    const unread = list.filter(n=>!n.read).length;
    const action = list.filter(n=>n.actionRequired).length;
    const today = new Date().toISOString().slice(0,10);
    const createdToday = list.filter(n=>(n.createdAt||"").slice(0,10)===today).length;
    return {total, unread, action, createdToday};
  }

  function renderKPIs(stats){
    const el = UI.qs("#notifKpis");
    const cards = [
      {t:"Total", v: UI.fmtNum(stats.total), s:"Notifications"},
      {t:"Unread", v: UI.fmtNum(stats.unread), s:"Needs attention"},
      {t:"Action required", v: UI.fmtNum(stats.action), s:"Must acknowledge"},
      {t:"Created today", v: UI.fmtNum(stats.createdToday), s:"New"}
    ];
    el.innerHTML = cards.map(c=>`
      <div class="kpi" style="grid-column: span 3">
        <div class="t">${UI.escapeHtml(c.t)}</div>
        <div class="v">${UI.escapeHtml(c.v)}</div>
        <div class="s">${UI.escapeHtml(c.s)}</div>
      </div>
    `).join("");
  }

  function applyFilters(list){
    const view = UI.qs("#nView").value;
    const q = UI.qs("#nSearch").value.trim().toLowerCase();
    let out = list.slice();
    if (view==="unread") out = out.filter(n=>!n.read);
    if (view==="action") out = out.filter(n=>n.actionRequired);
    if (q){
      out = out.filter(n=>{
        const hay = (n.id+" "+(n.title||"")+" "+(n.body||"")+" "+(n.kind||"")).toLowerCase();
        return hay.includes(q);
      });
    }
    return out;
  }

  function sevBadge(sev){
    if (sev==="error") return `<span class="badge bad">error</span>`;
    if (sev==="warning") return `<span class="badge warn">warning</span>`;
    if (sev==="success") return `<span class="badge ok">success</span>`;
    return `<span class="badge info">info</span>`;
  }

  function openLink(n){
    const links = n.links || {};
    if (links.txnId) location.href = `transactions.html?open=${encodeURIComponent(links.txnId)}`;
    else if (links.qcId) location.href = `qc.html?open=${encodeURIComponent(links.qcId)}`;
    else if (links.incidentId) location.href = `incidents.html?open=${encodeURIComponent(links.incidentId)}`;
    else UI.toast("No deep link", n.id);
  }

  function render(){
    const list = BP.getNotifications();
    renderKPIs(computeStats(list));
    const filtered = applyFilters(list);

    const body = UI.qs("#notifBody");
    body.innerHTML = filtered.slice(0,300).map(n=>`
      <tr>
        <td class="center"><input type="checkbox" class="nChk" data-id="${UI.escapeHtml(n.id)}"/></td>
        <td class="mono">${UI.escapeHtml(n.id)}</td>
        <td>${UI.escapeHtml(n.kind||"")}</td>
        <td>${sevBadge(n.severity||"info")}</td>
        <td>${UI.escapeHtml(n.title||"")}</td>
        <td class="mini">${UI.escapeHtml(UI.fmtDT(n.createdAt))}</td>
        <td>${n.read?'<span class="badge ok">Read</span>':'<span class="badge warn">Unread</span>'} ${n.actionRequired?'<span class="badge bad">Action</span>':''}</td>
        <td class="right"><button class="btn small" data-open="${UI.escapeHtml(n.id)}">Open</button></td>
      </tr>
    `).join("") || `<tr><td colspan="8" class="mini">No notifications.</td></tr>`;

    UI.qsa("[data-open]").forEach(b=>{
      b.addEventListener("click", ()=>{
        const id = b.getAttribute("data-open");
        const n = BP.getNotifications().find(x=>x.id===id);
        if (!n) return;
        BP.updateNotification(id, {read:true});
        openNotificationDrawer(n);
        render();
      });
    });

    // select all
    UI.qs("#nAll").checked = false;
    UI.qs("#nAll").onchange = ()=>{
      const checked = UI.qs("#nAll").checked;
      UI.qsa(".nChk").forEach(c=>c.checked = checked);
    };
  }

  function selectedIds(){
    return UI.qsa(".nChk").filter(c=>c.checked).map(c=>c.getAttribute("data-id"));
  }

  function openNotificationDrawer(n){
    const body = `
      <div class="chips" style="margin-bottom:10px">
        ${sevBadge(n.severity||"info")}
        ${n.read?'<span class="badge ok">Read</span>':'<span class="badge warn">Unread</span>'}
        ${n.actionRequired?'<span class="badge bad">Action required</span>':''}
      </div>
      <div class="mini" style="font-weight:800;color:var(--text)">${UI.escapeHtml(n.title||"")}</div>
      <div class="mini" style="margin-top:6px">${UI.escapeHtml(n.body||"")}</div>
      <hr/>
      <div class="mini"><b>Kind:</b> ${UI.escapeHtml(n.kind||"")}</div>
      <div class="mini"><b>ID:</b> <span class="mono">${UI.escapeHtml(n.id)}</span></div>
      <div class="mini"><b>Created:</b> ${UI.escapeHtml(UI.fmtDT(n.createdAt))}</div>
      <hr/>
      <div class="chips">
        <button class="btn small primary" id="openDeep">Open linked item</button>
        <button class="btn small" id="toggleRead">${n.read?"Mark unread":"Mark read"}</button>
      </div>
    `;
    UI.openDrawer({title:`${n.id}`, meta:`${n.kind} • ${n.severity}`, body});
    document.getElementById("openDeep").onclick = ()=>openLink(n);
    document.getElementById("toggleRead").onclick = ()=>{
      BP.updateNotification(n.id, {read: !n.read});
      UI.toast("Updated", "Read state changed");
      render();
      UI.closeDrawer();
    };
  }

  function mark(read){
    const ids = selectedIds();
    if (!ids.length){ UI.toast("Select items", ""); return; }
    BP.bulkUpdateNotifications(ids, {read});
    UI.toast("Updated", `${ids.length} items`);
    render();
  }

  function del(){
    const ids = selectedIds();
    if (!ids.length){ UI.toast("Select items", ""); return; }
    UI.showModal({
      title:"Delete notifications",
      sub:`Delete ${ids.length} item(s)?`,
      body:`<div class="mini">This is destructive. In production, restricted to Manager/Admin.</div>`,
      buttons:[
        {label:"Cancel", onClick:UI.hideModal},
        {label:"Delete", className:"danger", onClick:()=>{
          BP.deleteNotifications(ids);
          UI.hideModal();
          UI.toast("Deleted", `${ids.length} items`);
          render();
        }}
      ]
    });
  }

  function exportCSV(){
    const list = applyFilters(BP.getNotifications()).slice(0,5000);
    if (!list.length){ UI.toast("No data",""); return; }
    const rows = list.map(n=>({
      id:n.id, kind:n.kind, severity:n.severity, title:n.title, body:n.body, created_at:n.createdAt, read:n.read, action_required:n.actionRequired
    }));
    const cols = Object.keys(rows[0]);
    const esc = (v)=>{ const s=String(v??""); return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s; };
    const csv = cols.map(esc).join(",") + "\n" + rows.map(r=>cols.map(c=>esc(r[c])).join(",")).join("\n");
    UI.downloadFile(`notifications_${new Date().toISOString().slice(0,10)}.csv`, "text/csv", csv);
  }

  function bind(){
    UI.qs("#markRead").addEventListener("click", ()=>mark(true));
    UI.qs("#markUnread").addEventListener("click", ()=>mark(false));
    UI.qs("#deleteNotifs").addEventListener("click", del);
    UI.qs("#refreshNotifs").addEventListener("click", ()=>{ render(); UI.toast("Refreshed",""); });
    UI.qs("#exportNotifs").addEventListener("click", exportCSV);
    UI.qs("#nView").addEventListener("change", render);
    UI.qs("#nSearch").addEventListener("input", ()=>{ clearTimeout(bind._t); bind._t=setTimeout(render, 150); });
  }

  document.addEventListener("DOMContentLoaded", ()=>{
    bind();
    render();
  });
  document.addEventListener("bp:filtersChanged", render);
})();
