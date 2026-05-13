let selectedImage = null;
let selectedVideo = null;
let config = null;
let savedCharacters = [];

const $ = (id) => document.getElementById(id);
function log(msg) { $('log').textContent = `[${new Date().toLocaleTimeString()}] ${msg}\n` + $('log').textContent; }
function geminiText(data) { return data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('\n') || ''; }
function durationToSeconds(value, unit) { return Math.max(1, Number(value || 1)) * (unit === 'phút' ? 60 : 1); }

function selectedCharacterProfile() {
  const currentName = $('charName').value.trim().toLowerCase();
  const matched = savedCharacters.find(c => c.name.toLowerCase() === currentName);
  return matched?.profile || $('profile').value.trim();
}

function updateCharacterList() {
  const container = $('characterList');
  container.innerHTML = '';
  if (!savedCharacters.length) {
    container.innerHTML = '<span class="muted">Chưa có nhân vật đã lưu.</span>';
    return;
  }
  savedCharacters.forEach((char) => {
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
  $('baseUrl').value = config.baseUrl || 'https://answers-name-theology-ruling.trycloudflare.com';
  $('apiKey').value = config.apiKey;
  $('model').value = config.model || 'gemini-2.5-flash';
  savedCharacters = config.savedCharacters || [];
  updateCharacterList();
}

async function saveConfig() {
  config = { 
    baseUrl: $('baseUrl').value.trim(), 
    apiKey: $('apiKey').value.trim(), 
    model: $('model').value,
    savedCharacters
  };
  await window.api.setConfig(config);
  log('Đã lưu cấu hình.');
}

async function pickImage() {
  selectedImage = await window.api.readImage();
  $('imageInfo').textContent = selectedImage ? `Đã chọn: ${selectedImage.filePath}` : 'Chưa chọn ảnh.';
}

async function analyzeCharacter() {
  await saveConfig();
  if (!selectedImage) return alert('Vui lòng chọn ảnh nhân vật trước.');
  const name = $('charName').value.trim() || `Character ${savedCharacters.length + 1}`;
  const notes = $('manualNotes').value.trim();
  log(`Đang phân tích nhân vật ${name} bằng ${config.model}...`);
  const body = {
    contents: [{ parts: [
      { text: `Analyze this reference image and create a strict reusable CHARACTER LOCK PROFILE for image/video prompts. Character name: ${name}. Extra notes: ${notes || 'none'}. Output in English. Include: facial identity, hair, body, outfit, colors, unique marks, style lock, do-not-change rules, negative prompt. Be concise but highly specific. State that future prompts must preserve the same identity, same face, same proportions, same outfit unless explicitly changed.` },
      { inlineData: { mimeType: selectedImage.mime, data: selectedImage.base64 } }
    ]}]
  };
  const res = await window.api.geminiGenerate({ config, model: config.model, body });
  if (!res.ok) { log('Lỗi phân tích: ' + JSON.stringify(res.error)); return; }
  const text = geminiText(res.data);
  if (!text) return log('Lỗi: AI không trả về dữ liệu phân tích.');
  $('profile').value = text;
  const existing = savedCharacters.findIndex(c => c.name.toLowerCase() === name.toLowerCase());
  if (existing >= 0) savedCharacters[existing] = { name, profile: text };
  else savedCharacters.push({ name, profile: text });
  updateCharacterList();
  await saveConfig();
  log('Đã phân tích và lưu nhân vật.');
}

async function pickVideo() {
  selectedVideo = await window.api.readVideo();
  if (selectedVideo?.error) { alert(selectedVideo.error); selectedVideo = null; return; }
  $('videoInfo').textContent = selectedVideo ? `Đã chọn: ${selectedVideo.filePath} (${Math.round(selectedVideo.size/1024/1024)}MB)` : 'Chưa chọn video.';
}

async function analyzeScript() {
  await saveConfig();
  const scriptText = $('scriptInput').value.trim();
  if (!scriptText && !selectedVideo) return alert('Dán kịch bản hoặc chọn video mẫu.');
  log('Đang phân tích kịch bản/video...');
  const parts = [{ text: `Analyze this video/script deeply for recreating similar content with a consistent character. Extract: story structure, hook, pacing, camera angles, visual style, mood, scene list, and prompt-ready visual beats. Script/Description: ${scriptText || 'none'}` }];
  if (selectedVideo) parts.push({ inlineData: { mimeType: selectedVideo.mime, data: selectedVideo.base64 } });
  const res = await window.api.geminiGenerate({ config, model: config.model, body: { contents: [{ parts }] } });
  if (!res.ok) { log('Lỗi phân tích video: ' + JSON.stringify(res.error)); return; }
  $('videoAnalysis').value = geminiText(res.data);
  log('Đã phân tích kịch bản/video.');
}

async function writeAIScript() {
  await saveConfig();
  const topic = $('aiStoryTopic').value.trim() || $('scriptInput').value.trim();
  const totalValue = $('totalDurationVal').value || 3;
  const totalUnit = $('totalDurationUnit').value;
  const perValue = $('durationVal').value || 8;
  const perUnit = $('durationUnit').value;
  const totalSeconds = durationToSeconds(totalValue, totalUnit);
  const perSeconds = durationToSeconds(perValue, perUnit);
  const promptCount = Math.ceil(totalSeconds / perSeconds);
  const profile = selectedCharacterProfile();
  const charName = $('charName').value.trim() || 'Selected character';
  const referenceAnalysis = $('videoAnalysis').value.trim();

  if (!topic) return alert('Nhập chủ đề/kịch bản hoặc phân tích video mẫu trước.');
  if (!profile) return alert('Chọn hoặc phân tích nhân vật trước.');

  log(`Đang tạo kịch bản ${totalValue} ${totalUnit}; cần ${promptCount} prompt, mỗi prompt ${perValue} ${perUnit}...`);

  const body = {
    contents: [{ role: 'user', parts: [{ text: `You are a professional cinematic script writer and AI prompt engineer.

TASK:
Create a complete video script AND exactly ${promptCount} production-ready prompts.

TOTAL VIDEO LENGTH: ${totalValue} ${totalUnit} (${totalSeconds} seconds)
EACH PROMPT DURATION: ${perValue} ${perUnit} (${perSeconds} seconds)
NUMBER OF PROMPTS REQUIRED: exactly ${promptCount}

TOPIC / STORY:
${topic}

REFERENCE VIDEO/SCRIPT ANALYSIS TO FOLLOW IF AVAILABLE:
${referenceAnalysis || 'None'}

CHARACTER NAME: ${charName}
CHARACTER LOCK PROFILE:
${profile}

STRICT REQUIREMENTS:
1. Use the saved character profile above as the source of truth.
2. Every prompt must preserve the same character identity as consistently as possible: same face, same proportions, same hair, same outfit, same key details, same age/style, unless explicitly changed by the user.
3. Output exactly ${promptCount} prompts, no fewer and no more.
4. Each prompt must represent exactly ${perSeconds} seconds of video action.
5. The prompts together must cover the full ${totalSeconds}-second story.
6. Each prompt must include: Prompt number, timestamp range, duration tag, character lock phrase, action, camera movement, lighting, mood, environment, quality/style tags, and negative prompt.
7. Do not use vague prompts. Make each prompt detailed enough for image/video generation.

OUTPUT FORMAT:
A) FULL SCRIPT
B) PROMPT LIST (${promptCount} prompts)

Write in English for prompts, but section labels can be simple.` }] }]
  };

  const res = await window.api.geminiGenerate({ config, model: config.model, body });
  if (!res.ok) { log('Lỗi viết kịch bản/prompt: ' + JSON.stringify(res.error)); return; }
  const text = geminiText(res.data);
  $('videoAnalysis').value = text;
  $('output').value = text;
  log(`Đã tạo xong ${promptCount} prompt.`);
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
$('pickVideoBtn') && ($('pickVideoBtn').onclick = pickVideo);
$('analyzeScriptBtn') && ($('analyzeScriptBtn').onclick = analyzeScript);
$('writeScriptBtn') && ($('writeScriptBtn').onclick = writeAIScript);
$('savePromptsBtn') && ($('savePromptsBtn').onclick = savePrompts);

loadConfig();
