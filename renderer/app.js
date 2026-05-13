let selectedImage = null;
let selectedVideo = null;
let config = null;
let savedCharacters = [];

const $ = (id) => document.getElementById(id);
function log(msg) { $('log').textContent = `[${new Date().toLocaleTimeString()}] ${msg}\n` + $('log').textContent; }
function geminiText(data) { return data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('\n') || ''; }

function updateCharacterList() {
  const container = $('characterList');
  container.innerHTML = '';
  savedCharacters.forEach((char, index) => {
    const btn = document.createElement('button');
    btn.className = 'char-btn';
    btn.innerText = char.name;
    btn.onclick = () => {
      $('profile').value = char.profile;
      $('charName').value = char.name;
      log(`Đã chọn nhân vật: ${char.name}`);
    };
    container.appendChild(btn);
  });
}

async function loadConfig() {
  config = await window.api.getConfig();
  $('baseUrl').value = "https://answers-name-theology-ruling.trycloudflare.com"; // Set new default
  $('apiKey').value = config.apiKey;
  $('model').value = config.model || 'gemini-2.5-flash';
  // Load saved characters from config if exists
  savedCharacters = config.savedCharacters || [];
  updateCharacterList();
}

async function saveConfig() {
  config = { 
    baseUrl: $('baseUrl').value.trim(), 
    apiKey: $('apiKey').value.trim(), 
    model: $('model').value,
    savedCharacters: savedCharacters
  };
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
    
    // Lưu nhân vật vào danh sách
    savedCharacters.push({ name: name, profile: text });
    updateCharacterList();
    await saveConfig();
    
    log('Đã tạo Character Profile thành công và lưu vào danh sách.');
  } catch (err) {
    log('Lỗi hệ thống: ' + err.message);
  }
}

async function generatePrompts() {
  await saveConfig();
  const profile = $('profile').value.trim();
  const analysis = $('videoAnalysis').value.trim();
  const scenes = $('scenes').value.split('\n').map(s => s.trim()).filter(Boolean);
  const duration = $('durationVal').value || 8;
  const unit = $('durationUnit').value;

  if (!profile) return alert('Cần Character Profile trước.');
  if (!scenes.length) return alert('Nhập ít nhất 1 cảnh.');
  log(`Đang tạo ${scenes.length} prompt đồng nhất nhân vật (Thời lượng: ${duration} ${unit}/prompt)...`);
  
  const body = {
    contents: [{ role: 'user', parts: [{ text: `You are a cinematic AI prompt engineer. Use the locked character profile below to create consistent prompts for image/video generation. 

Requirements: 
- Preserve character identity as close as possible, same face, same proportions, same key outfit/details.
- IMPORTANT: Each generated prompt is for a video clip of EXACTLY ${duration} ${unit}. Ensure the action described fits this duration.
- For each scene, output numbered prompts only. 
- Each prompt must include: character lock, scene action, camera, lighting, mood, duration tag [Duration: ${duration} ${unit}], quality tags, negative prompt.

CHARACTER LOCK PROFILE:
${profile}

VIDEO/SCRIPT STYLE ANALYSIS:
${analysis}

SCENES:
${scenes.map((s,i)=>`${i+1}. ${s}`).join('\n')}` }] }]
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

$('saveConfigBtn') && ($('saveConfigBtn').onclick = saveConfig);
$('pickImageBtn') && ($('pickImageBtn').onclick = pickImage);
$('analyzeBtn') && ($('analyzeBtn').onclick = analyzeCharacter);
$('generatePromptsBtn') && ($('generatePromptsBtn').onclick = generatePrompts);
$('savePromptsBtn') && ($('savePromptsBtn').onclick = savePrompts);
if ($('copyProfileBtn')) $('copyProfileBtn').onclick = async () => { await navigator.clipboard.writeText($('profile').value); log('Đã copy profile.'); };

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

$('pickVideoBtn') && ($('pickVideoBtn').onclick = pickVideo);
$('analyzeScriptBtn') && ($('analyzeScriptBtn').onclick = analyzeScript);
async function writeAIScript() {
  await saveConfig();
  const topic = $('aiStoryTopic').value.trim();
  const duration = $('totalDurationVal').value || 1;
  const unit = $('totalDurationUnit').value;
  const profile = $('profile').value.trim();

  if (!topic) return alert('Nhập chủ đề muốn viết kịch bản.');
  log(`Đang yêu cầu AI viết kịch bản video ${duration} ${unit}...`);

  const body = {
    contents: [{
      parts: [{
        text: `You are a professional video script writer. Write a detailed cinematic script based on the following topic and character profile.
Topic: ${topic}
Target Duration: ${duration} ${unit}
Character Profile: ${profile || 'Standard cinematic character'}

Requirements:
1. Break the story into a sequence of specific visual scenes.
2. For each scene, describe action, camera angle, and mood.
3. Ensure the total duration of all scenes adds up to approximately ${duration} ${unit}.
4. Provide a numbered list of scenes at the end, one scene per line, suitable for image/video generation prompts.`
      }]
    }]
  };

  const res = await window.api.geminiGenerate({ config, model: 'gemini-1.5-pro', body });
  if (!res.ok) { log('Lỗi viết kịch bản: ' + JSON.stringify(res.error)); return; }
  
  const script = geminiText(res.data);
  $('videoAnalysis').value = script;
  
  // Tự động trích xuất scenes
  log('Đang trích xuất danh sách cảnh...');
  const extractRes = await window.api.geminiGenerate({ config, body: { contents: [{ parts: [{ text: `Extract only a clean list of visual scenes (one per line, no extra text) from this script for prompt generation: ${script}` }] }] } });
  if (extractRes.ok) $('scenes').value = geminiText(extractRes.ok ? extractRes.data : '');
  
  log('Đã viết kịch bản xong.');
}

$('writeScriptBtn') && ($('writeScriptBtn').onclick = writeAIScript);
loadConfig();
