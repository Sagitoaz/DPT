# TÀI LIỆU BÀN GIAO — WebDPT (Bảo tàng số Khoa Đa phương tiện, VR360 PTIT)

> Tài liệu cho người tiếp nhận/fix dự án. Đọc hết phần **§7 – Việc cần fix** trước khi bắt tay.

> ⚠️ **CẬP NHẬT:** Phòng 3D **đã tích hợp model thật** (`assets/models/Room.glb`) — không còn dùng
> phòng mẫu placeholder nữa. Phần **3D / admin / deploy** (model size, deploy GitHub Pages, gắn
> ảnh/video lên bảng, trang admin) được tách sang tài liệu riêng: **`HANDOVER_3D.md`** — đọc file đó
> cho mọi việc liên quan phòng 3D. Tài liệu này (HANDOVER.md) giữ cho phần **giao diện landing/Figma**.

---

## 1. Dự án là gì
Một **landing page desktop** (cuộn dọc) giới thiệu "Bảo tàng số" của Khoa Đa phương tiện – PTIT,
dựng lại theo thiết kế Figma. Tính năng tương tác duy nhất là **các nút bấm**:

- 4 nút **"KHÁM PHÁ NGAY"** (ở hero + 3 phòng) → **cuộn xuống nút cuối**.
- Nút cuối **"KÍCH HOẠT BẢO TÀNG SỐ 3D"** → mở **1 phòng tham quan 3D duy nhất** (overlay toàn màn hình).

Phòng 3D (three.js/WebXR): đi bằng **WASD/phím mũi tên**, **giữ–kéo chuột** xoay góc nhìn,
**click sàn** để di chuyển, **click sản phẩm** để xem thông tin, có **nút VR** cho Meta Quest 3.
Hiện đang dùng **phòng mẫu (placeholder)**; chủ dự án sẽ cấp **model `.glb`** để thay sau.

---

## 2. Tech stack
- **Thuần HTML/CSS/JS tĩnh** — KHÔNG có build step, KHÔNG framework, KHÔNG npm.
- **three.js 0.160.0** nạp qua CDN bằng `importmap` (xem `<head>` trong `index.html`).
- Font **Be Vietnam Pro** (Google Fonts).
- Deploy mục tiêu: **GitHub Pages** (tĩnh, HTTPS sẵn — cần cho WebXR/Quest).

---

## 3. Cấu trúc thư mục
```
WebDPT/
├─ index.html                  # toàn bộ markup (landing + overlay phòng 3D)
├─ config.js                   # ⭐ CHỈNH model 3D & ngày hết hạn ở đây
├─ README.md                   # hướng dẫn ngắn cho người dùng cuối
├─ HANDOVER.md                 # (file này)
├─ .gitignore
├─ .github/workflows/expire.yml# tự TẮT GitHub Pages khi tới hạn (server-side)
├─ .claude/launch.json         # cấu hình server preview (python http.server 8123)
└─ assets/
   ├─ css/style.css            # toàn bộ style (landing + overlay + responsive desktop)
   ├─ js/main.js               # cổng hết hạn + mở/đóng phòng + wiring các nút
   ├─ js/museum.js             # phòng 3D (three.js): scene, điều khiển, WebXR
   ├─ models/README.txt        # nơi đặt file .glb
   └─ img/                      # ảnh cắt từ thiết kế Figma (xem §7.1 + §8)
```
> Ngoài ra ở máy gốc còn có `_figma_ref/` và `_figma_metadata.xml` (đã .gitignore) —
> là **bản render Figma 1:1** (`_figma_ref/fullres.png`, 1366×5133) dùng để cắt ảnh. Không cần deploy.

---

## 4. Chạy ở máy (local)
ES module + three.js **không chạy bằng mở file trực tiếp** — phải có web server tĩnh:
```bash
cd WebDPT
python -m http.server 8123      # rồi mở http://localhost:8123
```
(Hoặc bất kỳ static server nào: `npx serve`, Live Server của VS Code…)

---

## 5. Deploy GitHub Pages
1. Tạo repo, push toàn bộ thư mục lên nhánh `main`.
2. Settings → Pages → **Deploy from a branch** → `main` / `(root)` → Save.
3. Vài phút sau chạy tại `https://<user>.github.io/<repo>/`.

### Cho web tự "sập" sau 30 ngày (2 lớp)
- **Lớp người dùng (client):** sửa `expiryDate` trong `config.js` = **ngày deploy + 30**
  (ISO, ví dụ `"2026-07-19T00:00:00+07:00"`). Quá hạn → hiện màn hình "đã kết thúc".
- **Lớp server (TẮT THẬT):** sửa `EXPIRY_DATE` trong `.github/workflows/expire.yml`
  = **cùng ngày** (định dạng `YYYY-MM-DD`). Mỗi ngày Action chạy, tới hạn thì gọi API
  **tắt GitHub Pages**.
  - Nếu báo lỗi quyền khi tắt Pages: tạo Personal Access Token (quyền *Pages: write*),
    thêm vào repo Settings → Secrets → Actions → tên `GH_PAT`.
- ⚠️ Nhớ điền **2 nơi trùng ngày nhau**.

---

## 6. Các điểm cấu hình (chỉ sửa ở đây)
**`config.js`** (`window.WEBDPT_CONFIG`):
| Khoá | Ý nghĩa |
|---|---|
| `modelUrl` | Đường dẫn model 3D. `null` = dùng phòng mẫu. Đổi thành `"assets/models/ten.glb"` khi có model thật. |
| `modelScale`, `modelYOffset` | Phóng to/thu nhỏ & nâng/hạ model nếu lệch. |
| `spawnHeight` | Cao tầm mắt người xem (m, mặc định 1.6). |
| `moveSpeed` | Tốc độ đi (m/s). |
| `expiryDate` | Ngày hết hạn (client). `null` = không giới hạn. |

### Thay model 3D
1. Xuất model ra **`.glb`** (glTF 2.0 binary, < 50MB; nên nén Draco/Meshopt + texture KTX2).
2. Copy vào `assets/models/`.
3. Sửa 1 dòng: `modelUrl: "assets/models/<tên>.glb"`. Xong. Không cần đụng code khác.
   - Loader & raycast click-to-move/đụng sản phẩm đã xử lý sẵn cho model bất kỳ
     (xem `loadModel()` trong `assets/js/museum.js`).

---

## 7. TRẠNG THÁI & VIỆC CÒN LẠI (đọc kỹ trước khi làm)

### 7.0. Đã hoàn thiện (bám Figma)
- **Hero**: tiêu đề "BẢO TÀNG SỐ" + dải "KHOA ĐA PHƯƠNG TIỆN" dùng đúng font **Phudu Bold**.
  (Nét cong/flourish trên chữ "Ố" là **đặc trưng dấu thanh của Phudu**, không phải hình vẽ thêm —
  trước đây thiếu vì web render bằng sai font.)
- **Phòng 01 & 02**: ảnh preview + 4 thumbnail đã thay bằng **ảnh GỐC tải từ Figma**, bố cục dựng lại
  đúng thiết kế (card lớn 1 bên | cột còn lại = text → 4 thumbnail → nút canh đáy).
- **Tiêu đề phòng & nút "KHÁM PHÁ NGAY"**: font **Helvetica/Arial Bold**, màu cam `#FFAA01` (đồng bộ 3 phòng).
- **Phòng 03**: đã CONVERT sang cấu trúc mới như Phòng 1&2, **nhưng ẢNH còn là bản cắt cũ (tạm)** → xem 7.3.a.

### 7.1. Hệ thống FONT (thiết kế dùng 3 font – khai báo ở `:root`, nạp trong `<head>`)
| Biến CSS | Font | Dùng cho |
|---|---|---|
| `--font-display` | **Phudu** | tiêu đề lớn: hero title + dải hero |
| `--font-ui` | **Helvetica/Arial** | tiêu đề phòng, nút pill (body phòng thiết kế cũng là Helvetica) |
| _(body mặc định)_ | **Be Vietnam Pro** | văn bản thường (giữ vì render tiếng Việt đẹp; đổi nếu cần đúng tuyệt đối) |

### 7.2. CÔNG THỨC SỬA 1 PHÒNG (làm theo Phòng 1/2 trong `index.html`)
**(A) Lấy ảnh GỐC từ Figma — KHÔNG cắt từ render phẳng nữa:**
- Figma app: mở file (§8) → chọn card preview / từng thumbnail → **Export PNG @2x**.
- Hoặc Figma MCP: `download_assets(fileKey, nodeId, format=png, scale=2)` → bản render sạch của node.
- Lưu vào `assets/img/` đúng tên: `roomX_preview.png`, `roomX_thumb1..4.png`.

**(B) Markup** (đã có comment "CÔNG THỨC" ngay đầu phần ROOMS trong `style.css`):
`.room__grid [.room__grid--reverse]` chứa `.room__media [.room__media--portrait]` (CARD) + `.room__col`
(text → `.room__thumbs--grid|--row` → `.room__cta`). HTML luôn để **`.room__media` TRƯỚC** `.room__col`.
- `--reverse` = card sang phải (Phòng 2) · `--portrait` = card dọc (ảnh landscape bị cắt cover).
- Thumbnail: `--grid` = 4 ô vuông đều · `--row` = giữ tỉ lệ gốc, cùng chiều cao.

**(C) Tinh chỉnh kích thước** chỉ cần sửa biến `--room-* / --thumb-* / --card-*` ở `:root` (không đụng rule).

### 7.3. ⬅ VIỆC BÀN GIAO (3 phần chưa xong)
**a) PHÒNG 03 (xanh lá) — chỉ cần thay ẢNH gốc (cấu trúc đã chuẩn):**
- `room3_preview.png` ← card hội trường. Figma node preview: **`246:6503`** (export group cha để có cả composite).
- Tách 4 thumbnail → `room3_thumb1..4.png`. Figma nodes (trái→phải, đều landscape):
  **`246:6566`, `246:6587`, `246:6545`, `246:6524`**.
- Trong `index.html` (Phòng 03): đổi `<div class="room__thumbs room__thumbs--strip">` + 1 ảnh
  → `room__thumbs--row` + **4 thẻ `<img>`** (copy y hệt Phòng 02). Rồi **xoá `room3_thumbs.png`** cũ.
- Tiêu đề node: **`246:7032`**.

**b) HƯỚNG DẪN THAM QUAN (`.guide`):**
- Đối chiếu Figma: kiểm tra font tiêu đề "HƯỚNG DẪN THAM QUAN / BẢO TÀNG SỐ" (split-title) — nhiều
  khả năng dùng **Phudu** như hero (hiện đang Be Vietnam Pro 800 → đổi `font-family:var(--font-display)` nếu đúng).
- 3 icon `icon_move/click/device.png` là bản cắt cũ → cân nhắc thay bản gốc từ Figma.

**c) FOOTER (`.footer`):** đối chiếu Figma (logo, 2 cột thông tin, spacing/cỡ chữ). Email đang để trống
("hiện chưa có cần add thêm") — cần điền.

### 7.4. Chi tiết trang trí còn thiếu (cả site, ưu tiên thấp)
- **Vệt swoosh mờ trong dải màu phòng** (đỏ/xanh/lá nhạt) — hiện dải là màu đặc. Thêm bằng `background-image`/SVG.
- **Split-title** ("VR360 / MULTIMEDIA PTIT", "CẤU TRÚC / PHÒNG TRIỂN LÃM") — kiểm tra lại font vs Figma.
- `_figma_ref/fullres.png` (1366×5133) còn để zoom đối chiếu, **nhưng ưu tiên Export ảnh gốc từ Figma**, đừng cắt từ render.

---

## 8. Tham chiếu thiết kế (Figma)
- **Link:** https://www.figma.com/design/iPizSdJQUH5HoLLBKGQXSC/WebDPT?node-id=0-1
- **File key:** `iPizSdJQUH5HoLLBKGQXSC`
- **Khung tổng:** node `243:1685` ("Frame 1"), kích thước **1366×5133**.
- **Hero:** node `243:5059` ("Z2 1"). **Khối phòng:** node `246:6138` ("z5-01 1").

### Bản đồ chiều dọc (toạ độ Y tuyệt đối trên 1366×5133)
| Vùng | Y |
|---|---|
| Hero | 0 – ~786 |
| Sóng màu | ~728 – ~890 |
| Intro "VR360 MULTIMEDIA PTIT" + 3 đoạn | ~880 – ~1510 |
| Tiêu đề "CẤU TRÚC PHÒNG TRIỂN LÃM" | ~1540 – ~1600 |
| Phòng 01 (đỏ) | ~1668 – 2348 |
| Phòng 02 (xanh dương) | ~2512 – 3208 |
| Phòng 03 (xanh lá) | ~3388 – 4080 |
| Hướng dẫn tham quan | ~4180 – 4960 |
| Footer | ~4975 – 5133 |

### Bảng màu (đã rút từ render)
| Vai trò | Mã |
|---|---|
| Nền trang | `#FFFFFF` |
| Tiêu đề tối / Footer / dải đen | `#382828` |
| Cam chủ đạo (nút, nền thẻ trong, chữ tiêu đề phòng) | `#FFAA01` |
| Cam đậm (hover) | `#F09200` |
| Phòng 01 (dải) | `#DD421D` |
| Phòng 02 (dải) | `#004ED8` |
| Phòng 03 (dải) | `#02AF7F` |

- **Font:** Be Vietnam Pro (400/500/600/700/800).
- **Chấm cửa sổ (mac dots) trong title-bar:** đỏ `#ED4C4C`, vàng `#F5B73D`, lục `#3BC04A`.

---

## 9. Bản đồ code (sửa ở đâu)
| Muốn đổi… | Sửa ở |
|---|---|
| Nội dung chữ, thứ tự section, ảnh | `index.html` |
| Màu sắc, spacing, layout, kích thước thẻ/ảnh, responsive | `assets/css/style.css` (biến màu ở `:root`) |
| Hành vi nút (cuộn xuống / mở phòng), cổng hết hạn | `assets/js/main.js` |
| Phòng 3D: scene mẫu, điều khiển, VR, load model | `assets/js/museum.js` |
| Model 3D & ngày hết hạn (client) | `config.js` |
| Ngày tắt Pages (server) | `.github/workflows/expire.yml` (`EXPIRY_DATE`) |

### Cách các nút được nối (trong `main.js`)
- Class `.js-scroll-bottom` → cuộn tới `#hs-enter` (nút cuối).
- Class `.js-open-museum` (chính là `#hs-enter`) → `openMuseum()`.
- Class `.js-close-museum` → đóng overlay.
- Vùng cuộn là `<main class="deck">` (KHÔNG phải `window`) — lưu ý khi thao tác scroll.

### Layout phòng (trong `style.css` — đã refactor, xem comment "CÔNG THỨC" đầu phần ROOMS)
- `.room` = dải màu full-bleed (`.room--red/--blue/--green`), `margin-top` tạo khoảng trắng giữa phòng.
- `.window` = thẻ trắng bo góc chứa `.window__bar` (mac dots + tiêu đề) + `.window__body` (nền cam).
- `.room__grid` = 2 cột **CARD | CỘT nội dung**; thêm `.room__grid--reverse` để đảo CARD sang phải (Phòng 02).
  HTML luôn để `.room__media` TRƯỚC `.room__col` (CSS dùng `order` để đảo).
- `.room__media [--portrait]` = card ảnh · `.room__col` = text → `.room__thumbs--grid|--row|--strip` → `.room__cta`.
- **Mọi kích thước chỉnh ở biến `:root`** — KHÔNG sửa rule:
  `--room-card-w` (card trái), `--room-card-w-portrait` (card phải), `--room-gap`, `--room-col-gap`,
  `--thumb-h`, `--thumb-gap`, `--thumb-radius`, `--card-radius`, `--card-portrait-ratio`, `--window-maxw`.
- Font: `--font-display` (Phudu, tiêu đề lớn) và `--font-ui` (Helvetica/Arial, tiêu đề phòng + nút) ở `:root`.

---

## 10. Trạng thái hiện tại
**Đã kiểm tra (qua DOM/eval; công cụ chụp ảnh tự động của môi trường bị lỗi nên không có ảnh):**
- Landing 7 section: hero, intro, 3 phòng, hướng dẫn, footer — đúng thứ tự, 0 lỗi console.
- **Hero**: font Phudu đúng thiết kế. **Phòng 01 & 02**: ảnh gốc từ Figma + bố cục chuẩn. Tiêu đề phòng/nút đồng bộ.
- **Đã refactor** (xem §7.1–7.2 + §9): gộp 1 hệ layout phòng duy nhất, đưa kích thước ra biến `:root`,
  xoá CSS/asset thừa (`room1_thumbs.png`, `room2_thumbs.png` đã bỏ).
- Luồng nút đúng: 4 nút trên cuộn xuống; nút cuối mở phòng 3D. Phòng 3D WebGL/điều khiển/VR hoạt động.
- Cơ chế hết hạn (client + workflow server) đã có, **chưa điền ngày thật** (đang `null`/placeholder).

**Chưa xong (bàn giao – xem §7.3):**
- **Phòng 03**: cấu trúc xong, còn dùng ảnh cắt cũ (tạm) → thay ảnh gốc từ Figma.
- **Hướng dẫn tham quan** & **Footer**: đối chiếu Figma, tinh chỉnh font/spacing.
- Vài chi tiết trang trí (vệt swoosh dải màu, font split-title) — §7.4.

---

## 11. Gợi ý kiểm thử cho người fix
- So trực tiếp với Figma từng section.
- Test 5 nút: 4 nút phải **cuộn xuống** nút cuối; nút cuối phải **mở phòng 3D**; nút "✕ Thoát"/phím `Esc` đóng.
- Test phòng 3D trên Chrome/Edge desktop. Test VR thì cần deploy HTTPS (GitHub Pages) + Meta Quest mở bằng trình duyệt trong kính.
- Khi có model `.glb`: bỏ vào `assets/models/`, set `modelUrl`, kiểm tra tỉ lệ (`modelScale`) và điểm xuất phát.

---
*Liên hệ thiết kế: file Figma ở §8. Mọi thứ cần chỉnh đều gom ở `config.js`, `style.css`, `index.html`, `museum.js`.*
