/* =====================================================================
   museum.js – Bảo tàng số 3D (three.js)
   Điều khiển:
     - W A S D / phím mũi tên : di chuyển
     - Giữ & kéo chuột         : xoay góc nhìn
     - Click sàn               : di chuyển tới điểm
     - Click sản phẩm          : mở bảng thông tin
   ===================================================================== */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { createMuseumAudio } from './audio.js?v=1';

export async function initMuseum({ mount, loadingEl, productPanel, soundBtn, config }) {
  const CFG = config || {};
  const EYE = CFG.spawnHeight ?? 1.6;
  const SPEED = CFG.moveSpeed ?? 3.2;
  const SPRINT = CFG.sprintMultiplier ?? 2.3;   // hệ số chạy nhanh khi giữ SHIFT

  /* Chế độ ánh sáng (xem config.js > lightMode). Tương thích ngược: nếu chưa
     khai báo lightMode thì suy ra từ bakedLighting cũ.
       'hdri'  : PBR đầy đủ + chiếu sáng bằng ảnh HDRI (IBL) + nền HDRI. ĐẸP &
                 chân thực nhất (giống Blender), NẶNG hơn -> chọn khi ưu tiên đẹp.
       'lit'   : đèn TĨNH rẻ (ambient/hemisphere) + vật liệu Lambert, giữ emissive.
                 Sáng đều mà KHÔNG bóng đổ -> nhẹ, không tụt FPS.
       'unlit' : rẻ nhất, render đúng texture đã BAKE. Model chưa bake -> tường đen.
       'sky'   : bầu trời Nishita (Sky + IBL) + PBR. */
  const MODE = CFG.lightMode || (CFG.bakedLighting ? 'unlit' : 'sky');

  /* ----------------------- Renderer / Scene ----------------------- */
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, CFG.maxPixelRatio ?? 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = (MODE === 'unlit') ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = CFG.exposure ?? 1;
  mount.appendChild(renderer.domElement);

  // In tên GPU ra console: nếu thấy "SwiftShader"/"Software"/"ANGLE ... llvmpipe"
  // => trình duyệt KHÔNG bật tăng tốc phần cứng (đây là nguyên nhân lag nặng nhất).
  try {
    const _gl = renderer.getContext();
    const _dbg = _gl.getExtension('WEBGL_debug_renderer_info');
    if (_dbg) console.log('[museum] GPU:', _gl.getParameter(_dbg.UNMASKED_RENDERER_WEBGL));
  } catch (e) { }

  const scene = new THREE.Scene();
  // Nền & ánh sáng môi trường do bầu trời (Sky) đảm nhiệm – xem mục Bầu trời bên dưới.

  const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 200);

  // "player" = chân người xem; camera đặt ở tầm mắt EYE và là con của player.
  const player = new THREE.Group();
  player.position.set(CFG.spawnX ?? 0, 0, CFG.spawnZ ?? 6);
  player.add(camera);
  camera.position.set(0, EYE, 0);
  scene.add(player);

  /* ------------------------------ Ánh sáng ------------------------------
     Xem 3 chế độ ở khai báo MODE phía trên. Model BaoTangSo.glb CHƯA bake sáng
     (tường/trần albedo gần phẳng, dựa vào đèn realtime của Blender) nên 'unlit'
     để tường/trần đen. Mặc định dùng 'lit': thắp sáng TĨNH bằng đèn môi trường
     rẻ tiền (ambient + hemisphere + 1 directional, KHÔNG bóng đổ) -> sáng đều
     gần như Blender mà gần như không thêm chi phí mỗi khung hình. */
  if (MODE === 'unlit') {
    scene.background = new THREE.Color(CFG.bgColor ?? 0x15171c);   // không gian xung quanh để tối
  } else if (MODE === 'hdri') {
    // Ánh sáng chính = HDRI (IBL) đặt trong applyHDRI(). Ở đây chỉ thêm fill nhẹ
    // để nội bộ phòng (xa cửa sổ) không bị tối, + 1 key tạo khối. Để dịu vì HDRI lo phần chính.
    scene.background = new THREE.Color(CFG.bgColor ?? 0x11141a);   // tạm, HDRI sẽ ghi đè nền
    scene.add(new THREE.HemisphereLight(0xffffff, 0x9097a0, CFG.hemiIntensity ?? 0.6));
    scene.add(new THREE.AmbientLight(0xffffff, CFG.ambientIntensity ?? 0.3));
    const key = new THREE.DirectionalLight(0xfff3e0, CFG.dirIntensity ?? 0.8);
    key.position.set(6, 14, 8);
    scene.add(key);
  } else if (MODE === 'lit') {
    scene.background = new THREE.Color(CFG.bgColor ?? 0x11141a);
    // Hemisphere = sáng trời/đất đổ đều từ trên xuống (mô phỏng ánh sáng dội/GI).
    scene.add(new THREE.HemisphereLight(0xffffff, 0x9097a0, CFG.hemiIntensity ?? 1.8));
    // Ambient = nền sáng phẳng để không chỗ nào tối hẳn.
    scene.add(new THREE.AmbientLight(0xffffff, CFG.ambientIntensity ?? 0.7));
    // 1 đèn hướng (không bóng đổ) tạo chút khối cho bề mặt – rẻ.
    const key = new THREE.DirectionalLight(0xfff3e0, CFG.dirIntensity ?? 1.1);
    key.position.set(6, 14, 8);
    scene.add(key);
  } else { /* 'sky' */
    const sunDir = new THREE.Vector3().setFromSphericalCoords(
      1,
      THREE.MathUtils.degToRad(90 - (CFG.sunElevationDeg ?? 64)),
      THREE.MathUtils.degToRad(CFG.sunAzimuthDeg ?? 42.4)
    );
    scene.background = new THREE.Color(0xc7d4e2);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    const skyEnv = new Sky();
    skyEnv.scale.setScalar(1000);
    const e = skyEnv.material.uniforms;
    e['turbidity'].value = 4;
    e['rayleigh'].value = 2;
    e['mieCoefficient'].value = 0.005;
    e['mieDirectionalG'].value = 0.8;
    e['sunPosition'].value.copy(sunDir);
    envScene.add(skyEnv);
    scene.environment = pmrem.fromScene(envScene).texture;
    pmrem.dispose();

    scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x20242c, 0.35));
    const sun = new THREE.DirectionalLight(0xfff6e6, 2.4);
    sun.position.copy(sunDir).multiplyScalar(80);
    scene.add(sun);
  }

  /* --------- Sàn vô hình để raycast (click-to-move) luôn có ---------- */
  const floorHitPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  floorHitPlane.rotation.x = -Math.PI / 2;
  scene.add(floorHitPlane);

  const products = []; // các mesh có thể click để xem thông tin
  let _poolTex = null; // cache texture đốm sáng pool (xem poolTexture()); để đây để loadModel dùng được sớm
  // Vùng đi lại = hình chữ nhật (theo hộp bao model, không bắt buộc đối xứng gốc)
  let bMinX = -9.2, bMaxX = 9.2, bMinZ = -9.2, bMaxZ = 9.2;

  /* ----- HDRI môi trường: nền "ngoài trời" (+ phản chiếu nếu bật) -----
     Không có HDRI -> ngoài cửa sổ là nền đen. Nạp file .exr (equirectangular)
     làm scene.background để bầu trời/xung quanh hiện ra. */
  async function applyHDRI() {
    const url = CFG.hdriUrl;
    if (!url) return;
    const ext = url.split('?')[0].split('.').pop().toLowerCase();
    let tex;
    try {
      if (ext === 'hdr') tex = await new RGBELoader().loadAsync(url);
      else if (ext === 'exr') tex = await new EXRLoader().loadAsync(url);
      else tex = await new THREE.TextureLoader().loadAsync(url);   // jpg/png/webp
    } catch (e) { console.warn('[museum] không tải được HDRI:', url, e); return; }
    tex.mapping = THREE.EquirectangularReflectionMapping;
    if (CFG.hdriAsBackground ?? true) {
      scene.background = tex;
      scene.backgroundIntensity = CFG.hdriIntensity ?? 1;   // độ sáng nền
    }
    // Dùng HDRI chiếu sáng phản chiếu/IBL: cần cho PBR ('hdri'/'sky'); 'lit' (Lambert
    // matte) mặc định TẮT để tường khỏi bị bóng loáng.
    if (CFG.hdriAsEnvironment ?? (MODE === 'sky' || MODE === 'hdri')) {
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromEquirectangular(tex).texture;
      pmrem.dispose();
    }
  }

  /* ----------------------- Nội dung không gian -------------------- */
  const hdriReady = applyHDRI();              // nạp song song với model cho nhanh
  if (CFG.modelUrl) {
    await loadModel(CFG.modelUrl);
  } else {
    buildPlaceholderRoom();
  }
  // Gắn nội dung (ảnh/video/tiêu đề/mô tả/link) lên các bảng theo tên — dữ liệu
  // do trang admin quản lý ở assets/data/exhibits.json. Lỗi/không có file -> bỏ qua.
  await applyExhibits();
  await hdriReady;

  /* ------------------------------ Âm thanh ------------------------------
     Cấu hình mặc định ở config.js (CFG.sound) + ghi đè từ trang admin
     (assets/data/settings.json -> { sound: {...} }). Không có file -> mặc định. */
  let soundCfg = Object.assign(
    { enabled: true, bgSrc: '', bgVolume: 0.4, popupSrc: '', popupVolume: 0.7, duck: 0.2 },
    CFG.sound || {}
  );
  try {
    const r = await fetch('assets/data/settings.json?ts=' + Date.now());
    if (r.ok) { const s = await r.json(); if (s && s.sound) soundCfg = Object.assign(soundCfg, s.sound); }
  } catch (e) { /* chưa có settings.json -> dùng mặc định */ }
  const audio = createMuseumAudio(soundCfg, { button: soundBtn });

  /* --------- Nhận diện link YouTube/Vimeo -> URL nhúng (iframe) ---------
     Trả null nếu src là file thường (.mp4…) để xử lý bằng <video>/VideoTexture. */
  function youtubeId(u) {
    const m = String(u || '').match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
  }
  function vimeoId(u) {
    const m = String(u || '').match(/vimeo\.com\/(?:video\/)?(\d+)/);
    return m ? m[1] : null;
  }
  function embedUrl(src) {
    const y = youtubeId(src); if (y) return 'https://www.youtube.com/embed/' + y;
    const v = vimeoId(src); if (v) return 'https://player.vimeo.com/video/' + v;
    return null;
  }

  /* Mã bảng = TÊN MATERIAL chuẩn hoá. Model đặt tên bảng qua material
     (vd "Image_Board_01", "Image_Board_Left_03", "Image_Board_Top_18.png"),
     KHÔNG qua tên mesh. Chuẩn hoá để khớp khoá trong exhibits.json/admin
     (chỉ giữ chữ–số–gạch dưới): "Image_Board_05.001" -> "Image_Board_05_001". */
  function boardKey(name) {
    return String(name || '').trim().replace(/[^A-Za-z0-9_]+/g, '_');
  }

  /* ----------- Đổ nội dung admin lên các "bảng trưng bày" ----------
     Gom mọi mesh trong scene theo mã bảng (tên material chuẩn hoá). Một
     material có thể dùng cho NHIỀU mesh (bản sao ở 2 sảnh) -> map tới mảng,
     click mesh nào cũng mở đúng popup. Với mỗi mã trong exhibits.json có
     nội dung: nạp tiêu đề/mô tả/link vào userData + (nếu có src) phủ
     ảnh/video lên bề mặt. Bảng rỗng -> bỏ qua (giữ ảnh bake sẵn, không click). */
  async function applyExhibits() {
    let data;
    try {
      const res = await fetch('assets/data/exhibits.json?ts=' + Date.now());
      if (!res.ok) return;                  // chưa có file -> giữ nội dung mặc định
      data = await res.json();
    } catch (e) { return; }
    if (!data || typeof data !== 'object') return;
    const texLoader = new THREE.TextureLoader();
    texLoader.crossOrigin = 'anonymous';

    // Lập bản đồ: mã bảng -> [{mesh, matIndex}] (giữ cả index slot vật liệu)
    const byBoard = new Map();
    scene.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((mm, idx) => {
        if (!mm || !mm.name) return;
        const k = boardKey(mm.name);
        if (!k.startsWith('Image_Board')) return;   // chỉ các bề mặt "bảng"
        let arr = byBoard.get(k);
        if (!arr) { arr = []; byBoard.set(k, arr); }
        // Tránh thêm cùng 1 cặp (mesh, idx) nhiều lần
        if (!arr.find(e => e.mesh === o && e.matIndex === idx)) arr.push({ mesh: o, matIndex: idx });
      });
    });

    for (const [id, info] of Object.entries(data)) {
      if (!info) continue;
      const entries = byBoard.get(boardKey(id));
      if (!entries || !entries.length) continue;        // model không có bảng này -> bỏ qua
      // chỉ "bật click" khi bảng có nội dung thực (tránh hàng chục bảng rỗng cũng mở popup trống)
      if (!(info.title || info.desc || info.link || info.src)) continue;

      // Gom danh sách mesh duy nhất để đặt userData (1 mesh có thể có nhiều slot)
      const meshSet = [];
      for (const { mesh } of entries) {
        if (!meshSet.includes(mesh)) meshSet.push(mesh);
      }
      for (const mesh of meshSet) {
        mesh.userData = Object.assign({}, mesh.userData, {
          title: info.title || id,
          desc: info.desc || '',
          descEn: info.descEn || '',
          link: info.link || '',
          mediaType: info.type || 'image',
          mediaSrc: info.src || '',
          thumb: info.thumb || '',
        });
        if (products.indexOf(mesh) === -1) products.push(mesh);
      }

      if (info.src) applyBoardMedia(entries, info, id, texLoader);
    }
  }

  /* Phủ ảnh/video lên bề mặt tất cả mesh của một bảng (tải texture 1 lần dùng chung).
     * entries = [{mesh, matIndex}] thay vì mảng mesh thô, để gán đúng slot material. */
  function applyBoardMedia(entries, info, id, texLoader) {
    const setAll = (tex) => entries.forEach(({ mesh, matIndex }) => setBoardMap(mesh, matIndex, tex));
    if (info.type === 'video') {
      const yt = youtubeId(info.src);
      if (yt) {
        // YouTube: phủ ảnh thumbnail làm "poster"; video thật phát ở popup khi click
        texLoader.load(
          'https://img.youtube.com/vi/' + yt + '/hqdefault.jpg',
          (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            // GLTF model đã có UV theo chuẩn glTF (gốc dưới-trái) -> KHÔNG lật Y
            tex.flipY = false;
            setAll(tex);  // setBoardMap sẽ tự gọi adjustTextureFit với mỗi mesh
          },
          undefined,
          () => { }   // thumbnail lỗi -> để bảng mặc định, vẫn click mở popup
        );
      } else if (embedUrl(info.src)) {
        /* Vimeo/nền tảng khác: dùng thumbnail nếu có, không thì để bảng mặc định */
        if (info.thumb) {
          texLoader.load(info.thumb,
            (tex) => { tex.colorSpace = THREE.SRGBColorSpace; tex.flipY = false; setAll(tex); },
            undefined, () => { }
          );
        }
      } else {
        // file video trực tiếp (.mp4…) – dùng thumbnail nếu có, fallback VideoTexture
        if (info.thumb) {
          // Có ảnh đại diện: phủ ảnh tĩnh lên bảng, video phát trong popup
          texLoader.load(info.thumb,
            (tex) => { tex.colorSpace = THREE.SRGBColorSpace; tex.flipY = false; setAll(tex); },
            undefined,
            () => {
              // Thumbnail lỗi -> fallback VideoTexture
              entries.forEach(({ mesh, matIndex }) => disposeOldBoardMedia(mesh, matIndex));
              const v = document.createElement('video');
              v.src = info.src; v.loop = true; v.muted = true;
              v.crossOrigin = 'anonymous'; v.playsInline = true;
              v.play().catch(() => { });
              const vt = new THREE.VideoTexture(v);
              vt.colorSpace = THREE.SRGBColorSpace; vt.flipY = false;
              setAll(vt);
            }
          );
        } else {
          // Không có thumbnail -> phát video thẳng lên bề mặt bảng
          entries.forEach(({ mesh, matIndex }) => disposeOldBoardMedia(mesh, matIndex));
          const v = document.createElement('video');
          v.src = info.src; v.loop = true; v.muted = true;
          v.crossOrigin = 'anonymous'; v.playsInline = true;
          v.play().catch(() => { });
          const vt = new THREE.VideoTexture(v);
          vt.colorSpace = THREE.SRGBColorSpace;
          vt.flipY = false;
          setAll(vt);
        }
      }
    } else {
      texLoader.load(
        info.src,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          // GLTF model đã có UV theo chuẩn glTF (gốc dưới-trái) -> KHÔNG lật Y
          // Nếu lật (flipY=true mặc định) + UV GLTF -> ảnh bị ngược
          tex.flipY = false;
          setAll(tex);  // setBoardMap sẽ tự gọi adjustTextureFit với mỗi mesh
        },
        undefined,
        () => console.warn('[museum] không tải được ảnh bảng:', id, info.src)
      );
    }
  }

  /* Điều chỉnh texture để fit vừa khung bảng ("object-fit: contain").
     Tính tỉ lệ thực tế của mesh (qua bounding box) và so sánh với tỉ lệ ảnh.
     Điều chỉnh repeat + offset để ảnh không bị kéo dài và luôn canh giữa. */
  function adjustTextureFit(tex, mesh) {
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;

    const img = tex.image;
    // Nếu chưa có kích thước ảnh (video texture / đang load) -> giữ mặc định
    if (!img || !img.width || !img.height || !mesh) {
      tex.repeat.set(1, 1);
      tex.offset.set(0, 0);
      tex.needsUpdate = true;
      return;
    }

    // Tính tỉ lệ ảnh gốc
    const imgRatio = img.width / img.height;

    // Tính tỉ lệ khung bảng thông qua bounding box của mesh
    const box = new THREE.Box3().setFromObject(mesh);
    const size = new THREE.Vector3();
    box.getSize(size);
    // Board thường nằm trong mặt phẳng XY hoặc XZ:
    // Chọn 2 chiều lớn nhất (bỏ chiều bé nhất = chiều dày tấm bảng)
    const dims = [size.x, size.y, size.z].sort((a, b) => b - a); // giảm dần
    const boardW = dims[0]; // chiều rộng
    const boardH = dims[1]; // chiều cao
    if (!boardW || !boardH) {
      tex.repeat.set(1, 1); tex.offset.set(0, 0); tex.needsUpdate = true; return;
    }
    const boardRatio = boardW / boardH;

    // So sánh tỉ lệ ảnh với tỉ lệ khung: điều chỉnh repeat để "contain"
    // (giữ nguyên tỉ lệ ảnh gốc, thêm lề trắng 2 bên nếu cần)
    let repeatX = 1, repeatY = 1, offsetX = 0, offsetY = 0;
    if (imgRatio > boardRatio) {
      // Ảnh rộng hơn khung: thu nhỏ theo chiều Y để vừa chiều X
      repeatY = imgRatio / boardRatio;
      offsetY = (repeatY - 1) / 2;
    } else if (imgRatio < boardRatio) {
      // Ảnh hẹp hơn khung: thu nhỏ theo chiều X để vừa chiều Y
      repeatX = boardRatio / imgRatio;
      offsetX = (repeatX - 1) / 2;
    }
    tex.repeat.set(repeatX, repeatY);
    tex.offset.set(-offsetX, -offsetY);
    tex.needsUpdate = true;
  }

  // Giải phóng texture/video cũ của một board mesh (đúng slot) trước khi gán media mới.
  // Tránh ảnh cũ bị đè nhưng VRAM không được giải phóng (memory leak) và
  // tránh trường hợp texture cũ vẫn hiển thị khi material chưa update kịp.
  function disposeOldBoardMedia(mesh, matIndex) {
    const matArr = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const idx = (matIndex != null) ? matIndex : 0;
    const mat = matArr[idx];
    if (!mat) return;
    // Chỉ dispose texture do chúng ta gắn (đánh dấu bằng _boardTex)
    // để không vô tình xóa texture gốc của model.
    if (mat._boardTex) {
      // Nếu là VideoTexture, dừng video trước khi dispose
      if (mat._boardTex.image && mat._boardTex.image.pause) {
        mat._boardTex.image.pause();
        mat._boardTex.image.src = '';
      }
      mat._boardTex.dispose();
      mat._boardTex = null;
    }
  }

  // Gán texture lên đúng slot material của mesh bảng.
  // Clone material lần đầu (khi chưa có _boardTex) để không ảnh hưởng các mesh
  // khác dùng chung vật liệu; đặt màu trắng để texture hiện đúng màu thật.
  // matIndex: index slot material trong mảng (hoặc undefined/0 nếu material đơn).
  function setBoardMap(mesh, matIndex, tex) {
    const isArr = Array.isArray(mesh.material);
    const idx = (matIndex != null) ? matIndex : 0;
    let mat = isArr ? mesh.material[idx] : mesh.material;
    if (!mat) return;

    // Dispose texture cũ (nếu là texture do chúng ta gắn trước đó), reset về null
    if (mat._boardTex) {
      if (mat._boardTex.image && mat._boardTex.image.pause) {
        mat._boardTex.image.pause();
        mat._boardTex.image.src = '';
      }
      mat._boardTex.dispose();
      mat._boardTex = null;   // QUAN TRỌNG: reset để điều kiện clone bên dưới hoạt động đúng
    }

    // Clone material lần đầu tiên (chưa có _boardTex) để không làm bẩn material gốc
    // của model (tránh ảnh hưởng các mesh khác cùng dùng material đó).
    if (!mat._boardTex) {
      mat = mat.clone();
      // Gán ngay vào mesh TRƯỚC khi set map để Three.js cập nhật đúng
      if (isArr) {
        mesh.material = mesh.material.slice();   // clone mảng để không mutate mảng gốc
        mesh.material[idx] = mat;
      } else {
        mesh.material = mat;
      }
    }

    mat.map = tex;
    // Khi bảng có media từ exhibits.json, tắt ảnh emissive được nhúng sẵn
    // trong GLB. Nếu giữ emissiveMap gốc, ảnh Blender sẽ tiếp tục phát sáng
    // phía sau ảnh mới và tạo cảm giác hai ảnh chồng/mờ lên nhau.
    mat.emissiveMap = null;
    if (mat.emissive) mat.emissive.set(0x000000);
    if ('emissiveIntensity' in mat) mat.emissiveIntensity = 0;
    mat._boardTex = tex;     // đánh dấu để dispose lần sau
    if (mat.color) mat.color.set(0xffffff);
    mat.needsUpdate = true;

    // Căn chỉnh lại texture sau khi gán để fit đúng với khung bảng
    adjustTextureFit(tex, mesh);
  }

  function buildPlaceholderRoom() {
    const S = 20;            // cạnh phòng
    const H = 5;             // chiều cao tường
    const b = S / 2 - 0.8;
    bMinX = bMinZ = -b; bMaxX = bMaxZ = b;

    // Sàn ca-rô
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(S, S),
      new THREE.MeshStandardMaterial({ color: 0xe9ecf2, roughness: 0.95 })
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    const grid = new THREE.GridHelper(S, S, 0xbcc3d0, 0xd2d8e2);
    grid.position.y = 0.01;
    scene.add(grid);

    // Trần
    const ceil = new THREE.Mesh(
      new THREE.PlaneGeometry(S, S),
      new THREE.MeshStandardMaterial({ color: 0xf4f5f8, roughness: 1 })
    );
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = H;
    scene.add(ceil);

    // 4 bức tường
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xf7f8fb, roughness: 1, side: THREE.DoubleSide });
    const wallGeo = new THREE.PlaneGeometry(S, H);
    const defs = [
      [0, H / 2, -S / 2, 0],
      [0, H / 2, S / 2, Math.PI],
      [-S / 2, H / 2, 0, Math.PI / 2],
      [S / 2, H / 2, 0, -Math.PI / 2],
    ];
    for (const [x, y, z, ry] of defs) {
      const w = new THREE.Mesh(wallGeo, wallMat);
      w.position.set(x, y, z);
      w.rotation.y = ry;
      scene.add(w);
    }

    // Các "tác phẩm" treo tường + bục tượng – mỗi cái click được
    const palette = [0xdd421d, 0x004ed8, 0x02af7f, 0xffaa01, 0x8b5cf6, 0xef476f];
    const sampleInfo = [
      ['Tác phẩm đồ họa 2D/3D', 'Sản phẩm tiêu biểu của sinh viên Thiết kế đa phương tiện.'],
      ['Dự án Animation', 'Nghệ thuật diễn hoạt hình ảnh (animation).'],
      ['Ứng dụng AR/VR', 'Phát triển ứng dụng Đa phương tiện trên nền tảng thực tế ảo.'],
      ['Báo chí dữ liệu', 'Data Journalism – sản phẩm Megastory, Podcast.'],
      ['Thiết kế UI/UX', 'Giải pháp thiết kế giao diện, trải nghiệm người dùng.'],
      ['Tác phẩm truyền thông', 'Sản phẩm truyền thông đa phương tiện đa nền tảng.'],
    ];
    const wallZ = S / 2 - 0.15;
    for (let i = 0; i < 6; i++) {
      const onBack = i < 3;
      const idx = i % 3;
      const px = (idx - 1) * 5.5;
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(3, 2, 0.18),
        new THREE.MeshStandardMaterial({ color: palette[i], roughness: 0.5, metalness: 0.1 })
      );
      frame.position.set(onBack ? px : -px, 2.3, onBack ? -wallZ : wallZ);
      if (!onBack) frame.rotation.y = Math.PI;
      // Đặt TÊN bảng = "board_01".."board_06" để khớp với assets/data/exhibits.json
      // (trang admin gắn ảnh/video lên bảng theo đúng tên này). Model thật chỉ cần
      // đặt mesh trùng tên là tự nhận nội dung — xem applyExhibits() bên dưới.
      frame.name = 'board_0' + (i + 1);
      frame.userData = { title: sampleInfo[i][0], desc: sampleInfo[i][1] };
      scene.add(frame);
      products.push(frame);

      // Bục tượng nhỏ trước mỗi tranh
      const ped = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.6, 1, 24),
        new THREE.MeshStandardMaterial({ color: 0xced3dd, roughness: 0.9 })
      );
      ped.position.set(frame.position.x, 0.5, onBack ? -wallZ + 2.2 : wallZ - 2.2);
      scene.add(ped);
      const orb = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.45, 1),
        new THREE.MeshStandardMaterial({ color: palette[i], roughness: 0.3, metalness: 0.2, flatShading: true })
      );
      orb.position.set(ped.position.x, 1.4, ped.position.z);
      orb.userData = { title: sampleInfo[i][0], desc: sampleInfo[i][1] };
      scene.add(orb);
      products.push(orb);
    }

    // Bảng chào ở giữa
    const sign = makeTextSign('BẢO TÀNG SỐ – PHÒNG MẪU (PLACEHOLDER)');
    sign.position.set(0, 3.4, -wallZ + 0.05);
    scene.add(sign);
  }

  function makeTextSign(text) {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#382828'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#ffaa01';
    ctx.font = 'bold 56px "Be Vietnam Pro", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, c.width / 2, c.height / 2);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.Mesh(
      new THREE.PlaneGeometry(8, 1),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true })
    );
  }

  // Đổi vật liệu PBR -> unlit (MeshBasicMaterial), giữ texture màu & độ trong suốt
  function toUnlit(mat) {
    if (!mat) return mat;
    const b = new THREE.MeshBasicMaterial();
    if (mat.map) b.map = mat.map;
    if (mat.color) b.color.copy(mat.color);
    b.vertexColors = !!mat.vertexColors;
    b.transparent = !!mat.transparent;
    b.opacity = mat.opacity != null ? mat.opacity : 1;
    b.alphaTest = mat.alphaTest || 0;
    b.side = mat.side;
    b.name = mat.name;
    return b;
  }

  // Đổi PBR -> Lambert (rẻ hơn Standard nhiều: chỉ tính khuếch tán, bỏ
  // roughness/metalness/IBL) NHƯNG vẫn ăn đèn -> tường/trần sáng lại.
  // Giữ emissive (lớp tự phát sáng đã có sẵn trong model, vd các bảng).
  function toLambert(mat) {
    if (!mat) return mat;
    const m = new THREE.MeshLambertMaterial();
    if (mat.map) m.map = mat.map;
    if (mat.color) m.color.copy(mat.color);
    if (mat.emissive) m.emissive.copy(mat.emissive);
    if (mat.emissiveMap) m.emissiveMap = mat.emissiveMap;
    m.emissiveIntensity = mat.emissiveIntensity != null ? mat.emissiveIntensity : 1;
    if (mat.aoMap) m.aoMap = mat.aoMap;
    m.vertexColors = !!mat.vertexColors;
    m.transparent = !!mat.transparent;
    m.opacity = mat.opacity != null ? mat.opacity : 1;
    m.alphaTest = mat.alphaTest || 0;
    m.side = mat.side;
    m.name = mat.name;
    return m;
  }

  // Thu nhỏ texture quá lớn -> nhẹ VRAM, giảm lag (giữ nguyên thiết lập của texture)
  function downscaleTexture(tex, maxSize, cache) {
    if (!tex || !tex.image) return;
    const img = tex.image;
    if (cache.has(img)) { tex.image = cache.get(img); tex.needsUpdate = true; return; }
    const w = img.width, h = img.height;
    if (!w || !h || Math.max(w, h) <= maxSize) return;
    const s = maxSize / Math.max(w, h);
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(w * s));
    cv.height = Math.max(1, Math.round(h * s));
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    cache.set(img, cv);
    tex.image = cv;
    tex.needsUpdate = true;
  }

  // Texture đốm sáng tròn (tâm sáng -> rìa trong suốt) dùng chung cho mọi pool.
  // (biến cache _poolTex khai báo ở đầu initMuseum để tránh TDZ khi loadModel
  //  chạy sớm hơn vị trí hàm này trong file.)
  function poolTexture() {
    if (_poolTex) return _poolTex;
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0.0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.45, 'rgba(255,255,255,0.4)');
    grd.addColorStop(1.0, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    _poolTex = new THREE.CanvasTexture(c);
    _poolTex.colorSpace = THREE.SRGBColorSpace;
    return _poolTex;
  }

  /* "Pool sáng" giả: với mỗi đèn spot gốc, chiếu trục đèn xuống sàn rồi đặt một
     đĩa sáng (additive) tại điểm chạm -> tái hiện vệt spotlight của Blender mà
     KHÔNG cần đèn thật (chỉ là quad trong suốt, gần như miễn phí). */
  function addSpotPools(spots, floorY) {
    const tex = poolTexture();
    const P = new THREE.Vector3(), T = new THREE.Vector3(), dir = new THREE.Vector3();
    const strength = CFG.spotPoolStrength ?? 0.55;
    for (const s of spots) {
      s.getWorldPosition(P);
      // hướng chiếu: tới target nếu có, mặc định thẳng xuống (đèn trần)
      if (s.target) { s.target.getWorldPosition(T); dir.copy(T).sub(P); }
      else dir.set(0, -1, 0);
      if (dir.lengthSq() < 1e-6 || dir.y > -1e-3) dir.set(0, -1, 0);  // chỉ nhận đèn chiếu xuống
      dir.normalize();
      const t = (floorY - P.y) / dir.y;            // quãng đường tới sàn dọc trục
      if (!(t > 0) || t > 200) continue;
      const hx = P.x + dir.x * t, hz = P.z + dir.z * t;
      const ang = s.angle || THREE.MathUtils.degToRad(30);
      const r = Math.max(0.6, Math.min(t * Math.tan(ang) * 1.2, 9));   // bán kính pool
      const mat = new THREE.MeshBasicMaterial({
        map: tex, transparent: true, blending: THREE.AdditiveBlending,
        depthWrite: false, opacity: strength, toneMapped: false,
      });
      // màu ấm của đèn (chuẩn hoá về <=1 vì màu gốc là HDR cường độ cao)
      if (s.color) { const m = Math.max(s.color.r, s.color.g, s.color.b, 1); mat.color.setRGB(s.color.r / m, s.color.g / m, s.color.b / m); }
      const disc = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), mat);
      disc.rotation.x = -Math.PI / 2;
      disc.position.set(hx, floorY + 0.02, hz);
      disc.renderOrder = 2;
      scene.add(disc);
    }
  }

  function loadModel(url) {
    return new Promise((resolve) => {
      new GLTFLoader().load(
        url,
        (gltf) => {
          const root = gltf.scene;
          root.scale.setScalar(CFG.modelScale ?? 1);
          root.position.y += CFG.modelYOffset ?? 0;
          scene.add(root);
          root.updateWorldMatrix(true, true);
          // Tối ưu: CHỈ mesh có gắn thông tin (userData.title) mới là "sản phẩm" click
          // xem được -> tránh raycast toàn bộ model (gây lag) + để vòng hover hiện đúng.
          // Đồng thời gán độ mạnh ánh sáng và thu nhỏ texture quá lớn.
          const envI = CFG.envIntensity ?? 1;
          const maxTex = CFG.maxTextureSize ?? 0;
          // Nâng sáng nhẹ: nhân màu vật liệu (>1 = sáng hơn). Chạy 1 lần lúc nạp.
          const brightness = CFG.modelBrightness ?? 1;
          const texCache = new Map();

          // Hộp bao thật của model (dùng cho cả pool sáng lẫn vùng đi lại).
          const box = new THREE.Box3().setFromObject(root);

          // Đèn gốc trong model = 27 spotlight Blender. Bật đèn THẬT (useModelLights)
          // rất nặng (shader nhiều đèn -> đơ máy). Mặc định: tạo "pool sáng" giả rẻ
          // tiền từ vị trí các spot rồi GỠ đèn thật đi.
          const spots = [];
          root.traverse((o) => { if (o.isSpotLight) spots.push(o); });
          // Đặt pool ở MẶT SÀN người đi (mặc định y=0 = mặt phẳng click-to-move),
          // KHÔNG dùng box.min.y vì đáy model thấp hơn sàn (móng/nền ngoài ~ -2.6m)
          // -> trước đây pool bị chìm dưới sàn nên "chiếu xuống đâu đó".
          if ((CFG.spotPools ?? true) && spots.length) addSpotPools(spots, CFG.spotPoolFloorY ?? 0);
          if (!CFG.useModelLights) {
            const lights = [];
            root.traverse((o) => { if (o.isLight) lights.push(o); });
            lights.forEach((l) => l.removeFromParent());
          }

          root.traverse((o) => {
            if (!o.isMesh) return;
            if (o.userData && o.userData.title) products.push(o);
            // Đổi vật liệu theo chế độ ánh sáng:
            //   unlit      -> MeshBasicMaterial (không đèn, rẻ nhất, cần model đã bake)
            //   lit        -> MeshLambertMaterial (ăn đèn nhưng rẻ, giữ emissive)
            //   hdri / sky -> giữ MeshStandardMaterial (PBR đầy đủ, ăn IBL/HDRI)
            if (MODE === 'unlit') o.material = Array.isArray(o.material) ? o.material.map(toUnlit) : toUnlit(o.material);
            else if (MODE === 'lit') o.material = Array.isArray(o.material) ? o.material.map(toLambert) : toLambert(o.material);
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            for (const mm of mats) {
              if (!mm) continue;
              // Tinh chỉnh sáng tổng thể (1 lần lúc nạp -> không tốn FPS mỗi khung).
              if (brightness !== 1 && mm.color) mm.color.multiplyScalar(brightness);
              if ((MODE === 'sky' || MODE === 'hdri') && 'envMapIntensity' in mm) { mm.envMapIntensity = envI; mm.needsUpdate = true; }
              if (maxTex > 0)
                for (const slot of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap'])
                  downscaleTexture(mm[slot], maxTex, texCache);
            }
          });
          // vùng đi lại bám đúng hộp bao thật của model (chừa 0.8m để khỏi xuyên tường)
          const m = 0.8;
          bMinX = box.min.x + m; bMaxX = box.max.x - m;
          bMinZ = box.min.z + m; bMaxZ = box.max.z - m;
          resolve();
        },
        undefined,
        (err) => { console.error('[museum] không tải được model:', err); buildPlaceholderRoom(); resolve(); }
      );
    });
  }

  /* --------------- Chỉ báo điều hướng (hover + đích) --------------
     depthTest:false + renderOrder cao => vòng tròn LUÔN hiện trên sàn,
     không bị mesh sàn của model che mất (đây là lỗi không thấy vòng cũ). */
  const hoverMarker = new THREE.Mesh(
    new THREE.RingGeometry(0.34, 0.5, 48),
    new THREE.MeshBasicMaterial({ color: 0x49d4ff, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthTest: false, depthWrite: false })
  );
  hoverMarker.rotation.x = -Math.PI / 2;
  hoverMarker.renderOrder = 999;
  hoverMarker.visible = false;
  scene.add(hoverMarker);

  // Đích đã click: vòng tròn cố định + mũi tên nhún (thu nhỏ dần khi tới gần)
  const targetMark = new THREE.Group();
  const targetRing = new THREE.Mesh(
    new THREE.RingGeometry(0.34, 0.52, 48),
    new THREE.MeshBasicMaterial({ color: 0xffaa01, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthTest: false, depthWrite: false })
  );
  targetRing.rotation.x = -Math.PI / 2;
  targetRing.renderOrder = 999;
  const targetArrow = new THREE.Mesh(
    new THREE.ConeGeometry(0.18, 0.42, 4),
    new THREE.MeshBasicMaterial({ color: 0xffaa01, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false })
  );
  targetArrow.renderOrder = 999;
  targetArrow.rotation.x = Math.PI;        // chóp quay xuống, chỉ vào điểm đích
  targetArrow.rotation.y = Math.PI / 4;    // xoay 45° cho cân
  targetArrow.position.y = 0.95;
  targetMark.add(targetRing, targetArrow);
  targetMark.visible = false;
  scene.add(targetMark);

  /* --------------------------- Điều khiển ------------------------- */
  // hướng nhìn ban đầu (độ -> radian); mặc định Math.PI = 180° (quay vào phòng)
  let yaw = (CFG.spawnYawDeg != null ? CFG.spawnYawDeg * Math.PI / 180 : Math.PI), pitch = 0;
  const keys = {};
  let moveTarget = null;            // điểm click-to-move
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  // chuột: phân biệt "kéo để xoay" và "click"
  let dragging = false, dragMoved = false, downX = 0, downY = 0, lastX = 0, lastY = 0;
  const SENS = 0.0026;
  const el = renderer.domElement;

  el.addEventListener('mousedown', (e) => {
    dragging = true; dragMoved = false;
    downX = lastX = e.clientX; downY = lastY = e.clientY;
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    if (Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) > 4) dragMoved = true;
    yaw -= dx * SENS;
    pitch = clamp(pitch - dy * SENS, -1.2, 1.2);
  });
  window.addEventListener('mouseup', (e) => {
    if (dragging && !dragMoved) handleClick(e.clientX, e.clientY);
    dragging = false;
  });
  el.addEventListener('mousemove', (e) => {
    if (dragging) { hoverMarker.visible = false; return; }
    updateHover(e.clientX, e.clientY);
  });
  el.addEventListener('mouseleave', () => { hoverMarker.visible = false; el.style.cursor = ''; });

  // Cảm ứng (điện thoại / tablet): 1 ngón kéo để xoay, chạm để di chuyển
  el.addEventListener('touchstart', (e) => {
    const t = e.touches[0]; dragging = true; dragMoved = false;
    downX = lastX = t.clientX; downY = lastY = t.clientY;
  }, { passive: true });
  el.addEventListener('touchmove', (e) => {
    const t = e.touches[0]; const dx = t.clientX - lastX, dy = t.clientY - lastY;
    lastX = t.clientX; lastY = t.clientY;
    if (Math.abs(t.clientX - downX) + Math.abs(t.clientY - downY) > 6) dragMoved = true;
    yaw -= dx * SENS; pitch = clamp(pitch - dy * SENS, -1.2, 1.2);
  }, { passive: true });
  el.addEventListener('touchend', (e) => {
    if (dragging && !dragMoved) {
      const t = e.changedTouches[0]; handleClick(t.clientX, t.clientY);
    }
    dragging = false;
  });

  window.addEventListener('keydown', (e) => onKey(e, true));
  window.addEventListener('keyup', (e) => onKey(e, false));
  function onKey(e, down) {
    const k = e.key.toLowerCase();
    if (k === 'shift') { keys.sprint = down; return; }
    const map = {
      w: 'f', arrowup: 'f', s: 'b', arrowdown: 'b',
      a: 'l', arrowleft: 'l', d: 'r', arrowright: 'r',
    };
    if (map[k]) { keys[map[k]] = down; if (down) moveTarget = null; e.preventDefault(); }
  }

  function handleClick(clientX, clientY) {
    const r = el.getBoundingClientRect();
    ndc.x = ((clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);

    // 1) thử trúng sản phẩm
    const hitP = raycaster.intersectObjects(products, true)[0];
    if (hitP) {
      let o = hitP.object;
      while (o && !o.userData?.title) o = o.parent;
      if (o && o.userData?.title) { openProduct(o.userData); return; }
    }
    // 2) trúng sàn -> di chuyển tới đó (đặt vòng tròn đích cố định)
    const hitF = raycaster.intersectObject(floorHitPlane)[0];
    if (hitF) {
      moveTarget = hitF.point.clone();
      targetMark.position.copy(moveTarget); targetMark.position.y = 0.02;
      targetMark.visible = true;
      hoverMarker.visible = false;
    }
  }

  // Rê chuột trên sàn -> hiện vòng "hover"; trỏ vào sản phẩm -> con trỏ tay
  function updateHover(clientX, clientY) {
    const r = el.getBoundingClientRect();
    ndc.x = ((clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    if (raycaster.intersectObjects(products, true)[0]) {
      el.style.cursor = 'pointer'; hoverMarker.visible = false; return;
    }
    el.style.cursor = '';
    const hitF = raycaster.intersectObject(floorHitPlane)[0];
    if (hitF) { hoverMarker.position.copy(hitF.point); hoverMarker.position.y = 0.015; hoverMarker.visible = true; }
    else hoverMarker.visible = false;
  }

  /* ----------------------- Bảng thông tin SP ---------------------- */


  let _panelLang = 'vi';  // ngôn ngữ panel hiện tại
  let _curProduct = null; // dữ liệu sản phẩm đang hiển thị

  const PANEL_LABELS = {
    vi: { product: 'Sản phẩm', description: 'Mô tả', detail: 'Xem chi tiết →' },
    en: { product: 'Product',  description: 'Description', detail: 'View Details →' },
  };

  function applyPanelLang(lang) {
    _panelLang = lang;
    const d = _curProduct || {};
    const L = PANEL_LABELS[lang] || PANEL_LABELS.vi;

    // Nút toggle active
    productPanel.querySelectorAll('.pp-lang-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.lang === lang);
    });

    // Cập nhật tất cả label (data-vi = key nhận dạng)
    productPanel.querySelectorAll('[data-vi]').forEach(el => {
      const isProduct = el.dataset.vi === 'Sản phẩm';
      el.textContent = isProduct ? L.product : L.description;
    });

    // Nội dung tiêu đề + mô tả
    const titleEl = productPanel.querySelector('#product-title');
    const descEl  = productPanel.querySelector('#product-desc');
    if (titleEl) titleEl.textContent = d.title || L.product;
    if (descEl)  descEl.textContent  = lang === 'en' ? (d.descEn || d.desc || '') : (d.desc || '');

    // Link text
    const link = productPanel.querySelector('#product-link');
    if (link && !link.hidden) link.textContent = L.detail;
  }

  function openProduct(d) {
    d = d || {};
    _curProduct = d;
    _panelLang  = 'vi';  // reset về VN khi mở popup mới

    // Media: ảnh hoặc video
    const media = productPanel.querySelector('#product-media');
    if (media) {
      media.innerHTML = '';
      if (d.mediaSrc) {
        let node;
        const emb = (d.mediaType === 'video') ? embedUrl(d.mediaSrc) : null;
        if (emb) {
          node = document.createElement('iframe');
          node.src = emb;
          node.setAttribute('allow', 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture');
          node.setAttribute('allowfullscreen', '');
          node.setAttribute('loading', 'lazy');
        } else if (d.mediaType === 'video') {
          node = document.createElement('video');
          node.src = d.mediaSrc; node.controls = true; node.loop = true;
          node.muted = true; node.playsInline = true;
          if (d.thumb) node.poster = d.thumb; // ảnh poster tránh màn đen
        } else {
          node = document.createElement('img');
          node.src = d.mediaSrc; node.alt = d.title || '';
        }
        media.appendChild(node);
        media.hidden = false;
      } else {
        media.hidden = true;
      }
    }

    // Link "Xem chi tiết"
    const link = productPanel.querySelector('#product-link');
    if (link) {
      if (d.link) { link.href = d.link; link.hidden = false; }
      else { link.removeAttribute('href'); link.hidden = true; }
    }

    // Hiện/ẩn nút toggle ngôn ngữ (chỉ hiện khi có descEn)
    const toggle = productPanel.querySelector('#pp-lang-toggle');
    if (toggle) toggle.style.display = d.descEn ? '' : 'none';

    // Áp dụng ngôn ngữ VN
    applyPanelLang('vi');

    productPanel.classList.add('is-open');
    productPanel.setAttribute('aria-hidden', 'false');
    audio.popup();
    audio.duck();
  }

  // Nút đóng panel
  productPanel.querySelector('.product-panel__close')
    .addEventListener('click', () => {
      productPanel.classList.remove('is-open');
      audio.unduck();
    });

  // Nút toggle ngôn ngữ VN/EN
  const _langToggle = productPanel.querySelector('#pp-lang-toggle');
  if (_langToggle) {
    _langToggle.addEventListener('click', (e) => {
      const btn = e.target.closest('.pp-lang-btn');
      if (btn) applyPanelLang(btn.dataset.lang);
    });
  }

  /* ------------- Dev HUD: lấy toạ độ điểm xuất phát --------------- */
  let hud = null;
  function yawDegNow() { return Math.round(((yaw * 180 / Math.PI) % 360 + 360) % 360); }
  function spawnSnippet() {
    return 'spawnX: ' + player.position.x.toFixed(2) +
      ',  spawnZ: ' + player.position.z.toFixed(2) +
      ',  spawnYawDeg: ' + yawDegNow() + ',';
  }
  if (CFG.devHud) {
    hud = document.createElement('div');
    hud.style.cssText =
      'position:absolute;left:14px;bottom:14px;z-index:30;padding:10px 13px;' +
      'background:rgba(17,19,26,.85);color:#ffd479;font:13px/1.55 ui-monospace,Consolas,monospace;' +
      'border:1px solid rgba(255,170,1,.4);border-radius:9px;white-space:pre;pointer-events:none;' +
      'box-shadow:0 6px 20px rgba(0,0,0,.45)';
    mount.appendChild(hud);
    window.addEventListener('keydown', (e) => {
      if (!hud || e.key.toLowerCase() !== 'c') return;
      if (navigator.clipboard) navigator.clipboard.writeText(spawnSnippet()).catch(() => { });
      hud.dataset.copied = '1';
      setTimeout(() => { if (hud) hud.dataset.copied = ''; }, 1200);
    });
  }
  function updateHud() {
    hud.textContent =
      'ĐIỂM XUẤT PHÁT (dev)\n' +
      'spawnX:      ' + player.position.x.toFixed(2) + '\n' +
      'spawnZ:      ' + player.position.z.toFixed(2) + '\n' +
      'spawnYawDeg: ' + yawDegNow() + '\n' +
      'tầm mắt Y≈   ' + (player.position.y + EYE).toFixed(2) + '\n' +
      (hud.dataset.copied ? '✓ Đã copy vào clipboard!' : 'Bấm  C  để copy 3 số trên');
  }

  /* ----------------------- Vòng lặp render ------------------------ */
  const clock = new THREE.Clock();
  const fwd = new THREE.Vector3(), right = new THREE.Vector3();

  // Bộ đếm FPS (bật bằng config.showFps) để đo độ mượt
  let fpsEl = null, fpsAcc = 0, fpsFrames = 0;
  if (CFG.showFps) {
    fpsEl = document.createElement('div');
    fpsEl.style.cssText = 'position:absolute;right:12px;top:12px;z-index:30;padding:6px 10px;' +
      'background:rgba(17,19,26,.8);color:#8cff66;font:13px ui-monospace,Consolas,monospace;' +
      'border-radius:6px;pointer-events:none';
    mount.appendChild(fpsEl);
  }

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);

    player.rotation.y = yaw;
    camera.rotation.x = pitch;

    // hướng đi dựa trên góc nhìn thực tế (phẳng theo mặt sàn)
    camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
    right.crossVectors(fwd, camera.up).normalize();

    let mx = 0, mz = 0;
    if (keys.f) mz += 1; if (keys.b) mz -= 1;
    if (keys.r) mx += 1; if (keys.l) mx -= 1;
    if (mx || mz) {
      const step = SPEED * (keys.sprint ? SPRINT : 1) * dt;
      player.position.addScaledVector(fwd, mz * step);
      player.position.addScaledVector(right, mx * step);
    }

    // click-to-move: tiến dần tới điểm đã click
    if (moveTarget) {
      const d = new THREE.Vector3(moveTarget.x - player.position.x, 0, moveTarget.z - player.position.z);
      const dist = d.length();
      const s = clamp(dist / 5, 0.4, 1.4);               // đích thu nhỏ dần khi tới gần
      targetMark.scale.setScalar(s);
      targetArrow.position.y = 0.95 * s + Math.sin(performance.now() * 0.006) * 0.08; // mũi tên nhún
      if (dist < 0.15) { moveTarget = null; targetMark.visible = false; }
      else { d.normalize(); player.position.addScaledVector(d, Math.min(SPEED * (keys.sprint ? SPRINT : 1) * dt, dist)); }
    }

    // giữ trong vùng phòng
    player.position.x = clamp(player.position.x, bMinX, bMaxX);
    player.position.z = clamp(player.position.z, bMinZ, bMaxZ);

    if (hud) updateHud();
    if (fpsEl) { fpsAcc += dt; fpsFrames++; if (fpsAcc >= 0.5) { fpsEl.textContent = Math.round(fpsFrames / fpsAcc) + ' FPS'; fpsAcc = 0; fpsFrames = 0; } }
    renderer.render(scene, camera);
  }

  /* --------------------------- Resize ----------------------------- */
  function resize() {
    const w = mount.clientWidth || window.innerWidth;
    const h = mount.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  // Bảng hướng dẫn luôn hiển thị rõ (không tự mờ).

  if (loadingEl) loadingEl.style.display = 'none';

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* ------------------------- API trả về --------------------------- */
  return {
    resume() { resize(); renderer.setAnimationLoop(frame); audio.start(); },
    pause() { renderer.setAnimationLoop(null); audio.stop(); },
  };
}
