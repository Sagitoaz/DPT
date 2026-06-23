# Tổng kết các lỗi đã sửa – Bảo tàng số 3D

**File sửa:** `assets/js/museum.js`  
**Ngày sửa:** 23/06/2026

---

## Lỗi 1 – Ảnh mới không xóa ảnh cũ (ảnh bị đè nhau)

### Triệu chứng
Khi upload ảnh mới vào một khu vực (board), ảnh cũ vẫn còn lưu trong VRAM và đôi khi hiển thị lấp ló dưới ảnh mới, khiến nhiều ảnh bị đè lên nhau.

### Nguyên nhân gốc rễ
Hàm `setBoardMap` cũ dùng `mat.clone()` để tạo material mới mỗi lần gán texture, nhưng **không bao giờ dispose texture cũ**. Kết quả:
- Mỗi lần upload ảnh → tạo ra 1 material clone mới + texture cũ vẫn còn trong VRAM
- Material cũ trở thành "orphan" (không ai tham chiếu nhưng chưa được giải phóng)
- Trình duyệt / WebGL không tự giải phóng → tích tụ gây hiện tượng đè ảnh

### Giải pháp
1. **Thêm hàm `disposeOldBoardMedia(mesh)`**: giải phóng texture cũ (đánh dấu bằng `mat._boardTex`) trước khi gán mới. Nếu là VideoTexture: dừng video và xóa `src` trước khi `.dispose()`.
2. **Sửa `setBoardMap`**: kiểm tra `mat._boardTex` → dispose nếu có → chỉ `clone()` material lần đầu tiên, các lần sau tái dùng material đã clone.
3. **Đánh dấu texture**: gán `mat._boardTex = tex` để phân biệt texture do admin upload với texture gốc của model (tránh xóa nhầm).

```js
// Trước (lỗi):
function setBoardMap(mesh, tex) {
  mat = mat.clone();       // clone mới mỗi lần
  mat.map = tex;           // texture cũ KHÔNG được dispose
  ...
}

// Sau (đã sửa):
function setBoardMap(mesh, tex) {
  if (mat._boardTex) {
    mat._boardTex.dispose();   // giải phóng texture cũ
  }
  if (!mat._boardTex) {
    mat = mat.clone();         // chỉ clone lần đầu
  }
  mat.map = tex;
  mat._boardTex = tex;         // đánh dấu để dispose lần sau
  ...
}
```

---

## Lỗi 2 – Ảnh bị lật so với ảnh gốc

### Triệu chứng
Ảnh upload lên bảng trưng bày bị lật ngược chiều dọc (upside-down), hoặc đôi khi bị lật theo chiều ngang. Lỗi không nhất quán – có board bị, có board không.

### Nguyên nhân gốc rễ
THREE.js `TextureLoader` mặc định đặt `flipY = true` cho mọi texture. Điều này phù hợp với **canvas/HTML** (gốc tọa độ ở góc trên-trái), nhưng **GLTF model** sử dụng hệ tọa độ UV của glTF spec (gốc ở góc **dưới-trái** theo WebGL).

Khi load model bằng `GLTFLoader`, các mesh đã có UV được thiết kế sẵn cho WebGL. Nếu áp texture có `flipY = true` lên UV này → **bị lật đôi** → ảnh ngược.

Ngoài ra, một số mesh cha trong scene có thể có `scale.y = -1` (Blender export convention) làm con lật theo. Việc đặt `flipY = false` trên texture giải quyết cả hai tình huống vì chúng ta giữ nguyên hệ UV của model.

### Giải pháp
Thêm `tex.flipY = false` ngay sau khi load texture, trước khi gán lên material:

```js
// Trước (lỗi):
texLoader.load(info.src, (tex) => {
  tex.colorSpace = THREE.SRGBColorSpace;
  setAll(tex);   // flipY = true (mặc định) → ảnh bị lật
});

// Sau (đã sửa):
texLoader.load(info.src, (tex) => {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = false;   // GLTF UV đã đúng → không lật thêm
  setAll(tex);
});
```

Áp dụng cho **tất cả** loại media:
- Ảnh tĩnh (TextureLoader)
- Thumbnail YouTube (TextureLoader)
- Video trực tiếp (VideoTexture)

---

## Lỗi 3 – Khung ảnh không fit với ảnh (quá to / quá bé)

### Triệu chứng
Texture ảnh không vừa với bề mặt board:
- Ảnh dọc (portrait) bị kéo ngang khi board là landscape (và ngược lại)
- Ảnh quá nhỏ chỉ hiển thị 1 phần giữa khung
- Ảnh quá to bị cắt mất viền

### Nguyên nhân gốc rễ
THREE.js mặc định dùng `repeat = (1, 1)` và `offset = (0, 0)`, tức là texture fill **đúng toàn bộ không gian UV [0..1] × [0..1]** mà không quan tâm đến tỷ lệ khung/ảnh. Khi tỷ lệ ảnh ≠ tỷ lệ board, ảnh bị kéo dài.

### Giải pháp
Thêm hàm `adjustTextureFit(tex, mesh)` để tính `repeat` + `offset` theo kiểu **object-fit: contain**:

1. Tính **tỷ lệ ảnh** (`imgRatio = width / height`)
2. Tính **tỷ lệ board** bằng cách lấy bounding box của mesh, chọn 2 chiều lớn nhất (loại bỏ chiều dày của tấm board)
3. So sánh và điều chỉnh `repeat`/`offset` để ảnh không bị kéo dài, luôn canh giữa

```js
function adjustTextureFit(tex, mesh) {
  // Tính tỷ lệ ảnh
  const imgRatio = img.width / img.height;

  // Tính tỷ lệ board từ bounding box
  const box = new THREE.Box3().setFromObject(mesh);
  const size = box.getSize(new THREE.Vector3());
  const dims = [size.x, size.y, size.z].sort((a, b) => b - a);
  const boardRatio = dims[0] / dims[1];  // 2 chiều lớn nhất

  // Điều chỉnh repeat/offset (contain)
  if (imgRatio > boardRatio) {
    // Ảnh rộng hơn khung → thêm padding trên/dưới
    repeatY = imgRatio / boardRatio;
    offsetY = (repeatY - 1) / 2;
  } else if (imgRatio < boardRatio) {
    // Ảnh hẹp hơn khung → thêm padding trái/phải
    repeatX = boardRatio / imgRatio;
    offsetX = (repeatX - 1) / 2;
  }
  tex.repeat.set(repeatX, repeatY);
  tex.offset.set(-offsetX, -offsetY);
}
```

Hàm này được gọi tự động trong `setBoardMap` sau mỗi lần gán texture mới.

---

## Tóm tắt thay đổi code

| Hàm / Vị trí | Loại thay đổi | Mô tả |
|---|---|---|
| `applyBoardMedia()` | Sửa | Thêm `tex.flipY = false` cho tất cả media; gọi `disposeOldBoardMedia` trước khi tạo VideoTexture mới |
| `adjustTextureFit(tex, mesh)` | **Mới** | Tính aspect ratio từ bounding box, điều chỉnh repeat/offset để fit ảnh (object-fit: contain) |
| `disposeOldBoardMedia(mesh)` | **Mới** | Giải phóng texture/video cũ an toàn trước khi gán mới |
| `setBoardMap(mesh, tex)` | Sửa | Dispose texture cũ, tái dùng material clone, đánh dấu `_boardTex`, tự gọi `adjustTextureFit` |
