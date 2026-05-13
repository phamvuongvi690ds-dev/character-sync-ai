# CharacterSync AI

Desktop app chạy trên macOS và Windows bằng Electron.

## Tính năng

- Upload ảnh nhân vật.
- Chọn 1 trong 2 model Gemini:
  - `gemini-2.5-flash`
  - `gemini-2.5-pro`
- Phân tích ảnh thành **Character Lock Profile**.
- Tạo prompt hàng loạt để giữ đồng nhất nhân vật.
- Lưu prompt ra file `.txt` trong thư mục Downloads/CharacterSyncAI.

> Lưu ý: AI không thể đảm bảo giống 100% tuyệt đối. Tool này tối ưu prompt để giữ nhân vật nhất quán nhất có thể.

## Cấu hình mặc định

```text
Base URL: http://93.127.141.198:8000
Model: gemini-2.5-flash
```

API Key được lưu local bằng `electron-store`.

## Chạy dev

```bash
npm install
npm start
```

## Build

```bash
npm run dist
```

Kết quả nằm trong thư mục `dist/`.

## Workflow

### 1) Analyze character image
Upload reference image, choose Gemini model, then click **Phân tích & khóa nhân vật**.

### 2) Analyze script or existing video
Paste a script/transcript/outline or upload a short video clip under 18MB, then click **Phân tích kịch bản/video**.
The app will create a reusable analysis and can auto-suggest scene lines.

### 3) Generate consistent prompts
The app combines:

```text
Character Lock Profile + Video/Script Analysis + Scene List
```

and outputs batch prompts with character consistency, camera, lighting, mood, quality tags, and negative prompt.

## GitHub build targets

Build on Windows:

```bash
npm install
npm run dist
```

Build on macOS:

```bash
npm install
npm run dist
```

