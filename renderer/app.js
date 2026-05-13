let selectedImage = null;
let selectedVideo = null;
let config = null;

const $ = (id) => document.getElementById(id);
function log(msg) { $('log').textContent = `[${new Date().toLocaleTimeString()}] ${msg}\n` + $('log').textContent; }
function geminiText(data) { return data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('\n') || ''; }

async function loadConfig() {
  config = await window.api.getConfig();
  $('baseUrl').value = config.baseUrl;
  $('apiKey').value = config.apiKey;
  $('model').value = config.model || 'gemini-2.5-flash';
}

async function saveConfig() {
  config = { baseUrl: $('baseUrl').value.trim(), apiKey: $('apiKey').value.trim(), model: $('model').value };
  await window.api.setConfig(config);
  log('Đã lưu cấu hình API.');
}

async function pickImage() {
  selectedImage = await window.api.readImage();
  $('imageInfo').textContent = selectedImage ? `Đã chọn: ${selectedImage.filePath}` : 'Chưa chọn ảnh.';
}

async function analyzeCharacter() {
  await saveConfig();
  if (!selectedImage) {
    alert('Vui lòng chọn ảnh nhân vật trước.');
    return;
  }
  const name = $('charName').value.trim() || 'Character';
  const notes = $('manualNotes').value.trim();
  log(`Đang phân tích nhân vật ${name} bằng ${config.model}...`);
  
  try {
    const body = {
      contents: [{
        parts: [
          { text: `Analyze this reference image and create a strict reusable CHARACTER LOCK PROFILE for image/video prompts. Character name: ${name}. Extra notes: ${notes || 'none'}. Output in English. Include: facial identity, hair, body, outfit, colors, unique marks, style lock, do-not-change rules, negative prompt. Be concise but highly specific. State that future prompts must preserve the same identity, same face, same proportions, same outfit unless explicitly changed.` },
          { inlineData: { mimeType: selectedImage.mime, data: selectedImage.base64 } }
        ]
      }]
    };
    const res = await window.api.geminiGenerate({ config, model: config.model, body });
    if (!res.ok) { 
      log('Lỗi phân tích: ' + (typeof res.error === 'object' ? JSON.stringify(res.error) : res.error)); 
      return; 
    }
    const text = geminiText(res.data);
    if (!text) {
        log('Lỗi: AI không trả về dữ liệu phân tích.');
        return;
    }
    $('profile').value = text;
    log('Đã tạo Character Profile thành công.');
  } catch (err) {
    log('Lỗi hệ thống: ' + err.message);
  }
}

async function generatePrompts() {
  await saveConfig();
  const profile = $('profile').value.trim();
  const analysis = $('videoAnalysis').value.trim();
  const scenes = $('scenes').value.split('\n').map(s => s.trim()).filter(Boolean);
  if (!profile) return alert('Cần Character Profile trước.');
  if (!scenes.length) return alert('Nhập ít nhất 1 cảnh.');
  log(`Đang tạo ${scenes.length} prompt đồng nhất nhân vật...`);
  const body = {
    contents: [{ role: 'user', parts: [{ text: `You are a cinematic AI prompt engineer. Use the locked character profile below to create consistent prompts for image/video generation. Requirements: preserve character identity as close as possible, same face, same proportions, same key outfit/details, no unintended changes. For each scene, output numbered prompts only. Each prompt must include: character lock, scene action, camera, lighting, mood, quality tags, negative prompt.\n\nCHARACTER LOCK PROFILE:\n${profile}\n\nVIDEO/SCRIPT STYLE ANALYSIS:\n${analysis}\n\nSCENES:\n${scenes.map((s,i)=>`${i+1}. ${s}`).join('\n')}` }] }]
  };
  const res = await window.api.geminiGenerate({ config, model: config.model, body });
  if (!res.ok) { log('Lỗi tạo prompt: ' + JSON.stringify(res.error)); return; }
  $('output').value = geminiText(res.data);
  log('Đã tạo prompt hàng loạt.');
}

async function savePrompts() {
  const text = $('output').value.trim();
  if (!text) return alert('Chưa có prompt để lưu.');
  const filePath = await window.api.saveText({ filename: `character_prompts_${Date.now()}.txt`, text });
  log(`Đã lưu: ${filePath}`);
}

$('saveConfigBtn').onclick = saveConfig;
$('pickImageBtn').onclick = pickImage;
$('analyzeBtn').onclick = analyzeCharacter;
$('generatePromptsBtn').onclick = generatePrompts;
$('savePromptsBtn').onclick = savePrompts;
$('copyProfileBtn').onclick = async () => { await navigator.clipboard.writeText($('profile').value); log('Đã copy profile.'); };

async function pickVideo() {
  selectedVideo = await window.api.readVideo();
  if (selectedVideo?.error) { alert(selectedVideo.error); selectedVideo = null; return; }
  $('videoInfo').textContent = selectedVideo ? `Đã chọn: ${selectedVideo.filePath} (${Math.round(selectedVideo.size/1024/1024)}MB)` : 'Chưa chọn video.';
}

async function analyzeScript() {
  await saveConfig();
  const scriptText = $('scriptInput').value.trim();
  if (!scriptText && !selectedVideo) return alert('Dán kịch bản hoặc chọn video mẫu.');
  log(`Đang phân tích kịch bản/video...`);
  
  let parts = [{ text: `Analyze the following video/script to extract: 1. Core theme/story. 2. List of visual scenes/actions. 3. Camera angles & lighting style. 4. Pacing. Provide a summary suitable for recreating this style with a consistent character. Script/Description: ${scriptText || 'none'}` }];
  if (selectedVideo) {
    parts.push({ inlineData: { mimeType: selectedVideo.mime, data: selectedVideo.base64 } });
  }

  const res = await window.api.geminiGenerate({ config, model: 'gemini-1.5-pro', body: { contents: [{ parts }] } });
  if (!res.ok) { log('Lỗi phân tích video: ' + JSON.stringify(res.error)); return; }
  const analysis = geminiText(res.data);
  $('videoAnalysis').value = analysis;
  
  // Tự động gợi ý scenes nếu chưa có
  if (!$('scenes').value.trim()) {
    log('Đang gợi ý scenes từ kịch bản...');
    const suggestRes = await window.api.geminiGenerate({ config, body: { contents: [{ parts: [{ text: `Extract only a list of visual scenes (one per line) from this analysis for image/video generation: ${analysis}` }] }] } });
    if (suggestRes.ok) $('scenes').value = geminiText(suggestRes.data);
  }
  log('Đã phân tích xong.');
}

$('pickVideoBtn').onclick = pickVideo;
$('analyzeScriptBtn').onclick = analyzeScript;
loadConfig();
