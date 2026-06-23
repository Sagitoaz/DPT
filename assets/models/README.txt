ĐẶT MODEL 3D Ở ĐÂY
====================

1. Xuất model ra định dạng .glb (glTF 2.0 binary), dung lượng < 50MB.
   - Nên bật nén Draco/Meshopt + texture KTX2 cho nhẹ & mượt trên kính VR.

2. Copy file .glb vào đúng thư mục này, ví dụ:  assets/models/baotang.glb

3. Mở file  config.js  ở thư mục gốc và sửa 1 dòng:
       modelUrl: "assets/models/baotang.glb",
   (Để  modelUrl: null  thì web dùng "phòng mẫu" placeholder dựng sẵn.)

4. Nếu model bị lệch tỉ lệ/độ cao, chỉnh thêm trong config.js:
       modelScale   : phóng to/thu nhỏ
       modelYOffset : nâng/hạ theo trục Y (mét)

Thay model lúc nào cũng được — chỉ cần đổi file & 1 dòng đường dẫn,
không phải sửa code khác.
