(() => {
  // Layanan pengambil data. Ganti jika Anda memakai API sendiri.
  const API = 'https://www.tikwm.com/api/';
  const ORIGIN = 'https://www.tikwm.com';
  const VALID = /^https?:\/\/((www|vt|vm|m)\.)?tiktok\.com\//i;

  const $ = (s) => document.querySelector(s);
  const form = $('#form'), input = $('#url'), go = $('#go'), errBox = $('#error');
  const loading = $('#loading'), result = $('#result');
  const historyBox = $('#historyBox'), historyList = $('#history');

  const abs = (u) => (!u ? '' : u.startsWith('http') ? u : ORIGIN + (u.startsWith('/') ? '' : '/') + u);
  const fmt = (n) => (n == null ? '' : n >= 1e6 ? (n / 1e6).toFixed(1) + ' jt' : n >= 1e3 ? (n / 1e3).toFixed(1) + ' rb' : String(n));
  const mb = (b) => (b ? (b / 1048576).toFixed(1) + ' MB' : '');

  let toastTimer;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }
  function showError(msg) { errBox.textContent = msg; errBox.hidden = !msg; }

  // ---- Riwayat (tersimpan di peramban) ----
  const getHistory = () => { try { return JSON.parse(localStorage.getItem('lumen_history')) || []; } catch { return []; } };
  const setHistory = (h) => { try { localStorage.setItem('lumen_history', JSON.stringify(h)); } catch {} };
  function renderHistory() {
    const h = getHistory(); historyBox.hidden = !h.length; historyList.innerHTML = '';
    h.forEach((item) => {
      const li = document.createElement('li');
      const s = document.createElement('span'); s.textContent = item.title || item.url;
      const b = document.createElement('button'); b.textContent = 'Buka lagi';
      b.onclick = () => { input.value = item.url; form.requestSubmit(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
      li.append(s, b); historyList.append(li);
    });
  }
  function pushHistory(url, title) {
    const h = getHistory().filter((x) => x.url !== url);
    h.unshift({ url, title: (title || '').slice(0, 80) });
    setHistory(h.slice(0, 6)); renderHistory();
  }
  $('#clearHistory').onclick = () => { setHistory([]); renderHistory(); };

  // ---- Tempel dari clipboard ----
  $('#paste').onclick = async () => {
    try { input.value = (await navigator.clipboard.readText()).trim(); input.focus(); if (VALID.test(input.value)) form.requestSubmit(); }
    catch { toast('Izinkan akses clipboard atau tempel manual (Ctrl+V)'); input.focus(); }
  };

  // ---- Unduh file ----
  async function download(url, name, btn) {
    const label = btn && btn.innerHTML;
    if (btn) { btn.disabled = true; btn.querySelector('span').textContent = 'Mengunduh…'; }
    try {
      const res = await fetch(url); if (!res.ok) throw new Error();
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = name;
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast('Unduhan dimulai');
    } catch {
      window.open(url, '_blank', 'noopener'); // cadangan jika diblokir CORS
      toast('Dibuka di tab baru. Tekan lama atau Simpan untuk mengunduh.');
    } finally { if (btn) { btn.disabled = false; btn.innerHTML = label; } }
  }

  function dlButton(text, sub, url, name, primary) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'dl' + (primary ? ' primary' : '');
    b.innerHTML = '<span></span><small></small>';
    b.firstChild.textContent = text; b.lastChild.textContent = sub || '';
    b.onclick = () => download(url, name, b);
    return b;
  }

  // ---- Tampilkan hasil ----
  function render(d) {
    const id = d.id || Date.now(), images = d.images || [];
    const isPhoto = images.length > 0;
    result.className = 'result' + (isPhoto ? ' photo-mode' : '');
    result.innerHTML = '';

    const info = document.createElement('div'); info.className = 'info';
    const author = document.createElement('div'); author.className = 'author';
    const av = document.createElement('img'); av.src = abs(d.author && d.author.avatar); av.alt = '';
    const who = document.createElement('div');
    const nm = document.createElement('b'); nm.textContent = (d.author && d.author.nickname) || 'TikTok';
    const un = document.createElement('span'); un.textContent = d.author && d.author.unique_id ? '@' + d.author.unique_id : '';
    who.append(nm, un); author.append(av, who);
    const title = document.createElement('p'); title.className = 'title'; title.textContent = d.title || '';
    const stats = document.createElement('div'); stats.className = 'stats';
    [['Ditonton', d.play_count], ['Suka', d.digg_count], ['Komentar', d.comment_count]]
      .filter(([, v]) => v != null).forEach(([k, v]) => { const s = document.createElement('span'); s.textContent = `${fmt(v)} ${k.toLowerCase()}`; stats.append(s); });
    const actions = document.createElement('div'); actions.className = 'actions';
    info.append(author, title, stats, actions);

    if (isPhoto) {
      const grid = document.createElement('div'); grid.className = 'photos';
      images.forEach((u, i) => {
        const f = document.createElement('div'); f.className = 'photo';
        const im = document.createElement('img'); im.src = abs(u); im.loading = 'lazy'; im.alt = `Foto ${i + 1}`;
        const b = document.createElement('button'); b.type = 'button'; b.textContent = 'Simpan foto';
        b.onclick = () => download(abs(u), `tiktok-${id}-${i + 1}.jpg`);
        f.append(im, b); grid.append(f);
      });
      const all = document.createElement('button'); all.type = 'button'; all.className = 'dl primary';
      all.innerHTML = `<span>Unduh semua foto</span><small>${images.length} foto</small>`;
      all.onclick = async () => {
        all.disabled = true;
        for (let i = 0; i < images.length; i++) { await download(abs(images[i]), `tiktok-${id}-${i + 1}.jpg`); await new Promise((r) => setTimeout(r, 450)); }
        all.disabled = false;
      };
      actions.append(all);
      if (d.music) actions.append(dlButton('Musik MP3', '', abs(d.music), `tiktok-${id}.mp3`));
      result.append(info, grid);
    } else {
      const media = document.createElement('div'); media.className = 'media';
      const v = document.createElement('video'); v.controls = true; v.playsInline = true; v.preload = 'metadata';
      v.poster = abs(d.cover); v.src = abs(d.play);
      media.append(v);
      const hd = d.hdplay ? abs(d.hdplay) : abs(d.play);
      actions.append(dlButton(d.hdplay ? 'Video HD tanpa watermark' : 'Video tanpa watermark', mb(d.hd_size || d.size), hd, `tiktok-${id}-hd.mp4`, true));
      if (d.hdplay && d.play) actions.append(dlButton('Video SD tanpa watermark', mb(d.size), abs(d.play), `tiktok-${id}-sd.mp4`));
      if (d.wmplay) actions.append(dlButton('Video dengan watermark', mb(d.wm_size), abs(d.wmplay), `tiktok-${id}-wm.mp4`));
      if (d.music) actions.append(dlButton('Musik MP3', '', abs(d.music), `tiktok-${id}.mp3`));
      if (d.cover) actions.append(dlButton('Gambar sampul', '', abs(d.cover), `tiktok-${id}-cover.jpg`));
      result.append(media, info);
    }
    result.hidden = false;
    result.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---- Kirim form ----
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); showError(''); result.hidden = true;
    const url = input.value.trim();
    if (!url) return showError('Tempel tautan TikTok terlebih dahulu.');
    if (!VALID.test(url)) return showError('Tautan tidak dikenali. Gunakan tautan dari tombol Bagikan di TikTok.');
    go.disabled = true; loading.hidden = false;
    try {
      const res = await fetch(`${API}?url=${encodeURIComponent(url)}&hd=1`);
      const json = await res.json();
      if (json.code !== 0 || !json.data) throw new Error(json.msg || 'gagal');
      render(json.data); pushHistory(url, json.data.title);
    } catch (err) {
      showError('Konten tidak dapat diambil. Pastikan akun tidak privat dan tautannya aktif, lalu coba lagi.');
    } finally { go.disabled = false; loading.hidden = true; }
  });

  input.addEventListener('input', () => showError(''));
  renderHistory();
})();
