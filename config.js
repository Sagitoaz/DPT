/* =====================================================================
   WebDPT – Bảng cấu hình DUY NHẤT (chỉnh ở đây, không cần sửa code khác)
   ===================================================================== */
window.WEBDPT_CONFIG = {
  /* --------------------------------------------------------------
     MODEL 3D
     - Để null  -> dùng "phòng mẫu" dựng sẵn (placeholder) để test.
     - Khi có model thật: bỏ file .glb vào  assets/models/  rồi sửa
       đường dẫn bên dưới. Chỉ cần đổi đúng 1 dòng này.
     - Định dạng khuyến nghị: .glb (glTF 2.0 binary, < 50MB).
  ---------------------------------------------------------------- */
  // Model thật BaoTangSo.glb (~71MB, dưới giới hạn 100MB của GitHub → push được).
  // Đặt null để quay lại "phòng mẫu" placeholder khi cần test giao diện.
  modelUrl: "assets/models/BaoTangSo.glb",
  modelScale: 1,                  // phóng to/thu nhỏ model nếu cần
  modelYOffset: 0,                // nâng/hạ model theo trục Y (mét). Sàn lửng lơ/lún thì chỉnh số này.
  spawnHeight: 2,                 // chiều cao tầm mắt người xem (mét)
  moveSpeed: 3.2,                 // tốc độ đi bộ (mét/giây)
  sprintMultiplier: 2.3,          // giữ SHIFT để chạy nhanh: nhân tốc độ lên bấy nhiêu lần

  /* --------------------------------------------------------------
     HIỆU NĂNG – giảm nếu máy yếu / vẫn còn lag.
  ---------------------------------------------------------------- */
  maxPixelRatio: 1.5,             // độ nét render; giảm 1.25 hoặc 1 để tăng FPS
  maxTextureSize: 1024,           // tự thu nhỏ texture lớn hơn mức này (px); màn 1080p để 1024 là thừa nét
  showFps: false,                 // hiện số FPS ở góc phải để đo độ mượt (đo xong đặt false)

  /* --------------------------------------------------------------
     ÁNH SÁNG – chọn 1 trong 3 chế độ qua lightMode:
       'lit'   : đèn TĨNH rẻ tiền (ambient + hemisphere + 1 directional, KHÔNG
                 bóng đổ) + vật liệu Lambert. Sáng đều gần như Blender mà KHÔNG
                 tụt FPS. → KHUYẾN NGHỊ cho model CHƯA bake sáng (như hiện tại).
       'unlit' : render đúng texture đã BAKE, nhẹ nhất. CHỈ đẹp nếu đã bake sáng
                 trong Blender; model chưa bake -> tường/trần đen.
       'sky'   : bầu trời Nishita (Sky + IBL) + PBR đầy đủ. Đẹp nhất, NẶNG nhất.
     Muốn giống Blender 100% mà vẫn nhẹ: bake sáng trong Blender rồi dùng 'unlit'.
  ---------------------------------------------------------------- */
  lightMode: 'lit',
  // Đèn fill (dùng cho 'lit'/'hdri'). Phòng tối/bệt -> kéo lên; chói -> hạ xuống.
  ambientIntensity: 0.7,          // nền sáng phẳng (không chỗ nào tối hẳn)
  hemiIntensity: 1.8,             // sáng đổ đều từ trên xuống (mô phỏng GI)
  dirIntensity: 1.1,              // 1 đèn hướng tạo khối nhẹ (không bóng đổ)
  // Pool sáng dưới sàn (giống spotlight Blender) nhưng RẺ: đọc vị trí 27 đèn
  // spot gốc rồi vẽ đĩa sáng mờ tại chỗ -> KHÔNG dùng đèn thật nên không tụt FPS.
  spotPools: true,
  spotPoolStrength: 0.55,         // độ đậm pool sáng (0–1). Nhạt quá -> tăng; cháy -> giảm.
  spotPoolFloorY: 0,              // cao độ mặt sàn để đặt pool (mặc định 0 = sàn click-to-move). Pool lửng lơ/chìm thì chỉnh số này.
  useModelLights: false,          // true = bật 27 đèn spot THẬT (giống Blender nhất NHƯNG rất nặng/đơ máy yếu)
  bgColor: 0x11141a,              // màu nền không gian quanh model

  // Tinh chỉnh sáng tổng thể model (nhân màu vật liệu 1 lần lúc nạp, mọi chế độ).
  // 1.0 = giữ nguyên; >1 sáng hơn (cao quá dễ "cháy" vùng sáng).
  modelBrightness: 1.0,

  /* --------------------------------------------------------------
     HDRI MÔI TRƯỜNG – nền "ngoài trời" (qua cửa sổ) để hết đen sì.
     Đặt file .exr/.hdr equirectangular vào assets/models/ rồi trỏ vào đây.
     Để hdriUrl: "" (rỗng) để tắt, quay lại nền màu trơn (bgColor).
  ---------------------------------------------------------------- */
  // Đã chuyển EXR 8K multilayer -> HDR 4K chuẩn cho web (assets/models/HDRi_web.hdr).
  // Hỗ trợ .hdr / .exr / ảnh thường (.jpg/.png/.webp). "" = tắt, dùng nền màu trơn.
  hdriUrl: "assets/models/HDRi_web.hdr",
  hdriAsBackground: true,         // hiện HDRI làm bầu trời/nền (ngoài cửa sổ hết đen)
  hdriIntensity: 1.0,             // độ sáng nền HDRI (kéo xuống nếu chói, lên nếu tối)
  // QUAN TRỌNG: false = HDRI CHỈ làm nền ngoài trời, KHÔNG rọi sáng vào trong
  // (tránh làm trôi/bệt nội dung các bảng). true = dùng HDRI chiếu sáng (IBL) -> sáng đè.
  hdriAsEnvironment: false,
  envIntensity: 1.0,              // độ mạnh IBL khi hdriAsEnvironment=true (chỉ 'hdri'/'sky')

  // bakedLighting: GIỮ để tương thích ngược (lightMode ở trên được ưu tiên).
  bakedLighting: true,
  sunElevationDeg: 64,            // (chỉ dùng khi lightMode='sky') độ cao mặt trời
  sunAzimuthDeg: 42.4,            // (chỉ dùng khi lightMode='sky') hướng xoay mặt trời
  exposure: 1.0,                  // độ phơi sáng tổng thể (dùng cho 'hdri'/'lit'/'sky')

  /* --------------------------------------------------------------
     ĐIỂM XUẤT PHÁT của người xem (vị trí đứng + hướng nhìn ban đầu).
     - Chưa biết đặt ở đâu? Để  devHud: true  bên dưới, mở web, bấm
       "Kích hoạt bảo tàng số 3D", đi bộ (W A S D) tới chỗ muốn đứng,
       xoay hướng nhìn mong muốn, rồi đọc 3 số spawnX / spawnZ /
       spawnYawDeg hiện ở góc màn hình (hoặc bấm phím C để copy) và
       dán ngược 3 số đó vào đây. Xong thì đổi  devHud: false.
  ---------------------------------------------------------------- */
  spawnX: 0.99,                   // tọa độ ngang  (mét)
  spawnZ: 90.78,                  // tọa độ chiều sâu (mét)
  spawnYawDeg: 0,                 // hướng nhìn ban đầu (độ, 0–360)
  devHud: false,                  // bật true nếu muốn hiện lại bảng toạ độ để lấy điểm khác

  /* --------------------------------------------------------------
     ÂM THANH trong phòng 3D (nhạc nền + âm báo popup).
     - Đây là GIÁ TRỊ MẶC ĐỊNH. Admin có thể chỉnh & ghi đè qua trang
       admin.html (lưu vào assets/data/settings.json) mà không cần sửa file này.
     - Để bgSrc / popupSrc = "" -> dùng âm tổng hợp sẵn (không cần file):
         + nền  : tiếng ambient êm dịu.
         + popup: tiếng "pop" ngắn.
  ---------------------------------------------------------------- */
  sound: {
    enabled: true,        // bật âm thanh mặc định khi vào phòng (người xem vẫn tắt được bằng nút 🔊)
    bgSrc: '',            // nhạc nền: đường dẫn mp3/ogg trong repo hoặc link; "" = tiếng nền tổng hợp
    bgVolume: 0.4,        // âm lượng nhạc nền (0–1)
    popupSrc: '',         // âm báo khi mở popup: đường dẫn file; "" = tiếng "pop" tổng hợp
    popupVolume: 0.7,     // âm lượng âm báo popup (0–1)
    duck: 0.2,            // khi popup mở, nhạc nền còn bao nhiêu (0–1; 0.2 = còn 20%)
  },

  /* --------------------------------------------------------------
     NGÀY HẾT HẠN – web tự "sập" sau ngày này.
     - Đặt = NGÀY DEPLOY + 90 ngày.
     - Để null = không giới hạn (chạy mãi).
     - Đây là lớp chặn phía người dùng; lớp tắt-thật phía server
       nằm ở .github/workflows/expire.yml (nhớ điền cùng ngày).
  ---------------------------------------------------------------- */
  expiryDate: null,               // ví dụ: "2026-07-19T00:00:00+07:00"
};
