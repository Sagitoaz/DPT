# PLAN BÀN GIAO — Giai đoạn BẢO TÀNG 3D · ADMIN · DEPLOY

> Tài liệu cho người tiếp nhận phần **phòng tham quan 3D** (sau khi đã tích hợp model thật).
> Đọc **§5 (việc còn lại)** và **§7 (quyết định cần chốt)** trước khi bắt tay.
> Phần giao diện landing/Figma xem ở **`HANDOVER.md`** (tài liệu cũ, vẫn còn hiệu lực cho mục đó).

---

## 1. Đang ở đâu (tóm tắt 30 giây)
- **Landing page**: xong (vài việc nhỏ còn lại — xem `HANDOVER.md` §7.3).
- **Phòng 3D**: đã tích hợp **model thật `assets/models/Room.glb`**, đã chỉnh xong di chuyển, chỉ báo điều hướng, hiệu năng, ánh sáng. Chạy ~**50 FPS** ở chế độ unlit.
- **CHƯA xong** (việc bàn giao):
  1. **Deploy** — đang vướng **model 132.8MB > giới hạn 100MB của GitHub**.
  2. **Chuẩn hoá model các "bảng trưng bày"** (đặt tên + tách mesh) để gắn được nội dung.
  3. **Gắn ảnh/video lên bảng + popup thông tin**.
  4. **Trang admin** cho người dùng tự thêm/sửa/xoá nội dung bảng.

---

## 2. Đã làm gì trong phòng 3D (toàn bộ ở `assets/js/museum.js`)
- **Load model** `.glb` qua `GLTFLoader` (tự fallback về phòng mẫu nếu lỗi).
- **Điểm xuất phát** cấu hình được (`spawnX/Z/YawDeg`) + **dev HUD** lấy toạ độ (bấm `C` để copy).
- **Chỉ báo điều hướng**: vòng tròn **hover** (xanh, bám con trỏ trên sàn) + vòng **đích** (cam, cố định khi click) + **mũi tên** thu nhỏ dần khi tới gần. Tất cả `depthTest:false` để luôn nổi trên sàn.
- **Di chuyển**: WASD/mũi tên, **giữ SHIFT chạy nhanh**, click sàn để đi, giữ–kéo chuột xoay; vùng đi lại bám đúng **hộp bao thật của model** (không đối xứng quanh gốc).
- **Hiệu năng**: tự **thu nhỏ texture** > `maxTextureSize` lúc load; giới hạn `maxPixelRatio`; **bộ đếm FPS** (`showFps`); in **tên GPU** ra console để soi tăng tốc phần cứng.
- **Ánh sáng**: 2 chế độ — `bakedLighting:true` = **unlit** (rẻ nhất, cho cảnh tĩnh đã bake); `false` = bầu trời Nishita (Sky + IBL) mô phỏng node Blender.
- **Chống cache**: import có `?v=N` (hiện `v=4`) — đổi số này mỗi lần sửa file `.js`/`config.js` để người dùng nhận code mới (hoặc bật DevTools → Network → *Disable cache*).

---

## 3. Bảng cấu hình `config.js` (chỉ chỉnh ở đây — `window.WEBDPT_CONFIG`)
| Khoá | Giá trị hiện tại | Ý nghĩa |
|---|---|---|
| `modelUrl` | `"assets/models/Room.glb"` | Đường dẫn model. `null` = phòng mẫu placeholder. |
| `modelScale` / `modelYOffset` | `1` / `0` | Phóng to-thu nhỏ / nâng-hạ model nếu lệch. |
| `spawnHeight` | `2` | Cao tầm mắt (m). |
| `moveSpeed` | `3.2` | Tốc độ đi (m/s). |
| `sprintMultiplier` | `2.3` | Hệ số khi giữ SHIFT. |
| `maxPixelRatio` | `1.5` | Độ nét render; giảm `1.25`/`1` để tăng FPS. |
| `maxTextureSize` | `1024` | Tự thu nhỏ texture lớn hơn mức này (px). `0` = giữ nguyên. |
| `showFps` | `true` | Hiện FPS góc phải. **Trước khi giao công khai nên đặt `false`.** |
| `bakedLighting` | `true` | `true` = unlit (cảnh tĩnh đã bake). `false` = ánh sáng bầu trời động. |
| `modelBrightness` | `1.4` | (Chỉ khi `bakedLighting:true`) Nâng sáng model bằng nhân màu vật liệu **1 lần lúc nạp** — không thêm đèn động → **không tụt FPS**. `1.0` = giữ nguyên; `1.3–1.6` sáng hơn (cao quá sẽ cháy vùng sáng). |
| `sunElevationDeg` / `sunAzimuthDeg` | `64` / `42.4` | Hướng mặt trời (chỉ dùng khi `bakedLighting:false`). |
| `exposure` / `envIntensity` | `0.7` / `0.8` | Sáng tổng thể / độ mạnh môi trường (chỉ khi `false`). |
| `spawnX` / `spawnZ` / `spawnYawDeg` | `0.99` / `90.78` / `0` | Vị trí + hướng nhìn xuất phát. |
| `devHud` | `false` | `true` để hiện bảng lấy toạ độ spawn. |
| `sound` | `{enabled, bgSrc, bgVolume, popupSrc, popupVolume, duck}` | Âm thanh phòng 3D (xem §3b). Đây là **mặc định** — admin ghi đè ở `assets/data/settings.json`. |
| `expiryDate` | `null` | Ngày hết hạn (client). Điền khi deploy. |

### 3b. Âm thanh (nhạc nền + âm báo popup)
- Logic gói trong `assets/js/audio.js`; `museum.js` gọi: `resume()→start()`, `pause()→stop()`, mở popup → `popup()+duck()`, đóng popup → `unduck()`.
- Nút **🔊/🔇** trên topbar (`#museum-sound-btn`) bật/tắt; lựa chọn lưu ở `localStorage['webdpt_sound_muted']`.
- **Ducking**: khi popup mở, nhạc nền giảm còn `bgVolume × duck` (mặc định 20%); đóng popup trả lại.
- **Không cần file audio**: để `bgSrc`/`popupSrc` trống → dùng tiếng tổng hợp Web Audio sẵn (nền ambient êm + tiếng "pop"). Admin có thể tải file mp3/ogg lên repo hoặc dán link để thay.
- **Admin chỉnh** ở `admin.html` mục "3. Âm thanh phòng 3D" → lưu `assets/data/settings.json` dạng `{ "sound": {...} }`; `museum.js` đọc file này và ghi đè mặc định của `config.js`.

---

## 4. Bản đồ code (sửa ở đâu)
| Muốn đổi… | Sửa ở |
|---|---|
| Logic phòng 3D (scene, điều khiển, load model, ánh sáng, nav, FPS) | `assets/js/museum.js` |
| Âm thanh (nhạc nền, âm báo popup, ducking, nút bật/tắt) | `assets/js/audio.js` |
| Cấu hình âm thanh do admin chỉnh | `assets/data/settings.json` (admin) + mặc định `config.js` |
| Mọi tham số 3D + ngày hết hạn (client) | `config.js` |
| Mở/đóng phòng, nối nút, cổng hết hạn | `assets/js/main.js` |
| Markup landing + overlay phòng 3D | `index.html` |
| Style | `assets/css/style.css` |
| Ngày tắt Pages (server) | `.github/workflows/expire.yml` |

---

## 5. ⬅ VIỆC CÒN LẠI (roadmap bàn giao — làm theo thứ tự)

### A. [CHẶN DEPLOY] Giảm dung lượng model xuống < 100MB (lý tưởng < 50MB)
- **Vì sao**: GitHub **từ chối push file > 100MB**. `Room.glb` hiện **132.8MB** → không push được.
- **Hiện trạng git**: commit `eb99ede "add model 3D"` (gồm model + code 3D) **đang ở local, CHƯA push** (origin vẫn ở `ce12372`). → Sửa local là gọn, chưa dính GitHub.
- **Cách làm**:
  1. Trong **Blender**: hạ texture xuống **1024–2048**, export đè lên `assets/models/Room.glb` (giữ đúng tên, **đúng chữ hoa `Room.glb`** vì Pages chạy Linux phân biệt hoa/thường). Hình học chỉ 74k tam giác nên **không cần Draco**.
  2. `git add -A` → `git commit --amend --no-edit` (thay blob nặng trong commit chưa-push bằng blob nhẹ → bản 132.8MB không bị đẩy lên).
  3. Push (xem mục B).
- **Lưu ý**: bản web đã **tự thu nhỏ texture về 1024 khi chạy** (VRAM/FPS đã ổn) → lợi ích của bước nén này chủ yếu là **giảm dung lượng TẢI lần đầu** + để **lọt giới hạn GitHub**.
- **Phương án thay thế nếu không muốn nén**: tải `Room.glb` lên **GitHub Releases** (cho phép tới 2GB), bỏ model khỏi repo, đặt `modelUrl` = URL tuyệt đối của release. Cần kiểm tra CORS cho `fetch`.

### B. Deploy lên GitHub Pages
1. (Sau khi đã giảm model) `git push -u origin main`.
2. Repo GitHub → **Settings → Pages** → Source: **Deploy from a branch** → `main` / `(root)` → Save.
3. ~1–2 phút sau chạy tại **https://rei-1407.github.io/Web-DPT/** (đường dẫn tương đối nên chạy ngon dưới subpath `/Web-DPT/`).
4. **Cổng hết hạn** (nếu muốn): điền `expiryDate` trong `config.js` **và** `EXPIRY_DATE` trong `.github/workflows/expire.yml` **trùng ngày** (deploy + 30). Nếu workflow báo lỗi quyền tắt Pages → tạo PAT quyền *Pages: write*, thêm secret `GH_PAT`.

### C. Chuẩn hoá model "bảng trưng bày" (yêu cầu gửi đội thiết kế 3D)
Để sau này gắn/sửa nội dung từng bảng qua web:
1. **Mỗi bảng = 1 mesh riêng, có TÊN riêng** không dấu/không cách: `board_01`, `board_02`… (hoặc `img_01`/`video_01`). **Không join chung.** Tên cố định (là "địa chỉ" để web gắn nội dung). Kiểm tra tên còn nguyên sau khi export `.glb`.
2. **Tách bề mặt hiển thị khỏi khung**; mỗi bề mặt **material riêng** (không dùng chung).
3. **UV** mặt trước lấp đầy 0–1, không xoay/lật; **normal quay ra ngoài**; pivot ở tâm.
4. **Chuẩn hoá tỉ lệ**: 16:9 (video/ảnh ngang), 3:4 (dọc), 1:1 (vuông).
5. **KHÔNG bake sáng lên bề mặt bảng** (vì web sẽ thay texture); để material trung tính/hơi emissive. Bake cho tường/sàn/trần thì bình thường.
6. **Không phủ kính/phản chiếu** trước bảng.
7. Bàn giao kèm **"bản đồ bảng"**: ID · vị trí · kích thước (m) · tỉ lệ · loại (ảnh/video).
8. **Làm 1 bảng mẫu trước** để test toàn trình rồi mới nhân ra.

### D. Định dạng dữ liệu nội dung (đề xuất)
Một file (vd `assets/data/exhibits.json`) ánh xạ tên bảng → nội dung:
```json
{
  "board_01": { "type": "image", "src": "assets/exhibits/a1.jpg", "title": "Tên SP", "desc": "Mô tả…", "link": "" },
  "board_02": { "type": "video", "src": "assets/exhibits/clip.mp4", "title": "…", "desc": "…" }
}
```

### E. Code web đọc nội dung + popup (việc trong `museum.js`)
- Sau khi load model: với mỗi `board_id` trong JSON → `scene.getObjectByName(board_id)` → gán `texture` (ảnh) hoặc `THREE.VideoTexture` (video) lên `material.map` của bề mặt; đẩy mesh đó vào mảng `products` và set `userData = { title, desc, link }`.
- Click đã có sẵn cơ chế: trúng mesh có `userData.title` → mở `#product-panel`. Chỉ cần bổ sung hiện ảnh/video/link trong panel.
- *(Hạ tầng click/hover/raycast đã sẵn — chỉ thiếu bước "đổ dữ liệu vào bảng theo tên".)*

### F. Trang admin (CRUD nội dung bảng) — **CẦN CHỐT KIẾN TRÚC, xem §7**
Người dùng thêm/sửa/xoá ảnh/video cho từng bảng. Lựa chọn lưu trữ ở §7.

### G. Phần landing còn lại
Xem `HANDOVER.md` §7.3: Phòng 03 thay ảnh gốc, đối chiếu Hướng dẫn & Footer, điền email.

### H. Trước khi bàn giao công khai
- Đặt `showFps:false`, `devHud:false` trong `config.js`.
- Điền ngày hết hạn (nếu dùng) ở 2 nơi.
- Cân nhắc `bakedLighting` (bake thật trong Blender để đẹp hơn) hoặc giữ ánh sáng động.

---

## 6. Quyết định kỹ thuật đã chốt (để người mới khỏi làm lại)
- **Cảnh tĩnh → render UNLIT** (`bakedLighting:true`): nhẹ nhất, đúng màu Blender. Đã lên ~50 FPS.
- **Lag ban đầu (~25 FPS) KHÔNG do GPU**: đo được render chỉ 0.5–7 ms (143–1850 FPS khả năng) trên RTX 4070 SUPER. Nguyên nhân là chi phí shading PBR ở độ phân giải thật → chuyển unlit là giải pháp đúng.
- **Model 133MB là do texture 4K**, hình học chỉ 74k tam giác → tối ưu nằm ở **texture**, không phải lưới.
- **Tự thu nhỏ texture về 1024 khi chạy** để nhẹ VRAM (đã bật).
- **Ánh sáng Nishita** (Sky + IBL) chỉ là **bản mô phỏng gần đúng** node Blender (three.js dùng mô hình Preetham), giữ lại ở chế độ `bakedLighting:false`.

---

## 7. ❓ Câu hỏi mở — CẦN CHỦ DỰ ÁN QUYẾT
1. **Admin lưu dữ liệu kiểu nào?**
   - **(a) Không backend** — trang admin sửa JSON rồi *tải về*, có người commit lại repo (đơn giản, miễn phí, nhưng không "tự lưu" trên web tĩnh).
   - **(b) Có backend/DB** — Firebase/Supabase/server nhỏ → người dùng tự lưu trực tuyến thật (cần thiết lập thêm).
   - **(c) Dùng GitHub API làm backend** — admin commit JSON qua token (lưu ý bảo mật token).
   → Web hiện là **tĩnh trên GitHub Pages**, nên muốn "người dùng tự thêm và lưu được ngay" thì phải chọn (b) hoặc (c).
2. **Host model**: nén để nhét vào GitHub (khuyến nghị) hay dùng GitHub Releases/CDN?
3. **Số lượng bảng + nội dung** cuối cùng (để dựng danh sách trong admin).

---

## 8. Chạy local & gotchas
- **Chạy local**: phải dùng server tĩnh (ES module + fetch model không chạy bằng `file://`):
  `python -m http.server 8123` → mở `http://localhost:8123` (hoặc Live Server của VS Code).
- **Giới hạn 100MB/file của GitHub** — xem §5.A.
- **Pages phân biệt hoa/thường** đường dẫn (Linux): giữ đúng `Room.glb`.
- **Cache**: sau khi sửa `.js`/`config.js`, đổi `?v=N` trong `index.html` + `main.js`, hoặc bật DevTools *Disable cache*.
- **WebXR/VR** cần HTTPS → test VR phải qua GitHub Pages (https), không qua localhost http.

---

*Tài liệu này bổ sung cho `HANDOVER.md`. Mọi tham số 3D gom ở `config.js`; logic 3D ở `assets/js/museum.js`.*
