const audios = Array.from(document.querySelectorAll('audio'));
let audioCtx;
let analyser;
let dataArray;
let bufferLength;

let currentAudio = null;
let currentIndex = -1;

const sourcesMap = new Map();

const playPauseBtn = document.getElementById('play-pause').querySelector('img');
const trackTitle = document.getElementById('track-title');
const progressBar = document.getElementById('progress-bar');
const currentTimeEl = document.getElementById('current-time');
const durationEl = document.getElementById('duration');
const volumeSlider = document.getElementById('volume');
const downloadBtn = document.getElementById('download-track');

function setupAudioContext(audioElement) {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  if (!sourcesMap.has(audioElement)) {
    const source = audioCtx.createMediaElementSource(audioElement);
    sourcesMap.set(audioElement, source);
  }

  const source = sourcesMap.get(audioElement);

  if (!analyser) {
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);
  }

  // Отключаем все подключения, чтобы избежать дублирования
  sourcesMap.forEach(src => src.disconnect());
  if (analyser) analyser.disconnect();

  // Подключаем только текущий источник к анализатору и дестинации
  source.connect(analyser);
  analyser.connect(audioCtx.destination);
}

function updateUIPlaying() {
  audios.forEach((audio, idx) => {
    const trackDiv = audio.parentElement;
    trackDiv.classList.toggle('playing', idx === currentIndex && !audio.paused);
  });

  if (currentAudio && !currentAudio.paused) {
    playPauseBtn.src = 'icons/pause.png';
  } else {
    playPauseBtn.src = 'icons/play.png';
  }

  trackTitle.textContent = currentIndex >= 0
    ? audios[currentIndex].parentElement.querySelector('strong').textContent
    : '—';
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function playTrack(index) {
  if (index < 0) index = audios.length - 1;
  if (index >= audios.length) index = 0;

  if (currentAudio && !currentAudio.paused) currentAudio.pause();

  currentAudio = audios[index];
  currentIndex = index;
  setupAudioContext(currentAudio);
  currentAudio.volume = volumeSlider.value;
  currentAudio.play().catch(() => {});
  updateUIPlaying();
}

audios.forEach((audio, idx) => {
  audio.parentElement.addEventListener('click', () => {
    if (currentAudio === audio && !audio.paused) {
      audio.pause();
    } else {
      playTrack(idx);
    }
  });

  audio.addEventListener('play', () => {
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    currentAudio = audio;
    currentIndex = idx;
    updateUIPlaying();
  });

  audio.addEventListener('pause', updateUIPlaying);
  audio.addEventListener('ended', () => playTrack(currentIndex + 1));
  audio.addEventListener('timeupdate', () => {
    progressBar.max = audio.duration || 0;
    progressBar.value = audio.currentTime;
    currentTimeEl.textContent = formatTime(audio.currentTime);
    durationEl.textContent = formatTime(audio.duration || 0);
  });
});

progressBar.addEventListener('input', () => {
  if (currentAudio) currentAudio.currentTime = progressBar.value;
});

volumeSlider.addEventListener('input', () => {
  if (currentAudio) currentAudio.volume = volumeSlider.value;
});

document.getElementById('play-pause').addEventListener('click', () => {
  if (!currentAudio) {
    playTrack(0);
    return;
  }
  currentAudio.paused ? currentAudio.play() : currentAudio.pause();
});

document.getElementById('prev').addEventListener('click', () => {
  playTrack(currentIndex - 1);
});

document.getElementById('next').addEventListener('click', () => {
  playTrack(currentIndex + 1);
});

// Кнопка скачивания
downloadBtn.addEventListener('click', () => {
  if (!currentAudio) return;

  const sourceElem = currentAudio.querySelector('source');
  if (!sourceElem) return;

  const url = sourceElem.src;
  const trackName = trackTitle.textContent.replace(/\s+/g, '_') || 'track';

  const a = document.createElement('a');
  a.href = url;
  a.download = trackName + url.slice(url.lastIndexOf('.'));
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
});

// Управление пробелом (play/pause)
window.addEventListener('keydown', (e) => {
  const active = document.activeElement;
  if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) {
    return;
  }

  if (e.code === 'Space' || e.key === ' ') {
    e.preventDefault();
    if (!currentAudio) {
      playTrack(0);
    } else {
      if (currentAudio.paused) {
        currentAudio.play();
      } else {
        currentAudio.pause();
      }
    }
  }
});

// Визуализация
const canvas = document.getElementById('visualizer');
const ctx = canvas.getContext('2d');
let WIDTH, HEIGHT;

function resize() {
  WIDTH = canvas.width = window.innerWidth;
  HEIGHT = canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

function draw() {
  requestAnimationFrame(draw);

  if (!analyser) {
    ctx.fillStyle = '#191414';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    return;
  }

  analyser.getByteFrequencyData(dataArray);
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  const barWidth = (WIDTH / bufferLength) * 2.5;
  let x = 0;
  const bassCount = Math.floor(bufferLength * 0.2);
  let bassSum = 0;
  for (let i = 0; i < bassCount; i++) bassSum += dataArray[i];
  const bassAvg = bassSum / bassCount;
  const lightness = 20 + (bassAvg / 255) * 70;
  const saturation = 60 + (bassAvg / 255) * 40;
  const fillColor = `hsl(270, ${saturation}%, ${lightness}%)`;

  for (let i = 0; i < bufferLength; i++) {
    const barHeight = dataArray[i];
    ctx.fillStyle = fillColor;
    ctx.shadowColor = fillColor;
    ctx.shadowBlur = (bassAvg / 255) * 20;
    ctx.fillRect(x, HEIGHT - barHeight * 1.5, barWidth, barHeight * 1.5);
    x += barWidth + 1;
  }

  ctx.shadowBlur = 0;
}

draw();
