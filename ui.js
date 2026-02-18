
(function(){
  function qs(sel, root){ return (root||document).querySelector(sel); }
  function qsa(sel, root){ return Array.from((root||document).querySelectorAll(sel)); }
  function fmtMoney(amount, currency){
    const n = Number(amount||0);
    const cur = currency || "USD";
    try{
      return new Intl.NumberFormat(undefined,{style:"currency",currency:cur,maximumFractionDigits:2}).format(n);
    }catch(e){
      return cur+" "+n.toFixed(2);
    }
  }
  function fmtNum(n, digits){
    const x = Number(n||0);
    return new Intl.NumberFormat(undefined,{maximumFractionDigits:digits??0}).format(x);
  }
  function fmtPct(n, digits){
    return (Number(n||0)).toFixed(digits??1) + "%";
  }
  function fmtDT(iso){
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleString();
  }
  function durMinToText(m){
    const min = Number(m||0);
    const abs = Math.abs(min);
    const h = Math.floor(abs/60);
    const mm = abs%60;
    const s = (h? (h+"h ") : "") + (mm+"m");
    return min<0 ? ("-"+s) : s;
  }
  function badgeForSLA(state){
    if (state==="Breach") return `<span class="badge bad">SLA Breach</span>`;
    if (state==="Risk") return `<span class="badge warn">SLA Risk</span>`;
    return `<span class="badge ok">SLA Normal</span>`;
  }
  function badgeForStatus(status){
    if (status==="Completed") return `<span class="badge ok">Completed</span>`;
    if (status==="Pending") return `<span class="badge warn">Pending</span>`;
    if (status==="Rejected") return `<span class="badge bad">Rejected</span>`;
    if (status==="Returned") return `<span class="badge bad">Returned</span>`;
    return `<span class="badge">${status}</span>`;
  }
  function downloadFile(filename, mime, content){
    const blob = content instanceof Blob ? content : new Blob([content], {type: mime||"text/plain"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 1000);
  }

  // Toasts
  const wrap = document.createElement("div");
  wrap.className = "toast-wrap";
  document.addEventListener("DOMContentLoaded", ()=>document.body.appendChild(wrap));
  function toast(title, body){
    const el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = `<div class="t">${escapeHtml(title||"")}</div><div class="b">${escapeHtml(body||"")}</div>`;
    wrap.appendChild(el);
    setTimeout(()=>{ el.style.opacity="0"; el.style.transform="translateY(8px)"; }, 2700);
    setTimeout(()=>el.remove(), 3200);
  }

  // Drawer
  let drawerBackdrop, drawer, drawerTitle, drawerMeta, drawerBody, drawerFooter;
  function ensureDrawer(){
    if (drawer) return;
    drawerBackdrop = document.createElement("div");
    drawerBackdrop.className = "drawer-backdrop";
    drawerBackdrop.addEventListener("click", closeDrawer);
    drawer = document.createElement("div");
    drawer.className = "drawer";
    drawer.innerHTML = `
      <div class="dhd">
        <div>
          <div class="title"></div>
          <div class="meta"></div>
        </div>
        <button class="btn small ghost" data-x>&times;</button>
      </div>
      <div class="dbd"></div>
      <div class="dft"></div>
    `;
    drawerTitle = qs(".title", drawer);
    drawerMeta = qs(".meta", drawer);
    drawerBody = qs(".dbd", drawer);
    drawerFooter = qs(".dft", drawer);
    qs("[data-x]", drawer).addEventListener("click", closeDrawer);
    document.body.appendChild(drawerBackdrop);
    document.body.appendChild(drawer);
  }
  function openDrawer(opts){
    ensureDrawer();
    drawerTitle.textContent = opts.title || "";
    drawerMeta.textContent = opts.meta || "";
    drawerBody.innerHTML = opts.body || "";
    drawerFooter.innerHTML = "";
    if (opts.footer){
      if (typeof opts.footer==="string") drawerFooter.innerHTML = opts.footer;
      else drawerFooter.appendChild(opts.footer);
    }
    drawerBackdrop.classList.add("show");
    drawer.classList.add("open");
  }
  function closeDrawer(){
    if (!drawer) return;
    drawer.classList.remove("open");
    drawerBackdrop.classList.remove("show");
  }

  // Modal (confirm/prompt)
  let modalBackdrop;
  function ensureModal(){
    if (modalBackdrop) return;
    modalBackdrop = document.createElement("div");
    modalBackdrop.className = "modal-backdrop";
    modalBackdrop.innerHTML = `
      <div class="modal">
        <div class="mhd">
          <div><div class="title" style="font-weight:800">Confirm</div><div class="sub" style="font-size:12px;color:var(--muted);margin-top:4px"></div></div>
          <button class="btn small ghost" data-mx>&times;</button>
        </div>
        <div class="mbd"></div>
        <div class="mft"></div>
      </div>
    `;
    modalBackdrop.addEventListener("click", (e)=>{ if (e.target===modalBackdrop) hideModal(); });
    document.body.appendChild(modalBackdrop);
    qs("[data-mx]", modalBackdrop).addEventListener("click", hideModal);
  }
  function showModal(opts){
    ensureModal();
    qs(".title", modalBackdrop).textContent = opts.title || "Confirm";
    qs(".sub", modalBackdrop).textContent = opts.sub || "";
    qs(".mbd", modalBackdrop).innerHTML = opts.body || "";
    const ft = qs(".mft", modalBackdrop);
    ft.innerHTML = "";
    (opts.buttons||[]).forEach(b=>{
      const btn = document.createElement("button");
      btn.className = "btn " + (b.className||"");
      btn.textContent = b.label || "OK";
      btn.addEventListener("click", ()=>{ if (b.onClick) b.onClick(); });
      ft.appendChild(btn);
    });
    modalBackdrop.classList.add("show");
  }
  function hideModal(){
    if (!modalBackdrop) return;
    modalBackdrop.classList.remove("show");
  }

  function escapeHtml(s){
    return String(s??"").replace(/[&<>"']/g, (c)=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  }

  // Simple charts
  function drawSparkline(canvas, values){
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width, h=canvas.height;
    ctx.clearRect(0,0,w,h);
    if (!values || values.length<2) return;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = 2;
    const scaleY = (v)=> h-pad - ((v-min)/(max-min || 1))*(h-2*pad);
    ctx.beginPath();
    values.forEach((v,i)=>{
      const x = (i/(values.length-1))*(w-2*pad)+pad;
      const y = scaleY(v);
      if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#2563EB";
    ctx.stroke();
  }

  function drawBar(canvas, labels, values){
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width, h=canvas.height;
    ctx.clearRect(0,0,w,h);
    const max = Math.max(...values, 1);
    const pad = 24;
    const barW = (w-pad*2)/values.length;
    values.forEach((v,i)=>{
      const x = pad + i*barW + 6;
      const bh = ((v/max) * (h-pad*2));
      const y = h-pad - bh;
      ctx.fillStyle = "#0B1F3B";
      ctx.globalAlpha = 0.12;
      ctx.fillRect(x,y, barW-14, bh);
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#0B1F3B";
      ctx.fillRect(x,y, barW-14, 2);
    });
    // labels (light)
    ctx.fillStyle = "#5B667A";
    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    labels.forEach((lab,i)=>{
      const x = pad + i*barW + 6;
      ctx.fillText(lab, x, h-8);
    });
  }



  // Multi-select (checkbox dropdown)
  function mountMultiSelect(rootEl, options, onChange){
    if (!rootEl) return;
    const opts = (options || []).map(v=>({value:String(v), label:String(v)}));
    rootEl.classList.add('ms');
    rootEl.innerHTML = `
      <button type="button" class="ms-btn" aria-expanded="false">
        <span class="label"></span>
        <span class="caret">▾</span>
      </button>
      <div class="ms-panel">
        <div class="ms-actions">
          <button type="button" class="btn small ghost" data-ms="all">All</button>
          <button type="button" class="btn small ghost" data-ms="none">None</button>
        </div>
        <div class="ms-list"></div>
      </div>
    `;

    const btn = rootEl.querySelector('.ms-btn');
    const panel = rootEl.querySelector('.ms-panel');
    const label = rootEl.querySelector('.ms-btn .label');
    const list = rootEl.querySelector('.ms-list');

    function render(){
      const sel = msGetValues(rootEl);
      if (!sel.length){
        label.innerHTML = `<span style="opacity:.85">${escapeHtml(rootEl.getAttribute('data-placeholder') || 'All')}</span>`;
      } else {
        label.innerHTML = sel.map(v=>`<span class="ms-tag">${escapeHtml(v)}</span>`).join('');
      }
      if (typeof onChange === 'function') onChange(sel);
    }

    list.innerHTML = opts.map(o=>{
      const id = 'ms_' + Math.random().toString(16).slice(2);
      return `
        <label class="ms-row">
          <input type="checkbox" value="${escapeHtml(o.value)}" />
          <span>${escapeHtml(o.label)}</span>
        </label>
      `;
    }).join('');

    rootEl.addEventListener('change', (e)=>{
      if (e.target && e.target.matches('input[type=checkbox]')) render();
    });

    rootEl.querySelector('[data-ms=all]').addEventListener('click', ()=>{ msSetValues(rootEl, []); render(); });
    rootEl.querySelector('[data-ms=none]').addEventListener('click', ()=>{ msSetValues(rootEl, []); render(); });

    function open(){
      rootEl.classList.add('open');
      btn.setAttribute('aria-expanded','true');
    }
    function close(){
      rootEl.classList.remove('open');
      btn.setAttribute('aria-expanded','false');
    }

    btn.addEventListener('click', (e)=>{
      e.preventDefault();
      rootEl.classList.contains('open') ? close() : open();
    });

    document.addEventListener('click', (e)=>{
      if (!rootEl.contains(e.target)) close();
    });

    render();
  }

  function msGetValues(rootEl){
    const boxes = Array.from(rootEl.querySelectorAll('input[type=checkbox]'));
    return boxes.filter(b=>b.checked).map(b=>b.value);
  }

  function msSetValues(rootEl, values){
    const set = new Set((values || []).map(String));
    Array.from(rootEl.querySelectorAll('input[type=checkbox]')).forEach(b=>{ b.checked = set.has(b.value); });
  }
  window.UI = {
    qs, qsa,
    fmtMoney, fmtNum, fmtPct, fmtDT, durMinToText,
    badgeForSLA, badgeForStatus,
    downloadFile,
    toast,
    openDrawer, closeDrawer,
    showModal, hideModal,
    escapeHtml,
    drawSparkline, drawBar,
    mountMultiSelect, msGetValues, msSetValues
  };
})();
