/* =====================================================================
   main.js – cổng hết hạn + điều khiển mở/đóng Bảo tàng số 3D
   ===================================================================== */
const CFG = window.WEBDPT_CONFIG || {};

/* ---------- 1) Cổng hết hạn (lớp chặn phía người dùng) ---------- */
(function expiryGate() {
  if (!CFG.expiryDate) return;
  const now = new Date();
  const expiry = new Date(CFG.expiryDate);
  if (isNaN(expiry.getTime())) return;
  if (now >= expiry) {
    document.documentElement.innerHTML =
      '<body><div class="expired-screen">' +
      '<h1>Trang đã kết thúc trưng bày</h1>' +
      '<p>Phiên bản trải nghiệm trực tuyến của Bảo tàng số đã hết thời gian mở. ' +
      'Xin cảm ơn bạn đã ghé thăm.</p></div></body>';
    throw new Error('expired'); // dừng mọi script phía sau
  }
})();

/* ---------- 2) Mở / đóng Bảo tàng số 3D ---------- */
const museumEl = document.getElementById('museum');
const deckEl = document.querySelector('.deck');
let museumApi = null;        // API trả về từ museum.js sau khi khởi tạo
let museumLoading = false;

async function openMuseum() {
  if (deckEl) deckEl.style.overflow = 'hidden';
  museumEl.classList.add('is-open');
  museumEl.setAttribute('aria-hidden', 'false');

  if (!museumApi && !museumLoading) {
    museumLoading = true;
    try {
    const mod = await import('./museum.js?v=19');
      museumApi = await mod.initMuseum({
        mount: document.getElementById('museum-canvas-wrap'),
        loadingEl: document.getElementById('museum-loading'),
        productPanel: document.getElementById('product-panel'),
        soundBtn: document.getElementById('museum-sound-btn'),
        config: CFG,
      });
    } catch (err) {
      console.error('[museum] init failed:', err);
      const l = document.getElementById('museum-loading');
      if (l) l.innerHTML = '<p style="color:#fff">Không tải được không gian 3D.<br>' +
        'Vui lòng thử lại bằng trình duyệt mới (Chrome/Edge/Firefox).</p>';
    } finally {
      museumLoading = false;
    }
  }
  museumApi && museumApi.resume();
}

function closeMuseum() {
  museumEl.classList.remove('is-open');
  museumEl.setAttribute('aria-hidden', 'true');
  if (deckEl) deckEl.style.overflow = '';
  museumApi && museumApi.pause();
}

/* ---------- 3) Luồng tương tác ----------
   - 4 nút "Khám phá ngay" (hero + 3 phòng) -> cuộn xuống nút cuối.
   - Nút cuối "Kích hoạt bảo tàng số 3D"    -> mở phòng 3D duy nhất. */
function scrollToEnter() {
  const target = document.getElementById('hs-enter');
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

document.querySelectorAll('.js-scroll-bottom').forEach((b) =>
  b.addEventListener('click', scrollToEnter)
);
document.querySelectorAll('.js-open-museum').forEach((b) =>
  b.addEventListener('click', openMuseum)
);
document.querySelectorAll('.js-close-museum').forEach((b) =>
  b.addEventListener('click', closeMuseum)
);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && museumEl.classList.contains('is-open')) closeMuseum();
});

/* ---------- 4) Hiệu ứng chuyển trang: scroll-reveal + thanh tiến trình ----------
   Deck cuộn-snap → "chuyển trang" = cuộn giữa các .panel. Mỗi panel khi cuộn tới
   sẽ cho nội dung fade + trượt lên theo kiểu so le (stagger), tạo cảm giác động.
   Trạng thái cuối luôn = bố cục gốc nên không làm sai lệch thiết kế. */
(function pageTransitions() {
  if (!deckEl) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* 4a) Thanh tiến trình cuộn (mảnh, màu cam) */
  const progress = document.createElement('div');
  progress.className = 'scroll-progress';
  document.body.appendChild(progress);
  const updateProgress = () => {
    const max = deckEl.scrollHeight - deckEl.clientHeight;
    progress.style.width = (max > 0 ? (deckEl.scrollTop / max) * 100 : 0) + '%';
  };
  deckEl.addEventListener('scroll', updateProgress, { passive: true });
  window.addEventListener('resize', updateProgress);
  updateProgress();

  /* 4b) Scroll-reveal cho nội dung từng panel */
  // Bỏ qua (giữ web tĩnh, nội dung luôn hiện) nếu người dùng chọn giảm chuyển
  // động hoặc trình duyệt không hỗ trợ IntersectionObserver.
  if (reduceMotion || !('IntersectionObserver' in window)) return;

  // Các phần tử sẽ "xuất hiện" trong mỗi panel, theo thứ tự stagger.
  const REVEAL_SELECTOR = [
    '.hero__logo-wrap', '.hero__eyebrow', '.hero__title', '.hero__band', '.hero__subtitle', '.hero .btn',
    '.intro .split-title', '.intro__text p',
    '.room-stage__head .split-title', '.room',
    '.guide .split-title', '.guide__lead', '.guide__step', '.guide__cta',
    '.footer__logo', '.footer__col',
  ].join(',');

  const panels = document.querySelectorAll('.deck .panel');
  panels.forEach((panel) => {
    panel.querySelectorAll(REVEAL_SELECTOR).forEach((el, i) => {
      el.classList.add('reveal');
      el.style.setProperty('--reveal-delay', (i * 0.09).toFixed(2) + 's');
    });
  });
  document.body.classList.add('anim-ready');

  const revealPanel = (panel, show) =>
    panel.querySelectorAll('.reveal').forEach((el) => el.classList.toggle('is-visible', show));

  // root mặc định = viewport (deck lấp đầy viewport nên tương đương, lại tương thích rộng).
  const io = new IntersectionObserver((entries) => {
    // Hiện khi panel vào tầm nhìn, ẩn lại khi rời đi → mỗi lần cuộn tới lại
    // được "diễn" lại, giúp việc chuyển trang luôn sinh động.
    entries.forEach((entry) => revealPanel(entry.target, entry.isIntersecting));
  }, { threshold: 0.2 });
  panels.forEach((p) => io.observe(p));

  // Trang đầu (hero) luôn trong khung nhìn → chủ động "diễn" ngay khi tải để có
  // entrance, đồng thời tránh mọi rủi ro nội dung bị kẹt ẩn nếu observer chậm.
  requestAnimationFrame(() => panels[0] && revealPanel(panels[0], true));
})();
