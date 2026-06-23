/* =====================================================================
   admin.js – Quản trị nội dung Bảo tàng số 3D
   Lưu trữ: GitHub Contents API (commit thẳng assets/data/exhibits.json).
   Cơ chế: admin nhập fine-grained token (Contents: read+write cho repo này),
   token lưu ở localStorage. "Lưu lên web" = PUT file -> Pages tự build lại.
   ===================================================================== */
(function () {
  'use strict';

  /* ----------------------------- Cấu hình ----------------------------- */
  var OWNER = 'Rei-1407';
  var REPO = 'Web-DPT';
  var BRANCH = 'main';
  var DATA_PATH = 'assets/data/exhibits.json';
  var SETTINGS_PATH = 'assets/data/settings.json';
  var MEDIA_DIR = 'assets/exhibits';
  var AUDIO_DIR = 'assets/audio';
  var API = 'https://api.github.com/repos/' + OWNER + '/' + REPO + '/contents/';
  var TOKEN_KEY = 'webdpt_gh_token';

  /* ----------------------------- Trạng thái --------------------------- */
  var exhibits = {};      // { board_id: {type, src, title, desc, link} }
  var dataSha = null;     // sha hiện tại của exhibits.json (cần để cập nhật)
  var editingId = null;   // đang sửa bảng nào (null = thêm mới)
  var settings = null;    // { sound: {...} } – cấu hình âm thanh
  var settingsSha = null; // sha hiện tại của settings.json

  /* --------------------------- Tiện ích DOM --------------------------- */
  function $(id) { return document.getElementById(id); }
  function token() { return localStorage.getItem(TOKEN_KEY) || ''; }
  function headers(json) {
    var h = { 'Accept': 'application/vnd.github+json' };
    if (token()) h['Authorization'] = 'Bearer ' + token();
    if (json) h['Content-Type'] = 'application/json';
    return h;
  }
  function setStatus(el, msg, isErr) {
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('is-error', !!isErr);
  }
  var setTokenStatus = function (m, e) { setStatus($('tokenStatus'), m, e); };
  var setSaveStatus = function (m, e) { setStatus($('saveStatus'), m, e); };
  var setUploadStatus = function (m, e) { setStatus($('uploadStatus'), m, e); };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c];
    });
  }
  function escAttr(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ------------------ Mã hoá UTF-8 <-> base64 (cho API) --------------- */
  function utf8ToBase64(str) {
    var bytes = new TextEncoder().encode(str);
    var bin = '', chunk = 0x8000;
    for (var i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(bin);
  }
  function base64ToUtf8(b64) {
    var bin = atob(String(b64).replace(/\s/g, ''));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  /* --------------------------- Tải dữ liệu ---------------------------- */
  function loadData() {
    setSaveStatus('Đang tải dữ liệu từ GitHub…');
    fetch(API + DATA_PATH + '?ref=' + BRANCH + '&t=' + Date.now(), { headers: headers() })
      .then(function (res) {
        if (res.status === 404) {
          // Repo riêng tư: 404 khi CHƯA có token thường là "thiếu quyền đọc", không
          // phải file vắng. Phân biệt 2 trường hợp để báo cho đúng.
          exhibits = {}; dataSha = null;
          setSaveStatus(token()
            ? 'Chưa có exhibits.json trên repo — bắt đầu với danh sách trống.'
            : 'Repo riêng tư: nhập token ở bước 1 rồi bấm “Lưu & kiểm tra” để tải nội dung.', !token());
          renderList(); return null;
        }
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (j) {
        if (!j) return;
        dataSha = j.sha;
        try { exhibits = JSON.parse(base64ToUtf8(j.content)) || {}; }
        catch (e) { exhibits = {}; throw new Error('exhibits.json không hợp lệ: ' + e.message); }
        setSaveStatus('Đã tải ' + Object.keys(exhibits).length + ' bảng từ GitHub.');
        renderList();
      })
      .catch(function (e) {
        setSaveStatus('Lỗi tải dữ liệu: ' + e.message + ' (kiểm tra token / mạng).', true);
        renderList();
      });
  }

  /* --------------------------- Lưu lên web ---------------------------- */
  function refreshSha() {
    return fetch(API + DATA_PATH + '?ref=' + BRANCH + '&t=' + Date.now(), { headers: headers() })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j) dataSha = j.sha; })
      .catch(function () {});
  }

  function putData() {
    var json = JSON.stringify(exhibits, null, 2) + '\n';
    var body = {
      message: 'admin: cập nhật nội dung bảng (' + new Date().toISOString() + ')',
      content: utf8ToBase64(json),
      branch: BRANCH
    };
    if (dataSha) body.sha = dataSha;
    return fetch(API + DATA_PATH, { method: 'PUT', headers: headers(true), body: JSON.stringify(body) });
  }

  function saveData() {
    if (!token()) { setSaveStatus('Cần nhập token GitHub ở bước 1 trước khi lưu.', true); return; }
    setSaveStatus('Đang lưu lên GitHub…');
    // Nếu chưa có sha (vd loadData lỗi mạng nhưng file đã tồn tại) -> lấy sha trước
    // để PUT không bị 422 "sha required".
    var ensure = dataSha ? Promise.resolve() : refreshSha();
    ensure.then(putData)
      .then(function (res) {
        // 409 = sha cũ (ai đó vừa sửa) -> lấy sha mới rồi thử lại 1 lần
        if (res.status === 409) { return refreshSha().then(putData); }
        return res;
      })
      .then(function (res) {
        if (!res.ok) {
          return res.text().then(function (t) { throw new Error('HTTP ' + res.status + ' – ' + t.slice(0, 200)); });
        }
        return res.json();
      })
      .then(function (j) {
        dataSha = (j && j.content && j.content.sha) || dataSha;
        setSaveStatus('✓ Đã lưu lên web. GitHub Pages sẽ cập nhật sau ~1–2 phút (F5 lại trang 3D để thấy).');
      })
      .catch(function (e) {
        setSaveStatus('Lưu thất bại: ' + e.message, true);
      });
  }

  /* ----------------------- Tải ảnh/video lên repo --------------------- */
  function uploadMedia(file) {
    var idRaw = ($('fId').value || 'board').trim().replace(/[^a-zA-Z0-9_-]/g, '') || 'board';
    var ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
    var name = idRaw + '_' + Date.now() + '.' + ext;
    var path = MEDIA_DIR + '/' + name;
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(String(fr.result).split(',')[1]); };
      fr.onerror = function () { reject(new Error('không đọc được file')); };
      fr.readAsDataURL(file);
    }).then(function (b64) {
      var body = { message: 'admin: upload media ' + name, content: b64, branch: BRANCH };
      return fetch(API + path, { method: 'PUT', headers: headers(true), body: JSON.stringify(body) });
    }).then(function (res) {
      if (!res.ok) return res.text().then(function (t) { throw new Error('HTTP ' + res.status + ' – ' + t.slice(0, 160)); });
      return path;
    });
  }

  /* ====================== Cấu hình ÂM THANH (settings.json) ====================== */
  function defaultSound() {
    return { enabled: true, bgSrc: '', bgVolume: 0.4, popupSrc: '', popupVolume: 0.7, duck: 0.2 };
  }
  function clamp01(v) { v = parseFloat(v); if (isNaN(v)) v = 0; return Math.max(0, Math.min(1, v)); }

  function fillSoundForm() {
    var s = (settings && settings.sound) || defaultSound();
    $('sEnabled').checked = s.enabled !== false;
    $('sBgSrc').value = s.bgSrc || '';
    $('sBgVol').value = (s.bgVolume != null ? s.bgVolume : 0.4);
    $('sPopSrc').value = s.popupSrc || '';
    $('sPopVol').value = (s.popupVolume != null ? s.popupVolume : 0.7);
    $('sDuck').value = (s.duck != null ? s.duck : 0.2);
  }
  function readSoundForm() {
    return {
      enabled: $('sEnabled').checked,
      bgSrc: $('sBgSrc').value.trim(),
      bgVolume: clamp01($('sBgVol').value),
      popupSrc: $('sPopSrc').value.trim(),
      popupVolume: clamp01($('sPopVol').value),
      duck: clamp01($('sDuck').value)
    };
  }

  function loadSettings() {
    setStatus($('soundStatus'), 'Đang tải cấu hình âm thanh…');
    fetch(API + SETTINGS_PATH + '?ref=' + BRANCH + '&t=' + Date.now(), { headers: headers() })
      .then(function (res) {
        if (res.status === 404) {   // chưa có settings.json -> dùng mặc định
          settings = { sound: defaultSound() }; settingsSha = null;
          fillSoundForm(); setStatus($('soundStatus'), 'Chưa có cấu hình — đang dùng mặc định.');
          return null;
        }
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (j) {
        if (!j) return;
        settingsSha = j.sha;
        try {
          var obj = JSON.parse(base64ToUtf8(j.content)) || {};
          settings = { sound: Object.assign(defaultSound(), obj.sound || {}) };
        } catch (e) { settings = { sound: defaultSound() }; }
        fillSoundForm();
        setStatus($('soundStatus'), 'Đã tải cấu hình âm thanh.');
      })
      .catch(function (e) {
        settings = settings || { sound: defaultSound() };
        fillSoundForm();
        setStatus($('soundStatus'), 'Lỗi tải cấu hình âm thanh: ' + e.message, true);
      });
  }

  function refreshSettingsSha() {
    return fetch(API + SETTINGS_PATH + '?ref=' + BRANCH + '&t=' + Date.now(), { headers: headers() })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j) settingsSha = j.sha; })
      .catch(function () {});
  }
  function putSettings() {
    var json = JSON.stringify(settings, null, 2) + '\n';
    var body = {
      message: 'admin: cập nhật âm thanh (' + new Date().toISOString() + ')',
      content: utf8ToBase64(json), branch: BRANCH
    };
    if (settingsSha) body.sha = settingsSha;
    return fetch(API + SETTINGS_PATH, { method: 'PUT', headers: headers(true), body: JSON.stringify(body) });
  }
  function saveSettings() {
    if (!token()) { setStatus($('soundStatus'), 'Cần nhập token GitHub ở bước 1 trước khi lưu.', true); return; }
    settings = { sound: readSoundForm() };
    setStatus($('soundStatus'), 'Đang lưu cấu hình âm thanh…');
    var ensure = settingsSha ? Promise.resolve() : refreshSettingsSha();
    ensure.then(putSettings)
      .then(function (res) { if (res.status === 409) return refreshSettingsSha().then(putSettings); return res; })
      .then(function (res) {
        if (!res.ok) return res.text().then(function (t) { throw new Error('HTTP ' + res.status + ' – ' + t.slice(0, 200)); });
        return res.json();
      })
      .then(function (j) {
        settingsSha = (j && j.content && j.content.sha) || settingsSha;
        setStatus($('soundStatus'), '✓ Đã lưu âm thanh. F5 lại phòng 3D sau ~1–2 phút để nghe thay đổi.');
      })
      .catch(function (e) { setStatus($('soundStatus'), 'Lưu thất bại: ' + e.message, true); });
  }

  /* --------------------- Tải file âm thanh lên repo -------------------- */
  function fileToB64(file) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(String(fr.result).split(',')[1]); };
      fr.onerror = function () { reject(new Error('không đọc được file')); };
      fr.readAsDataURL(file);
    });
  }
  function uploadAudioFile(file, kind) {
    var ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
    var name = kind + '_' + Date.now() + '.' + ext;
    var path = AUDIO_DIR + '/' + name;
    return fileToB64(file).then(function (b64) {
      var body = { message: 'admin: upload audio ' + name, content: b64, branch: BRANCH };
      return fetch(API + path, { method: 'PUT', headers: headers(true), body: JSON.stringify(body) });
    }).then(function (res) {
      if (!res.ok) return res.text().then(function (t) { throw new Error('HTTP ' + res.status + ' – ' + t.slice(0, 160)); });
      return path;
    });
  }
  function audioUploadHandler(fileId, srcId, statusId, kind) {
    return function () {
      var f = $(fileId).files[0];
      var st = $(statusId);
      if (!f) { setStatus(st, 'Chọn file âm thanh trước.', true); return; }
      if (!token()) { setStatus(st, 'Cần token ở bước 1 trước.', true); return; }
      var MB = f.size / (1024 * 1024);
      if (MB > 25) { setStatus(st, 'File ' + MB.toFixed(1) + 'MB > 25MB — quá lớn. Hãy nén hoặc dùng link trực tiếp.', true); return; }
      setStatus(st, 'Đang tải lên repo…');
      uploadAudioFile(f, kind)
        .then(function (path) { $(srcId).value = path; setStatus(st, '✓ Đã tải lên: ' + path + ' — nhớ bấm “⬆ Lưu âm thanh”.'); })
        .catch(function (e) { setStatus(st, 'Tải lên thất bại: ' + e.message, true); });
    };
  }

  /* --------------------------- Kiểm tra token ------------------------- */
  function checkToken() {
    var v = $('tokenInput').value.trim();
    if (!v) { setTokenStatus('Chưa nhập token.', true); return; }
    localStorage.setItem(TOKEN_KEY, v);
    setTokenStatus('Đang kiểm tra token…');
    fetch('https://api.github.com/repos/' + OWNER + '/' + REPO, { headers: headers() })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) {
        var canPush = j.permissions && j.permissions.push;
        if (canPush) setTokenStatus('✓ Đã kết nối ' + j.full_name + ' — có quyền ghi. Sẵn sàng lưu.');
        else setTokenStatus('Token đọc được repo nhưng có thể THIẾU quyền ghi (Contents: write). Vẫn thử lưu được; nếu lỗi thì cấp lại quyền.', true);
        loadData();
        loadSettings();
      })
      .catch(function (e) {
        setTokenStatus('Token không dùng được: ' + e.message + ' — kiểm tra lại token & quyền repo.', true);
      });
  }

  /* ----------------------------- Render ------------------------------- */
  function renderList() {
    var wrap = $('boardList');
    var ids = Object.keys(exhibits);
    if (!ids.length) {
      wrap.innerHTML = '<p class="adm-empty">Chưa có bảng nào. Bấm “＋ Thêm bảng”.</p>';
      return;
    }
    wrap.innerHTML = ids.map(function (id) {
      var it = exhibits[id] || {};
      var thumb;
      if (it.src && it.type === 'video') thumb = '<div class="adm-thumb adm-thumb--video">🎬</div>';
      else if (it.src) thumb = '<img class="adm-thumb" src="' + escAttr(it.src) + '" alt="" onerror="this.style.display=\'none\'" />';
      else thumb = '<div class="adm-thumb adm-thumb--empty">—</div>';
      return '<div class="adm-item">' + thumb +
        '<div class="adm-item__body">' +
          '<div class="adm-item__id">' + esc(id) + ' <span class="adm-tag">' + esc(it.type || 'image') + '</span></div>' +
          '<div class="adm-item__title">' + esc(it.title || '(chưa có tiêu đề)') + '</div>' +
          '<div class="adm-item__desc">' + esc(it.desc || '') + '</div>' +
        '</div>' +
        '<div class="adm-item__actions">' +
          '<button class="adm-btn adm-btn--ghost" data-edit="' + escAttr(id) + '">Sửa</button>' +
          '<button class="adm-btn adm-btn--danger" data-del="' + escAttr(id) + '">Xoá</button>' +
        '</div>' +
      '</div>';
    }).join('');
    wrap.querySelectorAll('[data-edit]').forEach(function (b) {
      b.onclick = function () { openForm(b.getAttribute('data-edit')); };
    });
    wrap.querySelectorAll('[data-del]').forEach(function (b) {
      b.onclick = function () { delBoard(b.getAttribute('data-del')); };
    });
  }

  /* ------------------------------ Form -------------------------------- */
  function openForm(id) {
    editingId = id || null;
    var it = id ? (exhibits[id] || {}) : {};
    $('formTitle').textContent = id ? ('Sửa bảng: ' + id) : 'Thêm bảng mới';
    $('fId').value = id || '';
    $('fId').disabled = !!id;   // sửa thì khoá mã (đổi mã = xoá + thêm)
    $('fType').value = it.type || 'image';
    $('fSrc').value = it.src || '';
    $('fTitle').value = it.title || '';
    $('fDesc').value = it.desc || '';
    $('fLink').value = it.link || '';
    $('fFile').value = '';
    setUploadStatus('');
    $('formModal').hidden = false;
  }
  function closeForm() { $('formModal').hidden = true; }

  function saveForm() {
    var id = $('fId').value.trim();
    if (!/^[a-zA-Z0-9_]+$/.test(id)) { alert('Mã bảng chỉ gồm chữ, số và gạch dưới (ví dụ: Image_Board_01).'); return; }
    if (!editingId && exhibits[id] && !confirm('Mã “' + id + '” đã tồn tại. Ghi đè?')) return;
    exhibits[id] = {
      type: $('fType').value,
      src: $('fSrc').value.trim(),
      title: $('fTitle').value.trim(),
      desc: $('fDesc').value.trim(),
      link: $('fLink').value.trim()
    };
    closeForm();
    renderList();
    setSaveStatus('Đã cập nhật tạm trong trình duyệt. Nhớ bấm “⬆ Lưu lên web” để đẩy lên.');
  }

  function delBoard(id) {
    if (!confirm('Xoá bảng “' + id + '” khỏi danh sách?')) return;
    delete exhibits[id];
    renderList();
    setSaveStatus('Đã xoá “' + id + '” khỏi danh sách. Nhớ bấm “⬆ Lưu lên web”.');
  }

  /* ------------------------------ Init -------------------------------- */
  window.addEventListener('DOMContentLoaded', function () {
    if (token()) $('tokenInput').value = token();

    $('saveTokenBtn').onclick = checkToken;
    $('clearTokenBtn').onclick = function () {
      localStorage.removeItem(TOKEN_KEY);
      $('tokenInput').value = '';
      setTokenStatus('Đã xoá token khỏi trình duyệt.');
    };
    $('reloadBtn').onclick = loadData;
    $('addBtn').onclick = function () { openForm(null); };
    $('saveBtn').onclick = saveData;
    $('formClose').onclick = closeForm;
    $('formCancel').onclick = closeForm;
    $('formSave').onclick = saveForm;
    $('uploadBtn').onclick = function () {
      var f = $('fFile').files[0];
      if (!f) { setUploadStatus('Chọn file ảnh/video trước.', true); return; }
      if (!token()) { setUploadStatus('Cần token ở bước 1 trước.', true); return; }
      var MB = f.size / (1024 * 1024);
      if (MB > 50) {
        setUploadStatus('File ' + MB.toFixed(1) + 'MB > 50MB — quá lớn để đưa lên repo. Hãy dán LINK trực tiếp (YouTube/CDN) vào ô đường dẫn.', true);
        return;
      }
      if (MB > 10 && !confirm('File ' + MB.toFixed(1) + 'MB khá nặng, tải lên repo sẽ làm web mở chậm. Vẫn tiếp tục?')) return;
      setUploadStatus('Đang tải lên repo…');
      uploadMedia(f)
        .then(function (path) {
          $('fSrc').value = path;
          if (/^video\//.test(f.type)) $('fType').value = 'video';     // tự chọn Loại = Video
          else if (/^image\//.test(f.type)) $('fType').value = 'image';
          setUploadStatus('✓ Đã tải lên: ' + path);
        })
        .catch(function (e) { setUploadStatus('Tải lên thất bại: ' + e.message, true); });
    };
    $('formModal').addEventListener('click', function (e) {
      if (e.target === $('formModal')) closeForm();   // click nền tối -> đóng
    });

    // Cấu hình âm thanh
    $('saveSoundBtn').onclick = saveSettings;
    $('reloadSoundBtn').onclick = loadSettings;
    $('sBgUpload').onclick = audioUploadHandler('sBgFile', 'sBgSrc', 'sBgUploadStatus', 'bg');
    $('sPopUpload').onclick = audioUploadHandler('sPopFile', 'sPopSrc', 'sPopUploadStatus', 'sfx');

    loadData();
    loadSettings();
  });
})();
