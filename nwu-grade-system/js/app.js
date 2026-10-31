const ST = { D: 'Pending Dean Approval', V: 'Pending VPAA Approval', C: 'Approved - Awaiting CICT', O: 'Grades Opened', RD: 'Rejected by Dean', RV: 'Rejected by VPAA', X: 'Access Expired' };
const ROLES = { instructor: 'Instructor', dean: 'College Dean', vpaa: 'Vice President for Academic Affairs', cict: 'CICT' };
const CLS = { [ST.D]: 'p', [ST.V]: 'p', [ST.C]: 'a', [ST.O]: 'o', [ST.RD]: 'r', [ST.RV]: 'r', [ST.X]: 'x' };
const HINT = {
  instructor: 'Create requests and follow their approval progress.',
  dean: 'Review requests, then recommend or reject them.',
  vpaa: 'Approve or reject requests recommended by the Dean.',
  cict: 'Open the grade portal only for requests approved by the Dean and VPAA. CICT does not approve or reject.'
};

const STATS = {
  instructor: [['Total Requests', () => 1], ['Pending Requests', r => [ST.D, ST.V].includes(r.status)], ['Approved Requests', r => r.vpaa && r.vpaa.ok], ['Rejected Requests', r => /^Rejected/.test(r.status)], ['Grades Opened', r => r.cict]],
  dean: [['Pending Requests', r => r.status === ST.D], ['Recommended Requests', r => r.dean && r.dean.ok], ['Rejected Requests', r => r.status === ST.RD]],
  vpaa: [['Pending Approval', r => r.status === ST.V], ['Approved Requests', r => r.vpaa && r.vpaa.ok], ['Rejected Requests', r => r.status === ST.RV]],
  cict: [['Awaiting Grade Opening', r => r.status === ST.C], ['Grades Opened', r => r.cict], ['Active Access', r => r.cict && !expd(r)], ['Expired Access', r => r.cict && expd(r)]]
};

const COLLEGES = [
  "College of Allied Health Sciences", "College of Arts and Sciences", "College of Business Education",
  "College of Maritime Education", "College of Teacher Education", "College of Criminal Justice Education",
  "College of Engineering, Architecture, and Technology", "College of International Hospitality and Tourism Management", "College of Culinary Arts"
];

const $ = s => document.querySelector(s), esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
const fmt = d => d ? new Date(d).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const expd = r => {
  if (!r.cict || !r.cict.exp) return false;
  return r.status === ST.O && Date.now() > +new Date(r.cict.exp);
};
const lbl = r => expd(r) ? ST.X : r.status;
const left = r => {
  if (!r.cict || !r.cict.exp) return 'Access active';
  const m = +new Date(r.cict.exp) - Date.now();
  return m > 0 ? Math.floor(m / 36e5) + ' h ' + Math.floor(m % 36e5 / 6e4) + ' min remaining' : 'Expired';
};
const perTxt = r => (r.per || []).join(', ');

let db = { requests: [], notifs: [] }, me = null, view = 'dash', flt = { q: '', st: '', cal: '', sort: 'desc' };

async function api(act, data = {}, isFormData = false) {
  try {
    const opts = { method: (Object.keys(data).length || isFormData) ? 'POST' : 'GET' };
    if (isFormData) {
      opts.body = data;
    } else if (Object.keys(data).length) {
      opts.headers = { 'Content-Type': 'application/json' };
      opts.body = JSON.stringify(data);
    }
    const res = await fetch('api.php?action=' + act, opts);
    return await res.json();
  } catch (e) { return { error: 'Server connection failed.' }; }
}

async function loadData() {
  const res = await api('get_data');
  if (res.user) {
    me = res.user; db.requests = res.requests; db.notifs = res.notifs;
  } else { me = null; }
  renderUI();
}

async function doLogin(e) {
  e.preventDefault();
  const f = e.target;
  const res = await api('login', { username: f.u.value.trim(), p: f.p.value });
  if (res.error) return toast(res.error, 'err');
  view = 'dash';
  flt = { q: '', st: res.user.role === 'cict' ? ST.C : '', cal: '', sort: 'desc' };
  loadData();
}

async function doReg(e) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  if (data.p !== data.c) return toast('Passwords do not match.', 'err');

  const res = await api('register', data);
  if (res.error) return toast(res.error, 'err');

  toast('Account successfully created! Please sign in.');
  e.target.reset();
  tab(0);
}

async function logout() { await api('logout'); loadData(); }

async function submitReq(e) {
  e.preventDefault();
  const f = new FormData(e.target), per = f.getAll('per');
  if (!per.length) return toast('Select at least one grading period.', 'err');

  f.delete('per');
  per.forEach(p => f.append('per[]', p));

  const res = await api('submit', f, true);
  if (res.error) return toast(res.error, 'err');
  toast('Request ' + res.id + ' submitted.');
  view = 'dash'; await loadData(); openR(res.id);
}

async function decide(id, ok) {
  const rm = ($('#rm') ? $('#rm').value : '').trim();
  if (!ok && !rm && me.role !== 'cict') return toast('Add remarks to explain the rejection.', 'err');

  const res = await api('decide', { id, ok, remarks: rm });
  if (res.error) return toast(res.error, 'err');
  toast(me.role === 'cict' ? 'Grades marked as opened.' : 'Decision recorded.');
  await loadData(); openR(id);
}

async function openN(id) {
  const n = db.notifs.find(x => x.id === id); if (!n) return;
  await api('read_notif', { id }); await loadData(); openR(n.rid);
}

async function readAll() { await api('read_all'); loadData(); }

function toast(m, t) { const e = document.createElement('div'); e.className = 'ts ' + (t || ''); e.textContent = m; $('#toast').append(e); setTimeout(() => e.remove(), 3800) }
function drop(id) { const e = $('#' + id), h = e.hidden; document.querySelectorAll('.dd').forEach(d => d.hidden = true); e.hidden = !h }

function go(v) {
  view = v;
  const sb = $('#sb'), sh = document.querySelector('.sh');
  if (sb) sb.classList.remove('open');
  if (sh) sh.classList.remove('sidebar-open');
  renderUI();
}

function tab(i) { $('#li').hidden = !!i; $('#rg').hidden = !i; document.querySelectorAll('.tabs button').forEach((b, j) => b.classList.toggle('on', j == i)) }
function closeM() { $('#modal').innerHTML = '' }

function loginPage() {
  return `<main class="lg"><section class="lc"><img class="logo" src="assets/logo/nwu.png" alt="Northwestern University logo" onerror="this.remove()"><h1>Northwestern University</h1><h2>Grade Opening Request and Approval System</h2>
 <div class="tabs"><button class="on" onclick="tab(0)">Sign in</button><button onclick="tab(1)">Register as instructor</button></div>
 <form id="li" onsubmit="doLogin(event)"><label>Username<input name="u" required autocomplete="username"></label><label>Password<input name="p" type="password" required autocomplete="current-password"></label><button class="btn">Sign in</button></form>
 <form id="rg" hidden onsubmit="doReg(event)">
  <label>Full name<input name="name" required></label>
  <label>College<select name="college" required><option value="">Select College...</option>${COLLEGES.map(c => `<option value="${c}">${c}</option>`).join('')}</select></label>
  <label>Department<input name="dept" required></label>
  <label>Username<input name="u" required minlength="4"></label>
  <label>Password<input name="p" type="password" required minlength="6"></label>
  <label>Confirm password<input name="c" type="password" required></label>
  <button class="btn">Create instructor account</button></form></section></main>`
}

window.toggleSidebar = function () {
  const sh = document.querySelector('.sh');
  const sb = $('#sb');
  if (sb && sh) {
    sb.classList.toggle('open');
    sh.classList.toggle('sidebar-open');
  }
};

function shell() {
  const un = db.notifs.filter(n => !n.read).length, I = me.role === 'instructor';
  const nlist = db.notifs.slice(0, 10).map(n => `<button class="nt ${n.read ? '' : 'un'}" onclick="openN(${n.id})">${esc(n.msg)}<small>${n.rid}</small><small>${fmt(n.at)}</small></button>`).join('') || '<p class="mu pad">No notifications.</p>';

  return `<div class="sh"><aside class="sb" id="sb" style="display: flex; flex-direction: column; justify-content: space-between;">
    <div>
      <div class="bd"><img src="assets/logo/nwu.png" alt="" onerror="this.remove()"><div><b>Northwestern University</b><small>Grade Opening Request and Approval System</small></div></div>
      <nav><button class="${view === 'dash' ? 'on' : ''}" onclick="go('dash')">▦  Dashboard</button>${I ? `<button class="${view === 'new' ? 'on' : ''}" onclick="go('new')">＋  New request</button>` : ''}</nav>
    </div>
  </aside>
  <div class="mn"><header class="tb"><button class="ham" onclick="toggleSidebar()" aria-label="Menu">☰</button><b>${ROLES[me.role]} portal</b><span class="sp"></span>
  <div class="dw"><button class="ib" onclick="drop('nf')" aria-label="Notifications">🔔${un ? `<i>${un}</i>` : ''}</button><div class="dd" id="nf" hidden><button class="lnk" onclick="readAll()">Mark all as read</button>${nlist}</div></div>
  <div class="dw"><button class="pf" onclick="drop('pm')">${esc(me.full_name || me.name)} ▾</button><div class="dd" id="pm" hidden><p><b>${esc(me.full_name || me.name)}</b></p><p class="mu">${ROLES[me.role]}<br>${esc(me.college)}</p><div class="bar"><button class="btn ghost" onclick="logout()">Sign out</button></div></div></div></header>
  <main class="ct">${view === 'new' && I ? newForm() : dash()}</main></div></div>`
}

function dash() {
  const L = db.requests, I = me.role === 'instructor', late = I && L.slice().sort((a, b) => b.created.localeCompare(a.created))[0];
  const nlist = db.notifs.slice(0, 5).map(n => `<button class="nt ${n.read ? '' : 'un'}" onclick="openN(${n.id})">${esc(n.msg)}<small>${n.rid}</small><small>${fmt(n.at)}</small></button>`).join('') || '<p class="mu pad">No notifications.</p>';
  return `<div class="hd"><div><h1>${me.role === 'cict' ? 'Grade opening queue' : 'Dashboard'}</h1><p class="mu">${HINT[me.role]}</p></div>${I ? `<button class="btn" onclick="go('new')">＋ New request</button>` : ''}</div>
 <div class="stats">${STATS[me.role].map(s => `<div class="sc"><b>${L.filter(s[1]).length}</b><span>${s[0]}</span></div>`).join('')}</div>
 <div class="two"><section class="card"><div class="flt"><input placeholder="Search ID, instructor, course" value="${esc(flt.q)}" oninput="flt.q=this.value;renderTable()" aria-label="Search"><select onchange="flt.st=this.value;renderTable()" aria-label="Status"><option value="">All statuses</option>${Object.values(ST).map(s => `<option ${flt.st === s ? 'selected' : ''}>${s}</option>`).join('')}</select><select onchange="flt.cal=this.value;renderTable()" aria-label="Calendar"><option value="">All calendars</option>${['Semester', 'Trimester'].map(s => `<option ${flt.cal === s ? 'selected' : ''}>${s}</option>`).join('')}</select><select onchange="flt.sort=this.value;renderTable()" aria-label="Sort by date"><option value="desc">Newest first</option><option value="asc" ${flt.sort === 'asc' ? 'selected' : ''}>Oldest first</option></select></div><div class="tw" id="tbl"></div></section>
 <div><section class="card"><h4>Notifications</h4>${nlist}</section>${late ? `<section class="card"><h4>Latest request ${late.id}</h4>${tl(late)}</section>` : ''}</div></div>`
}

function renderTable() {
  const tblEl = $('#tbl');
  if (!tblEl) return;

  const t = flt.q.toLowerCase(), I = me.role === 'instructor', c = me.role === 'cict';
  const L = db.requests.filter(r => (!t || [r.id, r.name, r.code, r.title].join(' ').toLowerCase().includes(t)) && (!flt.st || lbl(r) === flt.st) && (!flt.cal || r.calendar === flt.cal)).sort((a, b) => (a.created < b.created ? -1 : 1) * (flt.sort === 'asc' ? 1 : -1));

  let html = L.length ? `<table><thead><tr><th>Request ID</th>${I ? '' : '<th>Instructor</th>'}<th>Course</th><th>Calendar</th><th>Grading period</th><th>${c ? 'Reason' : 'Submitted'}</th><th>Status</th></tr></thead><tbody>${L.map(r => {
    return `<tr onclick="openR('${r.id}')"><td><b>${r.id}</b></td>${I ? '' : `<td>${esc(r.name)}</td>`}<td>${esc(r.code)}<br><span class="mu">${esc(r.title)}</span></td><td>${r.calendar || '—'}</td><td>${perTxt(r)}</td><td>${c ? esc(r.reason.slice(0, 70)) + (r.reason.length > 70 ? '…' : '') : new Date(r.created).toLocaleDateString('en-US', { dateStyle: 'medium' })}</td><td><span class="bg ${CLS[lbl(r)]}">${lbl(r)}</span></td></tr>`;
  }).join('')}</tbody></table>`
    : `<div class="empty"><b>No requests found</b></div>`;

  tblEl.innerHTML = html;
}

function tl(r) {
  const d = r.dean, v = r.vpaa, c = r.cict,
    S = [['Instructor Submitted Request', 'Instructor', r.created, 'done', ''],
    ['Dean Recommendation', 'College Dean', d && d.at, d ? d.ok ? 'done' : 'rej' : 'cur', d && d.remarks],
    ['VPAA Approval', 'VPAA', v && v.at, v ? v.ok ? 'done' : 'rej' : d && d.ok ? 'cur' : 'pend', v && v.remarks],
    ['CICT Opened Grades', 'CICT', c && c.openedAt, c ? 'done' : v && v.ok ? 'cur' : 'pend', c && c.remarks],
    ['Instructor Notified', 'Instructor', c && c.openedAt, c ? 'done' : 'pend', c ? 'Notified of the 48-hour access period.' : '']],
    W = { done: 'Completed', rej: 'Rejected', cur: 'Current stage, awaiting action', pend: 'Pending' };
  return `<ol class="tl">${S.map(s => `<li class="${s[3]}"><b>${s[0]}</b><small>${W[s[3]]}</small><small>${s[1]}${s[2] && s[3] !== 'cur' ? ', ' + fmt(s[2]) : ''}</small>${s[4] ? `<em>Remarks: ${esc(s[4])}</em>` : ''}</li>`).join('')}</ol>`
}

function doc(r, ed) {
  const f = (l, k, t, x) => `<div class="fl"><label>${l}</label>${ed ? `<input name="${k}" type="${t}" value="${esc(r[k] || '')}" ${x}>` : `<span class="rs">${esc(k === 'date' ? new Date((r.date || '').split('T')[0] + 'T00:00:00').toLocaleDateString('en-US', { dateStyle: 'long' }) : r[k]) || '&nbsp;'}</span>`}</div>`,
    sg = (t, role, x, yes) => `<div class="sgn"><b>${t}</b><div class="ln">${x ? esc(x.by) : ''}</div><small>${role}</small>${x ? `<p><b>${x.ok ? yes : 'Rejected'}</b> on ${fmt(x.at)}</p><p>Remarks: ${esc(x.remarks) || '—'}</p>` : ed ? '' : '<p>Pending</p>'}</div>`;

  return `<article id="doc"><header class="dh"><img src="assets/logo/nwu.png" alt="Northwestern University logo" onerror="this.remove()"><div><h2>NORTHWESTERN UNIVERSITY</h2><h3>REQUEST FORM FOR THE OPENING OF GRADE PORTAL</h3></div></header>
 ${ed ? '' : `<div class="meta"><span>Request ID: <b>${r.id}</b></span><span>Submitted: <b>${fmt(r.created)}</b></span><span>Status: <b>${lbl(r)}</b></span></div>`}
 <div class="row">
    ${f('Name of Requesting Instructor', 'name', 'text', 'readonly required')}
    <div class="fl"><label>College</label>${ed ? `<select name="college" required><option value="">Select College...</option>${COLLEGES.map(c => `<option value="${c}" ${r.college === c ? 'selected' : ''}>${c}</option>`).join('')}</select>` : `<span class="rs">${esc(r.college)}</span>`}</div>
    ${f('Academic Year', 'ay', 'text', 'required placeholder="2026-2027"')}
    ${f('Date', 'date', 'date', 'readonly')}
 </div>
 <div class="row">
    ${f('Course Code', 'code', 'text', 'required')}
    ${f('Course Title', 'title', 'text', 'required')}
    ${f('Program/Section', 'section', 'text', 'required placeholder="e.g. BSCS-3A"')}
 </div>
 <div class="fl">
    <label>Academic Calendar</label>
    ${ed ? `<select name="calendar" id="cal_sel" required onchange="updateCalUI()">
      <option value="">Select Calendar...</option>
      <option value="Semester" ${r.calendar === 'Semester' ? 'selected' : ''}>Semester</option>
      <option value="Trimester" ${r.calendar === 'Trimester' ? 'selected' : ''}>Trimester</option>
    </select>` : `<span class="rs">${esc(r.calendar)}</span>`}
 </div>
 <div class="fl" id="sem_block" style="${ed && r.calendar === 'Semester' ? 'display:block;' : 'display:none;'}">
    ${ed ? `
    <label>Semester & Grading Periods</label>
    <table class="pg" style="width:auto">
      <tr><th>Semester</th><th>Prelim</th><th>Midterm</th><th>Finals</th></tr>
      ${['1st Semester', '2nd Semester'].map(s => `<tr><th>${s}</th>${['Prelim', 'Midterm', 'Finals'].map(p => `<td><input type="checkbox" name="per" value="${s} ${p}" class="sem-cb"></td>`).join('')}</tr>`).join('')}
    </table>
    ` : ''}
 </div>
 <div class="fl" id="tri_block" style="${ed && r.calendar === 'Trimester' ? 'display:block;' : 'display:none;'}">
    ${ed ? `
    <label>Trimester & Grading Periods</label>
    <table class="pg" style="width:auto">
      <tr><th>Trimester</th><th>Midterm</th><th>Finals</th></tr>
      ${['1st Trimester', '2nd Trimester', '3rd Trimester'].map(t => `<tr><th>${t}</th>${['Midterm', 'Finals'].map(p => `<td><input type="checkbox" name="per" value="${t} ${p}" class="tri-cb"></td>`).join('')}</tr>`).join('')}
    </table>
    ` : ''}
 </div>
 ${!ed ? `<div class="fl"><label>Requested Grading Periods</label><p class="rs">${esc((r.per || []).join(', '))}</p></div>` : ''}
 <div class="fl"><label>Reason:</label>${ed ? `<textarea name="reason" rows="4" required minlength="10" placeholder="State why the opening of grades is requested"></textarea>` : `<p class="rs">${esc(r.reason)}</p>`}</div>
 ${ed ? `<div class="fl"><label>Supporting Document (Optional)</label><input type="file" name="attachment" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"></div>` : (r.attachment ? `<div class="fl"><label>Attachment</label><a href="${r.attachment}" target="_blank" style="color: blue; text-decoration: underline;">📄 View Document</a></div>` : '')}
 <div class="row ap">${sg('Recommended by:', 'College Dean', r.dean, 'Recommended')}${sg('Approved by:', 'Vice President for Academic Affairs', r.vpaa, 'Approved')}</div>
 ${r.cict ? `<div class="cr"><b>CICT grade-opening record</b><div class="row"><span>Opened by: ${esc(r.cict.by)}</span><span>Access start: ${fmt(r.cict.openedAt)}</span><span>Authorized period: 2 days (48 hours)</span><span>Access expiration: ${fmt(r.cict.exp)}</span><span><b>${left(r)}</b></span></div><p>Remarks: ${esc(r.cict.remarks) || '—'}</p></div>` : ''}</article>`
}

window.updateCalUI = function () {
  const cal = $('#cal_sel')?.value, sb = $('#sem_block'), tb = $('#tri_block');
  if (sb && tb) {
    sb.style.display = cal === 'Semester' ? 'block' : 'none';
    tb.style.display = cal === 'Trimester' ? 'block' : 'none';

    if (cal === 'Semester') {
      tb.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    } else if (cal === 'Trimester') {
      sb.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    }
  }
}

function newForm() {
  const r = { name: me.full_name || me.name, college: me.college, ay: '2026-2027', date: new Date().toLocaleDateString('en-CA') };
  return `<div class="hd"><div><h1>New grade opening request</h1><p class="mu">Complete the official form. It goes to the College Dean, then the VPAA, then CICT.</p></div></div><form id="rf" onsubmit="submitReq(event)">${doc(r, true)}<div class="bar"><button type="button" class="btn ghost" onclick="go('dash')">Cancel</button><button class="btn">Submit request</button></div></form>`
}

function openR(id) {
  const r = db.requests.find(x => x.id === id);
  if (!me || !r) return toast('Request not found.', 'err');
  $('#modal').innerHTML = `<div class="mb" onclick="event.target===this&&closeM()"><div class="md"><div class="bar noprint" style="justify-content:space-between"><h3>Request ${r.id}</h3><div><button class="btn ghost" onclick="window.open('export_pdf.php?id=${r.id}', '_blank')">Export Official PDF</button> <button class="btn ghost" onclick="closeM()">Close</button></div></div>${doc(r, false)}<section class="noprint"><h4 style="margin-top:1rem">Approval timeline</h4>${tl(r)}${acts(r)}</section></div></div>`
}

function acts(r) {
  const rm = '<label>Remarks<textarea id="rm" rows="2" placeholder="Add remarks"></textarea></label>', b = (t, ok, c) => `<button class="btn ${c || ''}" onclick="decide('${r.id}',${ok})">${t}</button>`;
  if (me.role === 'dean' && r.status === ST.D) return `${rm}<div class="bar">${b('Recommend (approve)', true)}${b('Reject', false, 'dng')}</div>`;
  if (me.role === 'vpaa' && r.status === ST.V) return `${rm}<div class="bar">${b('Approve', true)}${b('Reject', false, 'dng')}</div>`;
  if (me.role === 'cict' && r.status === ST.C) return `<p class="mu">CICT will now open grades and grant the 48-hour access window.</p>${rm}<div class="bar">${b('Mark Grades as Opened', true)}</div>`;
  return ''
}

function renderUI() {
  $('#app').innerHTML = me ? shell() : loginPage();
  if (me && view === 'dash') renderTable();
}

// Global click listener to close sidebar on outside clicks
document.addEventListener('click', (e) => {
  const sb = $('#sb');
  const sh = document.querySelector('.sh');
  const ham = document.querySelector('.ham');
  if (sb && sb.classList.contains('open') && !sb.contains(e.target) && (!ham || !ham.contains(e.target))) {
    sb.classList.remove('open');
    if (sh) sh.classList.remove('sidebar-open');
  }
});

loadData();