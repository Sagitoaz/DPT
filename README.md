# WebDPT — Bảo tàng số Khoa Đa phương tiện (VR360 PTIT)

Landing page + trải nghiệm **tham quan bảo tàng 3D** (WASD, xoay chuột, click sàn để đi, hỗ trợ kính VR Meta Quest 3).

## Cấu trúc
```
WebDPT/
├─ index.html                 # trang landing
├─ config.js                  # ⭐ chỉnh model 3D & ngày hết hạn ở đây
├─ assets/
│  ├─ css/style.css
│  ├─ js/main.js              # cổng hết hạn + mở/đóng bảo tàng
│  ├─ js/museum.js            # không gian 3D (three.js + WebXR)
│  ├─ img/                    # ảnh cắt từ thiết kế Figma
│  └─ models/                 # ⬅ bỏ file .glb vào đây
└─ .github/workflows/expire.yml   # tự tắt Pages khi hết hạn
```

## Chạy thử ở máy (local)
Cần một web server tĩnh (ES module + three.js không chạy bằng mở file trực tiếp):
```bash
# Python
python -m http.server 8000
# rồi mở http://localhost:8000
```

## Thay model 3D
1. Xuất model ra `.glb` (< 50MB), copy vào `assets/models/`.
2. Trong `config.js` sửa: `modelUrl: "assets/models/<tên>.glb"`.
   Để `null` thì dùng phòng mẫu placeholder.

## Deploy lên GitHub Pages
1. Tạo repo, push toàn bộ thư mục này lên.
2. Settings → Pages → **Deploy from a branch** → chọn `main` / `(root)` → Save.
3. Vài phút sau web chạy tại `https://<user>.github.io/<repo>/`.
   (HTTPS sẵn có — cần cho WebXR/Meta Quest.)

## Cho web tự "sập" sau 30 ngày (2 lớp)
- **Lớp người dùng:** đặt `expiryDate` trong `config.js` = ngày deploy + 30
  (ví dụ `"2026-07-19T00:00:00+07:00"`). Quá hạn → hiện màn hình "đã kết thúc".
- **Lớp server (tắt thật):** mở `.github/workflows/expire.yml`, sửa `EXPIRY_DATE`
  = cùng ngày. Mỗi ngày Action sẽ kiểm tra, tới hạn thì **tắt GitHub Pages**.
  - Nếu báo lỗi quyền khi tắt Pages: tạo Personal Access Token (quyền *Pages: write*)
    rồi thêm vào repo: Settings → Secrets → Actions → `GH_PAT`.

## Điều khiển trong bảo tàng 3D
| Thao tác | Ý nghĩa |
|---|---|
| `W A S D` / phím mũi tên | Di chuyển |
| Giữ & kéo chuột | Xoay góc nhìn |
| Click vào sàn | Di chuyển tới điểm đó |
| Click vào sản phẩm | Mở bảng thông tin |
| Nút **VR** | Vào chế độ kính (Meta Quest 3) |
