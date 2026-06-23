/* =====================================================================
   audio.js – Âm thanh cho Bảo tàng số 3D
   ─────────────────────────────────────────────────────────────────────
   - Nhạc nền (loop): phát từ FILE/LINK nếu admin có cấu hình, nếu để trống
     thì dùng "tiếng nền êm dịu" tổng hợp bằng Web Audio (không cần file).
   - Âm báo khi mở popup sản phẩm: phát FILE nếu có, nếu trống dùng tiếng
     "pop" tổng hợp sẵn.
   - DUCKING: khi popup mở -> tự hạ nhỏ nhạc nền để nghe rõ popup; đóng
     popup -> trả lại âm lượng cũ.
   - Nút bật/tắt (🔊/🔇): lưu lựa chọn vào localStorage.
   - Trình duyệt chặn autoplay: tự thử lại ở lần tương tác đầu tiên.

   Dùng: const audio = createMuseumAudio(cfg, { button });
         audio.start() / .stop() / .duck() / .unduck() / .popup()
   ===================================================================== */

const MUTE_KEY = 'webdpt_sound_muted';
const SYNTH_SCALE = 0.5;   // giữ tiếng nền tổng hợp luôn dịu so với nhạc file

export function createMuseumAudio(cfg = {}, opts = {}) {
  const C = Object.assign({
    enabled: true,
    bgSrc: '', bgVolume: 0.4,
    popupSrc: '', popupVolume: 0.7,
    duck: 0.2,
  }, cfg || {});

  const button = opts.button || null;

  /* Trạng thái tắt tiếng: ưu tiên lựa chọn người dùng đã lưu;
     chưa có -> theo cấu hình "enabled" của admin. */
  let muted;
  const saved = localStorage.getItem(MUTE_KEY);
  if (saved === '1') muted = true;
  else if (saved === '0') muted = false;
  else muted = !C.enabled;

  let active = false;      // đang ở trong phòng 3D (giữa start() và stop())
  let ducked = false;      // đang trong trạng thái nhỏ tiếng (popup mở)
  let ctx = null;          // AudioContext dùng chung cho âm tổng hợp

  /* ----------------------- AudioContext dùng chung ----------------------- */
  function audioCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctx = new AC();
    }
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  /* =====================================================================
     NỀN: chọn backend file hoặc tổng hợp. Mỗi backend chỉ cần cung cấp
     play()/pause()/apply(v) — phần fade (mượt) do controller xử lý chung.
     ===================================================================== */
  const bg = C.bgSrc ? makeFileBg(C.bgSrc) : makeSynthBg();

  function makeFileBg(src) {
    const a = new Audio(src);
    a.loop = true;
    a.preload = 'auto';
    a.crossOrigin = 'anonymous';
    a.volume = 0;
    return {
      play() { return a.play(); },
      pause() { try { a.pause(); } catch (e) {} },
      apply(v) { a.volume = Math.max(0, Math.min(1, v)); },
    };
  }

  // Tiếng nền tổng hợp: hợp âm trầm êm + lọc thông thấp + LFO cho cảm giác "thở".
  function makeSynthBg() {
    let master = null, built = false;
    function build() {
      const c = audioCtx();
      if (!c) return false;
      master = c.createGain();
      master.gain.value = 0;
      master.connect(c.destination);

      const filt = c.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 680;
      filt.Q.value = 0.6;
      filt.connect(master);

      // A2 – E3 – A3 – E4 : hợp âm rỗng, nghe trung tính, không vui không buồn
      const freqs = [110, 164.81, 220, 329.63];
      for (const f of freqs) {
        const g = c.createGain();
        g.gain.value = 0.09;
        g.connect(filt);
        const o = c.createOscillator();
        o.type = 'sine'; o.frequency.value = f;
        const o2 = c.createOscillator();        // hơi lệch tông cho dày tiếng
        o2.type = 'sine'; o2.frequency.value = f * 1.004;
        o.connect(g); o2.connect(g);
        o.start(); o2.start();
      }

      // LFO chậm điều biến tần số cắt -> tiếng nền chuyển động nhẹ
      const lfo = c.createOscillator();
      lfo.frequency.value = 0.05;
      const lg = c.createGain();
      lg.gain.value = 160;
      lfo.connect(lg); lg.connect(filt.frequency); lfo.start();

      built = true;
      return true;
    }
    return {
      play() {
        const c = audioCtx();
        if (!c) return;
        if (!built) build();
        if (c.state === 'suspended') c.resume().catch(() => {});
      },
      pause() { /* giữ node sống; controller hạ gain về 0 là đủ "tắt" */ },
      apply(v) { if (master) master.gain.value = Math.max(0, Math.min(1, v)) * SYNTH_SCALE; },
    };
  }

  /* ------------------------- Fade âm lượng nền ------------------------- */
  let bgCur = 0, fadeTimer = null;
  function fadeBg(target, ms) {
    target = Math.max(0, Math.min(1, target));
    if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null; }
    if (ms <= 0 || Math.abs(target - bgCur) < 0.001) {
      bgCur = target; bg.apply(target); return;
    }
    const start = bgCur, diff = target - start, t0 = performance.now();
    fadeTimer = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      bgCur = start + diff * k;
      bg.apply(bgCur);
      if (k >= 1) { clearInterval(fadeTimer); fadeTimer = null; bgCur = target; }
    }, 40);
  }

  function targetVol() { return ducked ? C.bgVolume * C.duck : C.bgVolume; }

  /* --------- Tự phát lại khi trình duyệt chặn autoplay (cần gesture) --------- */
  let gestureArmed = false;
  function armGesture() {
    if (gestureArmed) return;
    gestureArmed = true;
    const evs = ['pointerdown', 'keydown', 'touchstart'];
    const handler = () => {
      gestureArmed = false;
      evs.forEach((ev) => window.removeEventListener(ev, handler));
      if (active && !muted) { bg.play(); fadeBg(targetVol(), 400); }
    };
    evs.forEach((ev) => window.addEventListener(ev, handler, { passive: true }));
  }

  function playBg() {
    const p = bg.play();
    if (p && typeof p.catch === 'function') p.catch(() => armGesture());
    else armGesture();   // synth/không-promise: vẫn cần gesture nếu ctx bị treo
  }

  /* ============================ Âm báo popup ============================ */
  let popEl = null;
  function popupSound() {
    if (muted) return;
    if (C.popupSrc) {
      if (!popEl) { popEl = new Audio(C.popupSrc); popEl.preload = 'auto'; popEl.crossOrigin = 'anonymous'; }
      popEl.volume = Math.max(0, Math.min(1, C.popupVolume));
      try { popEl.currentTime = 0; } catch (e) {}
      popEl.play().catch(() => {});
    } else {
      playSynthPop(C.popupVolume);
    }
  }

  // Tiếng "pop" mặc định: thành phần tròn (sine vống lên) + tiếng "tách" sáng.
  function playSynthPop(vol) {
    const c = audioCtx();
    if (!c) return;
    if (c.state === 'suspended') c.resume().catch(() => {});
    const t = c.currentTime;
    const out = c.createGain();
    out.gain.value = Math.max(0, Math.min(1, vol));
    out.connect(c.destination);

    const g1 = c.createGain();
    g1.gain.setValueAtTime(0.0001, t);
    g1.gain.exponentialRampToValueAtTime(0.9, t + 0.015);
    g1.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    const o1 = c.createOscillator();
    o1.type = 'sine';
    o1.frequency.setValueAtTime(520, t);
    o1.frequency.exponentialRampToValueAtTime(880, t + 0.09);
    o1.connect(g1); g1.connect(out);
    o1.start(t); o1.stop(t + 0.27);

    const g2 = c.createGain();
    g2.gain.setValueAtTime(0.0001, t);
    g2.gain.exponentialRampToValueAtTime(0.32, t + 0.006);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    const o2 = c.createOscillator();
    o2.type = 'triangle';
    o2.frequency.setValueAtTime(1320, t);
    o2.connect(g2); g2.connect(out);
    o2.start(t); o2.stop(t + 0.14);
  }

  /* ============================== Nút bật/tắt ============================== */
  function updateButton() {
    if (!button) return;
    button.setAttribute('aria-pressed', muted ? 'false' : 'true');
    button.classList.toggle('is-muted', muted);
    button.textContent = muted ? '🔇' : '🔊';
    button.title = muted ? 'Bật âm thanh' : 'Tắt âm thanh';
  }

  function setMuted(m) {
    muted = !!m;
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    if (muted) {
      fadeBg(0, 250);
      setTimeout(() => { if (muted) bg.pause(); }, 280);
    } else if (active) {
      playBg();
      fadeBg(targetVol(), 300);
    }
    updateButton();
  }
  function toggleMute() { setMuted(!muted); }

  if (button) button.addEventListener('click', toggleMute);
  updateButton();

  /* ============================== API công khai ============================== */
  return {
    // Vào phòng 3D / quay lại tab: bắt đầu (hoặc tiếp tục) nhạc nền.
    start() {
      active = true;
      if (muted) { updateButton(); return; }
      playBg();
      fadeBg(targetVol(), 600);
      updateButton();
    },
    // Thoát phòng / tạm dừng: hạ nền rồi dừng (giữ lựa chọn để mở lại phát tiếp).
    stop() {
      active = false;
      ducked = false;
      fadeBg(0, 150);
      setTimeout(() => bg.pause(), 160);
    },
    // Popup mở: phát âm báo + hạ nhỏ nhạc nền (ducking).
    popup() { popupSound(); },
    duck() { ducked = true; if (active && !muted) fadeBg(targetVol(), 250); },
    unduck() { ducked = false; if (active && !muted) fadeBg(targetVol(), 400); },
    setMuted, toggleMute,
    isMuted() { return muted; },
  };
}
