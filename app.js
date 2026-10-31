/* SnapLedger - Photobooth Accounting System | Vanilla JS + LocalStorage */
const KEY = 'snapledger.v1';
const $ = s => document.querySelector(s);
const rp = n => (n < 0 ? '-Rp ' : 'Rp ') + Math.abs(Math.round(n)).toLocaleString('id-ID');
const isoDay = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const today = () => isoDay(0);

const COA = [
  ['1101','Kas','Aset'],['1102','Bank / QRIS','Aset'],['1201','Persediaan Kertas & Tinta','Aset'],
  ['1301','Peralatan Photobooth','Aset'],['1302','Akumulasi Penyusutan Peralatan','Aset'],
  ['2101','Utang Usaha','Liabilitas'],['3101','Modal Pemilik','Ekuitas'],['3201','Laba Ditahan','Ekuitas'],
  ['4101','Pendapatan Usaha Photobooth','Pendapatan'],['4102','Pendapatan Aksesoris','Pendapatan'],
  ['5101','Beban Bahan Baku','Beban'],['5102','Beban Listrik & Sewa','Beban'],['5103','Beban Maintenance Alat','Beban'],
  ['5104','Beban Gaji','Beban'],['5105','Beban Penyusutan Peralatan','Beban']
];
const PAKET = { 'Strip Klasik':[25000,1], 'Paket Couple':[45000,2], 'Paket Grup':[65000,3] };
const AKS = { 'Frame Custom':5000, 'Props Premium':3000, 'Soft File':7000 };
const CATS = { 'Bahan Baku Foto':'1201', 'Listrik/Sewa':'5102', 'Maintenance Alat':'5103', 'Gaji':'5104' };
const acc = c => COA.find(a => a[0] === c);
const isDebitNormal = c => ['Aset','Beban'].includes(acc(c)[2]) && c !== '1302';

let S = load();
function load() { try { return JSON.parse(localStorage.getItem(KEY)) || seed(); } catch { return seed(); } }
function save() { localStorage.setItem(KEY, JSON.stringify(S)); }

function seed() {
  const s = { journals: [], stock: { kertas: 1200, tinta: 85 }, closed: [], n: 0 };
  const add = (date, desc, ref, lines, extra = {}) => s.journals.push({ id: ++s.n, date, desc, ref, lines, ...extra });
  add(isoDay(8), 'Setoran modal awal', 'JU-0', [['1101',5e6,0],['1102',2e6,0],['1201',1e6,0],['1301',15e6,0],['3101',0,23e6]]);
  const sales = [[6,'Couple x4',1,180000,'1101'],[5,'Grup x3',1,195000,'1102'],[4,'Klasik x10',1,270000,'1102'],
    [3,'Couple x5 + frame',1,240000,'1101'],[2,'Grup x4',1,275000,'1102'],[1,'Klasik x14',1,380000,'1101'],[0,'Couple x6',1,290000,'1102']];
  sales.forEach(([d,t,,tot,m]) => { const aks = Math.round(tot * 0.1 / 1000) * 1000;
    add(isoDay(d), 'Penjualan: ' + t, 'POS-' + (s.n + 1), [[m,tot,0],['4101',0,tot-aks],['4102',0,aks]]); });
  add(isoDay(5), 'Beli kertas foto & tinta', 'EXP-1', [['1201',600000,0],['1101',0,600000]]);
  add(isoDay(4), 'Bayar listrik & sewa lokasi', 'EXP-2', [['5102',450000,0],['1102',0,450000]]);
  add(isoDay(2), 'Servis printer', 'EXP-3', [['5103',150000,0],['1101',0,150000]]);
  add(isoDay(1), 'Gaji kasir mingguan', 'EXP-4', [['5104',350000,0],['1101',0,350000]]);
  return s;
}

/* ---------- Accounting engine ---------- */
function postJournal(date, desc, ref, lines, extra = {}) {
  lines = lines.filter(l => l[1] > 0 || l[2] > 0);
  const d = lines.reduce((a, l) => a + l[1], 0), k = lines.reduce((a, l) => a + l[2], 0);
  if (!date || !desc || !lines.length) { toast('Field wajib belum lengkap.', true); return false; }
  if (Math.round(d) !== Math.round(k)) { toast(`Debit (${rp(d)}) dan kredit (${rp(k)}) tidak seimbang. Jurnal ditolak.`, true); return false; }
  S.journals.push({ id: ++S.n, date, desc, ref, lines, ...extra }); save(); return true;
}
function totals(filter = () => true) {
  const t = {}; COA.forEach(a => t[a[0]] = [0, 0]);
  S.journals.filter(filter).forEach(j => j.lines.forEach(l => { t[l[0]][0] += l[1]; t[l[0]][1] += l[2]; }));
  return t;
}
const bal = (t, c) => isDebitNormal(c) ? t[c][0] - t[c][1] : t[c][1] - t[c][0];
const sumCat = (t, cat) => COA.filter(a => a[2] === cat).reduce((a, x) => a + bal(t, x[0]), 0);

/* ---------- UI helpers ---------- */
function toast(msg, err) {
  const el = document.createElement('div');
  el.className = 'px-4 py-3 rounded-xl text-sm font-semibold shadow-lg mb-2 ' + (err ? 'bad' : 'ok'); el.textContent = msg;
  $('#toast').appendChild(el); setTimeout(() => el.remove(), 3500);
}
function modal(html) { $('#modalBody').innerHTML = html + '<button class="btn w-full mt-4" onclick="$(\'#modal\').classList.add(\'hidden\')">Tutup</button>'; $('#modal').classList.remove('hidden'); }
const opts = arr => arr.map(x => `<option value="${x}">${x}</option>`).join('');
const table = (head, rows) => `<div class="overflow-x-auto"><table class="t"><thead><tr>${head.map(h => `<th class="${/Debit|Kredit|Saldo|Rp/.test(h) ? 'num' : ''}">${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
const kpi = (l, v, c = '') => `<div class="card"><div class="text-xs font-semibold text-slate-500">${l}</div><div class="text-2xl font-extrabold mt-1 ${c}">${v}</div></div>`;
let charts = [];

/* ---------- Views ---------- */
const VIEWS = {
  dashboard: ['Dashboard Utama', () => {
    const t = totals(), tod = totals(j => j.date === today() && !j.closing);
    const omset = sumCat(tod, 'Pendapatan'), keluar = sumCat(tod, 'Beban') + tod['1201'][0];
    const lr = sumCat(totals(j => !j.closing), 'Pendapatan') - sumCat(totals(j => !j.closing), 'Beban');
    setTimeout(drawCharts, 0);
    return `<div class="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
      ${kpi('Omset hari ini', rp(omset))}${kpi('Pengeluaran hari ini', rp(keluar), 'text-rose-600')}
      ${kpi('Laba bersih periode', rp(lr), lr >= 0 ? 'text-emerald-600' : 'text-rose-600')}
      ${kpi('Sisa stok bahan', `${S.stock.kertas} lbr kertas · tinta ${S.stock.tinta.toFixed(0)}%`, S.stock.kertas < 200 || S.stock.tinta < 20 ? 'text-rose-600 !text-lg' : '!text-lg')}</div>
      <div class="grid lg:grid-cols-2 gap-4"><div class="card"><h3 class="font-bold mb-2">Penjualan harian</h3><canvas id="c1"></canvas></div>
      <div class="card"><h3 class="font-bold mb-2">Beban operasional</h3><canvas id="c2"></canvas></div></div>`;
  }],
  pos: ['Kasir / Transaksi Penjualan', () => `<div class="grid md:grid-cols-2 gap-4"><div class="card space-y-3">
    <div><label class="l">Paket foto</label><select id="pk" class="inp" onchange="posCalc()">${opts(Object.keys(PAKET))}</select></div>
    <div><label class="l">Jumlah cetak</label><input id="qty" type="number" min="1" value="1" class="inp" oninput="posCalc()"></div>
    <div><label class="l">Tambahan aksesoris</label>${Object.entries(AKS).map(([k, v]) => `<label class="flex gap-2 text-sm"><input type="checkbox" class="ak" value="${k}" onchange="posCalc()"> ${k} (+${rp(v)})</label>`).join('')}</div>
    <div><label class="l">Metode pembayaran</label><select id="pay" class="inp"><option value="1101">Cash</option><option value="1102">QRIS</option></select></div>
    <button class="btn w-full" onclick="posSubmit()">Proses Transaksi</button></div>
    <div class="card"><div class="text-sm text-slate-500">Total bayar</div><div id="tot" class="text-4xl font-extrabold text-violet-700 mt-1">Rp 0</div>
    <p class="text-xs text-slate-500 mt-4">Sistem otomatis menjurnal: Debit Kas/Bank, Kredit Pendapatan Photobooth &amp; Aksesoris.</p></div></div>`],
  expense: ['Pembelian & Pengeluaran', () => `<div class="grid md:grid-cols-2 gap-4"><div class="card space-y-3">
    <div><label class="l">Kategori</label><select id="cat" class="inp">${opts(Object.keys(CATS))}</select></div>
    <div><label class="l">Keterangan</label><input id="ket" class="inp" placeholder="contoh: Beli kertas 500 lembar"></div>
    <div><label class="l">Nominal (Rp)</label><input id="nom" type="number" min="0" class="inp"></div>
    <div><label class="l">Tambah stok kertas (lembar, khusus bahan baku)</label><input id="stk" type="number" min="0" value="0" class="inp"></div>
    <div><label class="l">Dibayar dari</label><select id="src" class="inp"><option value="1101">Kas</option><option value="1102">Bank / QRIS</option></select></div>
    <button class="btn w-full" onclick="expSubmit()">Simpan Pengeluaran</button></div>
    <div class="card"><h3 class="font-bold mb-2">Pengeluaran terakhir</h3>${table(['Tanggal','Keterangan','Rp'], S.journals.filter(j => /^EXP/.test(j.ref)).slice(-8).reverse().map(j => `<tr><td>${j.date}</td><td>${j.desc}</td><td class="num">${rp(j.lines[0][1])}</td></tr>`))}</div></div>`],
  coa: ['Daftar Akun (CoA)', () => `<div class="card">${table(['Kode','Nama Akun','Kategori'], COA.map(a => `<tr><td>${a[0]}</td><td>${a[1]}</td><td>${a[2]}</td></tr>`))}</div>`],
  journal: ['Jurnal Umum', () => { const rows = [];
    S.journals.slice().sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id).forEach(j => j.lines.forEach((l, i) =>
      rows.push(`<tr><td>${i ? '' : j.date}</td><td class="${l[2] ? 'pl-6' : ''}">${i ? '' : '<b>' + j.desc + '</b><br>'}${acc(l[0])[1]}</td><td>${l[0]}</td><td class="num">${l[1] ? rp(l[1]) : ''}</td><td class="num">${l[2] ? rp(l[2]) : ''}</td></tr>`)));
    return `<div class="card">${table(['Tanggal','Keterangan','Ref','Debit','Kredit'], rows)}</div>`; }],
  ledger: ['Buku Besar', () => `<div class="card"><label class="l">Pilih akun</label><select id="lacc" class="inp max-w-sm mb-4" onchange="drawLedger()">${COA.map(a => `<option value="${a[0]}">${a[0]} - ${a[1]}</option>`).join('')}</select><div id="lout"></div></div>`],
  tb: ['Neraca Saldo', () => { const t = totals(); let D = 0, K = 0;
    const rows = COA.map(a => { const b = t[a[0]][0] - t[a[0]][1]; const d = b > 0 ? b : 0, k = b < 0 ? -b : 0; D += d; K += k;
      return `<tr><td>${a[0]}</td><td>${a[1]}</td><td class="num">${d ? rp(d) : ''}</td><td class="num">${k ? rp(k) : ''}</td></tr>`; });
    rows.push(`<tr class="font-bold"><td></td><td>Total</td><td class="num">${rp(D)}</td><td class="num">${rp(K)}</td></tr>`);
    return `<div class="card"><div class="inline-block px-3 py-1 rounded-full text-sm font-bold mb-3 ${Math.round(D) === Math.round(K) ? 'ok' : 'bad'}">${Math.round(D) === Math.round(K) ? 'SEIMBANG' : 'TIDAK SEIMBANG'}</div>${table(['Kode','Akun','Debit','Kredit'], rows)}</div>`; }],
  adj: ['Jurnal Penyesuaian', () => `<div class="grid md:grid-cols-2 gap-4">
    <div class="card space-y-3"><h3 class="font-bold">Penyusutan kamera/printer</h3><p class="text-xs text-slate-500">Debit Beban Penyusutan, Kredit Akumulasi Penyusutan.</p>
      <div><label class="l">Nominal (Rp)</label><input id="dep" type="number" min="0" value="250000" class="inp"></div><button class="btn" onclick="adjSubmit('dep')">Catat Penyusutan</button></div>
    <div class="card space-y-3"><h3 class="font-bold">Pemakaian bahan baku</h3><p class="text-xs text-slate-500">Debit Beban Bahan Baku, Kredit Persediaan.</p>
      <div><label class="l">Nominal pemakaian (Rp)</label><input id="use" type="number" min="0" value="300000" class="inp"></div><button class="btn" onclick="adjSubmit('use')">Catat Pemakaian</button></div></div>
    <div class="card mt-4"><h3 class="font-bold mb-2">Riwayat penyesuaian</h3>${table(['Tanggal','Keterangan','Rp'], S.journals.filter(j => j.adj).map(j => `<tr><td>${j.date}</td><td>${j.desc}</td><td class="num">${rp(j.lines[0][1])}</td></tr>`))}</div>`],
  is: ['Laporan Laba Rugi', () => { const t = totals(j => !j.closing); const sec = c => COA.filter(a => a[2] === c).map(a => `<tr><td>${a[1]}</td><td class="num">${rp(bal(t, a[0]))}</td></tr>`).join('');
    const p = sumCat(t, 'Pendapatan'), b = sumCat(t, 'Beban'), lr = p - b;
    return `<div class="card max-w-2xl"><h3 class="font-bold">SnapLedger Photobooth</h3><p class="text-xs text-slate-500 mb-3">Laporan Laba Rugi · s.d. ${today()}</p>
    <table class="t"><tr><th colspan="2">Pendapatan</th></tr>${sec('Pendapatan')}<tr class="font-bold"><td>Total Pendapatan</td><td class="num">${rp(p)}</td></tr>
    <tr><th colspan="2">Beban</th></tr>${sec('Beban')}<tr class="font-bold"><td>Total Beban</td><td class="num">${rp(b)}</td></tr>
    <tr class="font-extrabold text-lg ${lr >= 0 ? 'text-emerald-600' : 'text-rose-600'}"><td>${lr >= 0 ? 'Laba' : 'Rugi'} Bersih</td><td class="num">${rp(lr)}</td></tr></table>${reportActions()}</div>`; }],
  bs: ['Neraca', () => { const t = totals(), lb = sumCat(t, 'Pendapatan') - sumCat(t, 'Beban');
    const sec = c => COA.filter(a => a[2] === c).map(a => `<tr><td>${a[1]}</td><td class="num">${rp(a[0] === '1302' ? -bal(t, a[0]) : bal(t, a[0]))}</td></tr>`).join('');
    const A = sumCat(t, 'Aset') - 2 * bal(t, '1302'), L = sumCat(t, 'Liabilitas'), E = sumCat(t, 'Ekuitas') + lb;
    return `<div class="card max-w-2xl"><h3 class="font-bold">SnapLedger Photobooth</h3><p class="text-xs text-slate-500 mb-3">Neraca · per ${today()}</p>
    <table class="t"><tr><th colspan="2">Aset</th></tr>${sec('Aset')}<tr class="font-bold"><td>Total Aset</td><td class="num">${rp(A)}</td></tr>
    <tr><th colspan="2">Liabilitas</th></tr>${sec('Liabilitas')}<tr><th colspan="2">Ekuitas</th></tr>${sec('Ekuitas')}<tr><td>Laba periode berjalan</td><td class="num">${rp(lb)}</td></tr>
    <tr class="font-bold"><td>Total Liabilitas + Ekuitas</td><td class="num">${rp(L + E)}</td></tr></table>
    <div class="mt-3 inline-block px-3 py-1 rounded-full text-sm font-bold ${Math.round(A) === Math.round(L + E) ? 'ok' : 'bad'}">${Math.round(A) === Math.round(L + E) ? 'Aset = Liabilitas + Ekuitas' : 'Tidak seimbang'}</div>${reportActions()}</div>`; }]
};
const reportActions = () => `<div class="no-print flex gap-2 mt-4"><button class="btn" onclick="window.print()">Export PDF / Print</button><button class="btn btn-alt" onclick="closeBook()">Close Book Periode</button></div>`;

/* ---------- Actions ---------- */
function posCalc() {
  const [h, k] = PAKET[$('#pk').value], q = +$('#qty').value || 0;
  const a = [...document.querySelectorAll('.ak:checked')].reduce((s, c) => s + AKS[c.value], 0);
  return { paket: h * q, aks: a * q, kertas: k * q, total: (h + a) * q, q };
}
function posSubmit() {
  const c = posCalc(); if (c.q < 1) return toast('Jumlah cetak minimal 1.', true);
  if (S.stock.kertas < c.kertas) return toast('Stok kertas tidak cukup.', true);
  const m = $('#pay').value, ref = 'POS-' + (S.n + 1);
  if (postJournal(today(), `Penjualan: ${$('#pk').value} x${c.q}`, ref, [[m, c.total, 0], ['4101', 0, c.paket], ['4102', 0, c.aks]])) {
    S.stock.kertas -= c.kertas; S.stock.tinta = Math.max(0, S.stock.tinta - 0.15 * c.q); save();
    modal(`<h3 class="font-extrabold text-lg">Transaksi berhasil</h3><p class="text-sm text-slate-500">${ref} · ${m === '1101' ? 'Cash' : 'QRIS'}</p><p class="text-3xl font-extrabold text-violet-700 my-2">${rp(c.total)}</p><p class="text-xs">Jurnal otomatis tercatat.</p>`);
    show('pos');
  }
}
function expSubmit() {
  const n = +$('#nom').value, cat = $('#cat').value, ket = $('#ket').value.trim();
  if (!ket || !(n > 0)) return toast('Keterangan dan nominal wajib diisi.', true);
  if (postJournal(today(), `${cat}: ${ket}`, 'EXP-' + (S.n + 1), [[CATS[cat], n, 0], [$('#src').value, 0, n]])) {
    if (cat === 'Bahan Baku Foto') { S.stock.kertas += +$('#stk').value || 0; save(); }
    toast('Pengeluaran tersimpan & dijurnal.'); show('expense');
  }
}
function adjSubmit(type) {
  const n = +$('#' + type).value; if (!(n > 0)) return toast('Nominal wajib diisi.', true);
  const lines = type === 'dep' ? [['5105', n, 0], ['1302', 0, n]] : [['5101', n, 0], ['1201', 0, n]];
  if (postJournal(today(), type === 'dep' ? 'AJP: Penyusutan peralatan' : 'AJP: Pemakaian bahan baku', 'AJP-' + (S.n + 1), lines, { adj: true })) { toast('Jurnal penyesuaian dicatat.'); show('adj'); }
}
function closeBook() {
  if (!confirm('Tutup buku? Pendapatan & beban akan ditutup ke Laba Ditahan.')) return;
  const t = totals(), lines = []; let lr = 0;
  COA.filter(a => a[2] === 'Pendapatan' || a[2] === 'Beban').forEach(a => { const b = t[a[0]][0] - t[a[0]][1]; if (!b) return;
    lines.push(b < 0 ? [a[0], -b, 0] : [a[0], 0, b]); lr -= b; });
  if (!lines.length) return toast('Tidak ada saldo untuk ditutup.', true);
  lines.push(lr >= 0 ? ['3201', 0, lr] : ['3201', -lr, 0]);
  if (postJournal(today(), 'Jurnal penutup periode', 'CLS-' + (S.n + 1), lines, { closing: true })) { S.closed.push(today()); save(); toast('Periode ditutup. Laba dipindah ke Laba Ditahan.'); show('bs'); }
}
function drawLedger() {
  const c = $('#lacc').value; let run = 0;
  const rows = S.journals.slice().sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id).flatMap(j => j.lines.filter(l => l[0] === c).map(l => {
    run += isDebitNormal(c) ? l[1] - l[2] : l[2] - l[1];
    return `<tr><td>${j.date}</td><td>${j.desc}</td><td class="num">${l[1] ? rp(l[1]) : ''}</td><td class="num">${l[2] ? rp(l[2]) : ''}</td><td class="num">${rp(run)}</td></tr>`; }));
  $('#lout').innerHTML = table(['Tanggal','Keterangan','Debit','Kredit','Saldo'], rows);
}
function drawCharts() {
  charts.forEach(c => c.destroy()); charts = [];
  const days = [6,5,4,3,2,1,0].map(isoDay);
  const rev = days.map(d => sumCat(totals(j => j.date === d && !j.closing), 'Pendapatan'));
  charts.push(new Chart($('#c1'), { type: 'line', data: { labels: days.map(d => d.slice(5)), datasets: [{ label: 'Penjualan', data: rev, borderColor: '#6d28d9', backgroundColor: 'rgba(109,40,217,.15)', fill: true, tension: .35 }] }, options: { plugins: { legend: { display: false } } } }));
  const t = totals(j => !j.closing), ex = COA.filter(a => a[2] === 'Beban' && bal(t, a[0]) > 0);
  charts.push(new Chart($('#c2'), { type: 'doughnut', data: { labels: ex.map(a => a[1]), datasets: [{ data: ex.map(a => bal(t, a[0])), backgroundColor: ['#4c1d95','#6d28d9','#818cf8','#a5b4fc','#c4b5fd'] }] }, options: { plugins: { legend: { position: 'bottom' } } } }));
}

/* ---------- Router ---------- */
const GROUPS = { dashboard: null, pos: 'Transaksi', expense: null, coa: 'Siklus Akuntansi', journal: null, ledger: null, tb: null, adj: null, is: 'Laporan', bs: null };
function show(v) {
  $('#title').textContent = VIEWS[v][0]; $('#view').innerHTML = VIEWS[v][1]();
  $('#period').textContent = 'Periode berjalan · ' + today() + (S.closed.length ? ` · terakhir ditutup ${S.closed.at(-1)}` : '');
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('active', b.dataset.v === v));
  if (v === 'ledger') drawLedger(); if (v === 'pos') posCalc() && ($('#tot').textContent = rp(posCalc().total));
  location.hash = v;
}
const _calc = posCalc; posCalc = function () { const r = _calc(); const el = $('#tot'); if (el) el.textContent = rp(r.total); return r; };
$('#nav').innerHTML = Object.keys(VIEWS).map(v => (GROUPS[v] ? `<div class="grp">${GROUPS[v]}</div>` : '') + `<button data-v="${v}">${VIEWS[v][0]}</button>`).join('');
$('#nav').onclick = e => e.target.dataset.v && show(e.target.dataset.v);
document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => show(b.dataset.go));
$('#btnReset').onclick = () => { if (confirm('Reset semua data ke data demo?')) { localStorage.removeItem(KEY); S = seed(); save(); show('dashboard'); } };
show(VIEWS[location.hash.slice(1)] ? location.hash.slice(1) : 'dashboard');
