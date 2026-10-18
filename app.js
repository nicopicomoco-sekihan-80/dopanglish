const FX_WORDS = [
  "ABUNDANT", "BRILLIANT", "RAPID", "CURIOUS", "FRAGILE", "VIVID",
  "PATIENT", "ANCIENT", "LIVELY", "CHAOS", "SKILLFUL", "SERENE",
  "PERFECT", "OVERDRIVE", "COMBO", "BURST", "POWER", "DOPA",
];
const MASTERY_STORAGE_KEY = "dopanglish.mastered-words.v1";
const MISTAKE_STORAGE_KEY = "dopanglish.mistake-counts.v1";
const ANSWER_HISTORY_STORAGE_KEY = "dopanglish.answer-history.v1";
const GAME_PROGRESS_STORAGE_KEY = "dopanglish.game-progress.v1";
const BEST_SCORE_STORAGE_KEY = "dopanglish.best-score.v1";

function loadMasteredWords() {
  try {
    const saved = JSON.parse(localStorage.getItem(MASTERY_STORAGE_KEY) || "[]");
    return new Set(Array.isArray(saved) ? saved.filter((word) => typeof word === "string") : []);
  } catch (error) {
    console.warn("Could not load mastered words from local storage.", error);
    return new Set();
  }
}

function loadMistakeCounts() {
  try {
    const saved = JSON.parse(localStorage.getItem(MISTAKE_STORAGE_KEY) || "[]");
    if (!Array.isArray(saved)) return new Map();
    return new Map(saved.filter((entry) => (
      Array.isArray(entry)
      && typeof entry[0] === "string"
      && Number.isInteger(entry[1])
      && entry[1] > 0
    )));
  } catch (error) {
    console.warn("Could not load mistake history from local storage.", error);
    return new Map();
  }
}

function loadAnswerHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(ANSWER_HISTORY_STORAGE_KEY) || "[]");
    if (!Array.isArray(saved)) return new Map();
    return new Map(saved.filter((entry) => (
      Array.isArray(entry)
      && typeof entry[0] === "string"
      && entry[1]
      && Number.isInteger(entry[1].total)
      && entry[1].total >= 0
      && Number.isInteger(entry[1].correct)
      && entry[1].correct >= 0
      && entry[1].correct <= entry[1].total
      && Array.isArray(entry[1].recent)
      && entry[1].recent.every((result) => typeof result === "boolean")
    )).map(([word, history]) => [word, {
      total: history.total,
      correct: history.correct,
      recent: history.recent.slice(-3),
    }]));
  } catch (error) {
    console.warn("Could not load answer history from local storage.", error);
    return new Map();
  }
}

function loadGameProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(GAME_PROGRESS_STORAGE_KEY) || "null");
    if (!saved || saved.version !== 2 || saved.active !== true) return null;
    return saved;
  } catch (error) {
    console.warn("Could not load saved game progress.", error);
    return null;
  }
}

function loadBestScore() {
  try {
    const score = Number(localStorage.getItem(BEST_SCORE_STORAGE_KEY) || 0);
    return Number.isSafeInteger(score) && score >= 0 ? score : 0;
  } catch (error) {
    console.warn("Could not load best score from local storage.", error);
    return 0;
  }
}

const canvas = document.getElementById("bg-canvas");
const ctx = canvas.getContext("2d");
const wordStreamCanvas = document.getElementById("word-stream-canvas");
const wordStreamCtx = wordStreamCanvas.getContext("2d");
const scoreEl = document.getElementById("score");
const bestScoreEl = document.getElementById("best-score");
const comboEl = document.getElementById("combo");
const questionIndexEl = document.getElementById("question-index");
const statusEl = document.getElementById("status");
const difficultyEl = document.getElementById("difficulty");
const wordEl = document.getElementById("word");
const promptEl = document.getElementById("prompt");
const answersEl = document.getElementById("answers");
const startBtn = document.getElementById("start-btn");
const answerRevealEl = document.getElementById("answer-reveal");
const revealWordEl = document.getElementById("reveal-word");
const revealMeaningEl = document.getElementById("reveal-meaning");
const revealComboEl = document.getElementById("reveal-combo");

const state = {
  score: 0,
  bestScore: loadBestScore(),
  combo: 0,
  bestCombo: 0,
  round: 1,
  active: false,
  currentWord: null,
  currentOptions: [],
  lastAnswer: null,
  remainingWords: new Set(),
  retryAfterRound: new Map(),
  reviewProgress: new Map(),
  lastAskedWord: null,
  masteredWords: loadMasteredWords(),
  mistakeCounts: loadMistakeCounts(),
  answerHistory: loadAnswerHistory(),
  answerButtons: [],
  particles: [],
  shards: [],
  confetti: [],
  rings: [],
  lightnings: [],
  delayedBursts: [],
  wordStreams: [],
  callout: null,
  wordBeam: null,
  revealTimeout: 0,
  flash: 0,
  screenShake: 0,
};

function resizeCanvas() {
  const pixelRatio = window.devicePixelRatio;
  [canvas, wordStreamCanvas].forEach((layer) => {
    layer.width = window.innerWidth * pixelRatio;
    layer.height = window.innerHeight * pixelRatio;
    layer.getContext("2d").setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  });
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function hexToRgba(hex, alpha) {
  const clean = hex.replace("#", "");
  const value = clean.length === 3
    ? clean.split("").map((char) => char + char).join("")
    : clean;
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function addParticles(x, y, color, count = 20, scale = 1) {
  for (let i = 0; i < count; i += 1) {
    state.particles.push({
      x,
      y,
      vx: randomBetween(-3.8, 3.8) * scale * 2,
      vy: randomBetween(-3.8, 3.8) * scale * 2,
      life: randomBetween(14, 35),
      size: randomBetween(2.5, 7) * scale,
      color,
    });
  }
}

function spawnGlassShatter(button) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const rect = button.getBoundingClientRect();
  const columns = 5;
  const rows = 3;
  const buttonCenterX = rect.left + rect.width / 2;
  const buttonCenterY = rect.top + rect.height / 2;

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const left = rect.left + (rect.width * column) / columns;
      const right = rect.left + (rect.width * (column + 1)) / columns;
      const top = rect.top + (rect.height * row) / rows;
      const bottom = rect.top + (rect.height * (row + 1)) / rows;
      const corners = [
        { x: left, y: top },
        { x: right, y: top },
        { x: right, y: bottom },
        { x: left, y: bottom },
      ];
      const triangles = Math.random() > 0.5
        ? [[0, 1, 2], [0, 2, 3]]
        : [[0, 1, 3], [1, 2, 3]];

      triangles.forEach((indices) => {
        const points = indices.map((index) => corners[index]);
        const x = points.reduce((sum, point) => sum + point.x, 0) / points.length;
        const y = points.reduce((sum, point) => sum + point.y, 0) / points.length;
        const angle = Math.atan2(y - buttonCenterY, x - buttonCenterX);
        const speed = randomBetween(2.2, 7.2);

        state.shards.push({
          x,
          y,
          vx: Math.cos(angle) * speed + randomBetween(-1.6, 1.6),
          vy: Math.sin(angle) * speed - randomBetween(1, 4),
          rotation: randomBetween(0, Math.PI * 2),
          spin: randomBetween(-0.16, 0.16),
          life: randomBetween(34, 58),
          maxLife: 58,
          points: points.map((point) => ({ x: point.x - x, y: point.y - y })),
          color: ["105, 217, 255", "185, 232, 255", "220, 250, 255"][Math.floor(Math.random() * 3)],
        });
      });
    }
  }
}

function spawnConfetti() {
  const colors = ["#ffe66d", "#69f0ae", "#69d9ff", "#ff4ecf", "#b95dff"];
  const count = 150;
  for (let i = 0; i < count; i += 1) {
    const size = randomBetween(5, 11);
    state.confetti.push({
      x: randomBetween(-20, window.innerWidth + 20),
      y: randomBetween(-window.innerHeight, -10),
      vx: randomBetween(-2.5, 2.5),
      vy: randomBetween(2, 6),
      width: size,
      height: size * randomBetween(0.55, 1.5),
      rotation: randomBetween(0, Math.PI * 2),
      spin: randomBetween(-0.18, 0.18),
      sway: randomBetween(0.4, 1.8),
      phase: randomBetween(0, Math.PI * 2),
      life: randomBetween(100, 180),
      color: colors[i % colors.length],
    });
  }
}

function addRing(x, y, color, maxRadius = 200, scale = 1) {
  state.rings.push({
    x,
    y,
    radius: 8,
    maxRadius,
    life: 27,
    color,
    vx: randomBetween(-0.5, 0.5),
    vy: randomBetween(-0.5, 0.5),
    expansionSpeed: 10 * scale,
  });
}

function addLightning(x, y, length = 140, angle = 0, scale = 1) {
  state.lightnings.push({
    x,
    y,
    length: length * scale,
    angle,
    life: 24,
    width: randomBetween(4, 7) * scale,
    color: Math.random() > 0.35 ? "#ffe66d" : "#69d9ff",
  });
}

function queueCelebration(x, y, scale) {
  const totalBursts = 12;
  for (let i = 0; i < totalBursts; i += 1) {
    const angle = i * 2.39996;
    const radius = Math.sqrt(i / totalBursts) * Math.min(window.innerWidth, window.innerHeight) * 0.48;
    state.delayedBursts.push({
      x: Math.min(window.innerWidth - 30, Math.max(30, x + Math.cos(angle) * radius)),
      y: Math.min(window.innerHeight - 30, Math.max(30, y + Math.sin(angle) * radius)),
      color: ["#ffe66d", "#69f0ae", "#69d9ff", "#ff4ecf"][i % 4],
      delay: i * 24,
      scale,
    });
  }
}

function spawnWordStreams(count = 24) {
  const now = performance.now();
  const verticalCount = Math.ceil(count / 3);
  const horizontalCount = count - verticalCount;
  for (let i = 0; i < count; i += 1) {
    const vertical = i % 3 === 0;
    const direction = Math.random() > 0.5 ? 1 : -1;
    const laneIndex = vertical ? Math.floor(i / 3) : i - Math.ceil(i / 3);
    const laneCount = vertical ? verticalCount : horizontalCount;
    const laneSize = vertical ? window.innerWidth : window.innerHeight;
    state.wordStreams.push({
      word: FX_WORDS[Math.floor(Math.random() * FX_WORDS.length)],
      axis: vertical ? "y" : "x",
      direction,
      lane: ((laneIndex + 0.5) / laneCount) * laneSize + randomBetween(-18, 18),
      size: randomBetween(30, 58),
      bornAt: now + i * 8,
      duration: count > 24 ? randomBetween(1200, 1600) : randomBetween(1000, 1400),
      color: ["#ffe66d", "#69f0ae", "#69d9ff", "#ff4ecf"][i % 4],
    });
  }
}

function comboTier(combo) {
  if (combo >= 8) return 4;
  if (combo >= 5) return 3;
  if (combo >= 3) return 2;
  return 1;
}

function comboTitle(tier) {
  return ["", "HIT", "GLITCH", "OVERDRIVE", "DOPA BREAK"][tier];
}

function persistMasteredWords() {
  try {
    localStorage.setItem(MASTERY_STORAGE_KEY, JSON.stringify([...state.masteredWords]));
  } catch (error) {
    console.warn("Could not save mastered words to local storage.", error);
  }
}

function persistMistakeCounts() {
  try {
    localStorage.setItem(MISTAKE_STORAGE_KEY, JSON.stringify([...state.mistakeCounts]));
  } catch (error) {
    console.warn("Could not save mistake history to local storage.", error);
  }
}

function saveGameProgress() {
  if (!state.active || !state.currentWord) {
    try {
      localStorage.removeItem(GAME_PROGRESS_STORAGE_KEY);
    } catch (error) {
      console.warn("Could not clear saved game progress.", error);
    }
    return;
  }

  const progress = {
    version: 2,
    active: true,
    score: state.score,
    combo: state.combo,
    bestCombo: state.bestCombo,
    round: state.round,
    currentWord: state.currentWord.word,
    currentOptions: state.currentOptions,
    remainingWords: [...state.remainingWords],
    retryAfterRound: [...state.retryAfterRound],
    reviewProgress: [...state.reviewProgress],
    lastAskedWord: state.lastAskedWord,
    lastAnswer: state.lastAnswer,
  };
  try {
    localStorage.setItem(GAME_PROGRESS_STORAGE_KEY, JSON.stringify(progress));
  } catch (error) {
    console.warn("Could not save game progress to local storage.", error);
  }
}

function recordAnswer(word, isCorrect) {
  const previous = state.answerHistory.get(word) || { total: 0, correct: 0, recent: [] };
  const history = {
    total: previous.total + 1,
    correct: previous.correct + (isCorrect ? 1 : 0),
    recent: [...previous.recent, isCorrect].slice(-3),
  };
  state.answerHistory.set(word, history);
  try {
    localStorage.setItem(ANSWER_HISTORY_STORAGE_KEY, JSON.stringify([...state.answerHistory]));
  } catch (error) {
    console.warn("Could not save answer history to local storage.", error);
  }

  const recentCorrect = history.recent.filter(Boolean).length;
  return {
    total: history.total,
    recentTotal: history.recent.length,
    recentAccuracy: recentCorrect / history.recent.length,
    overallAccuracy: history.correct / history.total,
  };
}

function showAnswerReveal(word, meaning, duration, emitBeam, combo = 0) {
  window.clearTimeout(state.revealTimeout);
  if (emitBeam) {
    const wordRect = wordEl.getBoundingClientRect();
    state.wordBeam = {
      x: wordRect.left + wordRect.width / 2,
      y: wordRect.top + wordRect.height / 2,
      startedAt: performance.now(),
      duration,
    };
  } else {
    state.wordBeam = null;
  }
  answerRevealEl.style.setProperty("--reveal-duration", `${duration}ms`);
  wordEl.classList.remove("word-emission");
  if (emitBeam) {
    void wordEl.offsetWidth;
    wordEl.classList.add("word-emission");
  }
  revealWordEl.textContent = word.toLowerCase();
  revealMeaningEl.textContent = meaning;
  revealComboEl.textContent = combo >= 3 ? `${combo}コンボ！` : "";
  revealComboEl.hidden = combo < 3;
  revealComboEl.classList.remove("combo-pop");
  if (combo >= 3) {
    void revealComboEl.offsetWidth;
    revealComboEl.classList.add("combo-pop");
  }
  answerRevealEl.hidden = false;
  answerRevealEl.classList.remove("answer-reveal");
  void answerRevealEl.offsetWidth;
  answerRevealEl.classList.add("answer-reveal", "gaming");
  state.revealTimeout = window.setTimeout(() => {
    answerRevealEl.hidden = true;
    wordEl.classList.remove("word-emission");
  }, duration);
}

function spawnBackgroundParticles() {
  const count = 120;
  state.particles = [];
  for (let i = 0; i < count; i += 1) {
    state.particles.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: randomBetween(-0.3, 0.3),
      vy: randomBetween(-0.2, 0.4),
      life: randomBetween(60, 100),
      size: randomBetween(1, 2.5),
      color: i % 3 === 0 ? "#ffe7a1" : i % 3 === 1 ? "#d89a24" : "#ffbd38",
    });
  }
}

function drawBackground() {
  const now = performance.now();
  const shakeX = state.screenShake > 0 ? randomBetween(-state.screenShake, state.screenShake) : 0;
  const shakeY = state.screenShake > 0 ? randomBetween(-state.screenShake, state.screenShake) : 0;
  state.screenShake = Math.max(0, state.screenShake - 0.6);

  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  ctx.save();
  ctx.translate(shakeX, shakeY);

  if (state.wordBeam) {
    const progress = (now - state.wordBeam.startedAt) / state.wordBeam.duration;
    if (progress >= 1) {
      state.wordBeam = null;
    } else {
      const { x, y } = state.wordBeam;
      const alpha = 1 - progress;
      const maxRadius = Math.hypot(window.innerWidth, window.innerHeight) * 0.72;
      const radius = 24 + progress * maxRadius;

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = alpha;
      for (let i = 0; i < 18; i += 1) {
        const angle = (Math.PI * 2 * i) / 18 + progress * 0.8;
        const length = maxRadius * (0.55 + (i % 4) * 0.12);
        const endX = x + Math.cos(angle) * length;
        const endY = y + Math.sin(angle) * length;
        const beam = ctx.createLinearGradient(x, y, endX, endY);
        beam.addColorStop(0, "rgba(255, 255, 255, 0.95)");
        beam.addColorStop(0.12, i % 2 ? "rgba(105, 217, 255, 0.8)" : "rgba(255, 78, 207, 0.8)");
        beam.addColorStop(1, "rgba(255, 230, 109, 0)");
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = beam;
        ctx.lineWidth = 2 + (i % 3);
        ctx.shadowColor = i % 2 ? "#69d9ff" : "#ff4ecf";
        ctx.shadowBlur = 18;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 240, 150, 0.95)";
      ctx.lineWidth = 8 * alpha + 1;
      ctx.shadowColor = "#ffe66d";
      ctx.shadowBlur = 28;
      ctx.stroke();
      ctx.restore();
    }
  }

  state.delayedBursts = state.delayedBursts.filter((burst) => burst.delay > 0);
  state.delayedBursts.forEach((burst) => {
    burst.delay -= 33.34;
    if (burst.delay <= 0) {
      addParticles(burst.x, burst.y, burst.color, 8, burst.scale);
      addRing(burst.x, burst.y, burst.color, 150, burst.scale);
      if (Math.random() > 0.72) {
        addLightning(burst.x, burst.y, randomBetween(70, 150), randomBetween(0, Math.PI * 2), burst.scale);
      }
    }
  });

  state.rings = state.rings.filter((ring) => ring.life > 0);
  state.rings.forEach((ring) => {
    ring.radius += ring.expansionSpeed;
    ring.x += ring.vx;
    ring.y += ring.vy;
    ring.life -= 1;
    ctx.beginPath();
    ctx.strokeStyle = hexToRgba(ring.color, Math.max(0.05, ring.life / 27));
    ctx.shadowColor = ring.color;
    ctx.shadowBlur = 24;
    ctx.lineWidth = 4;
    ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  });

  state.shards = state.shards.filter((shard) => shard.life > 0);
  state.shards.forEach((shard) => {
    shard.x += shard.vx;
    shard.y += shard.vy;
    shard.vy += 0.18;
    shard.rotation += shard.spin;
    shard.life -= 1;

    ctx.save();
    ctx.translate(shard.x, shard.y);
    ctx.rotate(shard.rotation);
    ctx.globalAlpha = Math.max(0, shard.life / shard.maxLife);
    ctx.beginPath();
    ctx.moveTo(shard.points[0].x, shard.points[0].y);
    shard.points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
    ctx.closePath();
    ctx.fillStyle = `rgba(${shard.color}, 0.28)`;
    ctx.strokeStyle = "rgba(225, 250, 255, 0.95)";
    ctx.lineWidth = 1.4;
    ctx.shadowColor = "#69d9ff";
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  });

  state.confetti = state.confetti.filter((piece) => piece.life > 0 && piece.y < window.innerHeight + 30);
  state.confetti.forEach((piece) => {
    piece.x += piece.vx + Math.sin(piece.phase) * piece.sway;
    piece.y += piece.vy;
    piece.phase += 0.06;
    piece.rotation += piece.spin;
    piece.life -= 1;

    ctx.save();
    ctx.translate(piece.x, piece.y);
    ctx.rotate(piece.rotation);
    ctx.globalAlpha = Math.min(1, piece.life / 30);
    ctx.fillStyle = piece.color;
    ctx.shadowColor = piece.color;
    ctx.shadowBlur = 10;
    ctx.fillRect(-piece.width / 2, -piece.height / 2, piece.width, piece.height);
    ctx.restore();
  });

  state.lightnings = state.lightnings.filter((lightning) => lightning.life > 0);
  state.lightnings.forEach((lightning) => {
    lightning.life -= 1;
    const endX = lightning.x + Math.cos(lightning.angle) * lightning.length;
    const endY = lightning.y + Math.sin(lightning.angle) * lightning.length;
    const dx = endX - lightning.x;
    const dy = endY - lightning.y;
    const distance = Math.hypot(dx, dy);
    const segments = Math.max(5, Math.ceil(distance / 22));
    const perpendicularX = -dy / distance;
    const perpendicularY = dx / distance;
    const points = [{ x: lightning.x, y: lightning.y }];

    for (let i = 1; i < segments; i += 1) {
      const progress = i / segments;
      const offset = randomBetween(-18, 18);
      points.push({
        x: lightning.x + dx * progress + perpendicularX * offset,
        y: lightning.y + dy * progress + perpendicularY * offset,
      });
    }
    points.push({ x: endX, y: endY });

    const alpha = Math.max(0, lightning.life / 24);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = lightning.color;
    ctx.shadowBlur = 24;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
    ctx.strokeStyle = hexToRgba(lightning.color, alpha * 0.85);
    ctx.lineWidth = lightning.width;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.lineWidth = Math.max(1, lightning.width * 0.28);
    ctx.stroke();

    for (let i = 2; i < points.length - 1; i += 3) {
      const branchEndX = points[i].x + randomBetween(-24, 24);
      const branchEndY = points[i].y + randomBetween(-28, 28);
      ctx.beginPath();
      ctx.moveTo(points[i].x, points[i].y);
      ctx.lineTo(branchEndX, branchEndY);
      ctx.strokeStyle = hexToRgba(lightning.color, alpha * 0.7);
      ctx.lineWidth = Math.max(1, lightning.width * 0.45);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  });

  state.particles.forEach((particle) => {
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.life -= 1;

    if (particle.x < 0 || particle.x > window.innerWidth) particle.vx *= -1;
    if (particle.y > window.innerHeight) particle.y = -10;

    ctx.beginPath();
    ctx.fillStyle = particle.color;
    ctx.globalAlpha = Math.max(0, particle.life / 50);
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  state.particles = state.particles.filter((particle) => particle.life > 0);

  if (state.flash > 0) {
    const flashGradient = ctx.createRadialGradient(
      window.innerWidth / 2,
      window.innerHeight / 2,
      0,
      window.innerWidth / 2,
      window.innerHeight / 2,
      Math.max(window.innerWidth, window.innerHeight) * 0.75,
    );
    flashGradient.addColorStop(0, `rgba(255, 248, 193, ${state.flash})`);
    flashGradient.addColorStop(0.35, `rgba(255, 196, 65, ${state.flash * 0.48})`);
    flashGradient.addColorStop(1, `rgba(255, 78, 207, ${state.flash * 0.12})`);
    ctx.fillStyle = flashGradient;
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    state.flash *= 0.82;
  }

  if (state.callout && now < state.callout.endsAt) {
    const progress = (now - state.callout.startedAt) / (state.callout.endsAt - state.callout.startedAt);
    const alpha = Math.min(1, (1 - progress) * 1.8);
    const scale = 0.85 + Math.min(progress * 2, 0.3);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(window.innerWidth / 2, window.innerHeight * 0.2);
    ctx.scale(scale, scale);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const titleSize = Math.min(76, Math.max(26, window.innerWidth * 0.06));
    const subtitleSize = Math.min(22, Math.max(12, window.innerWidth * 0.02));
    const titleFont = state.callout.title.includes("激")
      ? '"Zen Kaku Gothic New", sans-serif'
      : "Orbitron, sans-serif";
    ctx.font = `900 ${titleSize}px ${titleFont}`;
    ctx.lineWidth = 8;
    ctx.strokeStyle = "rgba(7, 11, 18, 0.9)";
    ctx.shadowColor = state.callout.color;
    ctx.shadowBlur = 28;
    ctx.strokeText(state.callout.title, 0, 0);
    ctx.fillStyle = state.callout.color;
    ctx.fillText(state.callout.title, 0, 0);
    ctx.font = `700 ${subtitleSize}px "Zen Kaku Gothic New", sans-serif`;
    ctx.fillText(state.callout.subtitle, 0, 48);
    ctx.restore();
  } else {
    state.callout = null;
  }

  ctx.restore();
}

function drawWordStreams() {
  const now = performance.now();
  wordStreamCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  state.wordStreams = state.wordStreams.filter((stream) => now < stream.bornAt + stream.duration);
  state.wordStreams.forEach((stream) => {
    if (now < stream.bornAt) return;
    const progress = (now - stream.bornAt) / stream.duration;
    const alpha = Math.sin(progress * Math.PI) * 0.9;
    const offset = progress * (stream.axis === "x" ? window.innerWidth + 420 : window.innerHeight + 240);
    const x = stream.axis === "x"
      ? (stream.direction > 0 ? -220 + offset : window.innerWidth + 220 - offset)
      : stream.lane;
    const y = stream.axis === "y"
      ? (stream.direction > 0 ? -120 + offset : window.innerHeight + 120 - offset)
      : stream.lane;

    wordStreamCtx.save();
    wordStreamCtx.globalAlpha = alpha;
    wordStreamCtx.translate(x, y);
    if (stream.axis === "y") wordStreamCtx.rotate(Math.PI / 2);
    wordStreamCtx.font = `900 ${stream.size}px Orbitron, sans-serif`;
    wordStreamCtx.textAlign = "center";
    wordStreamCtx.textBaseline = "middle";
    wordStreamCtx.shadowColor = stream.color;
    wordStreamCtx.shadowBlur = 24;
    wordStreamCtx.lineWidth = 5;
    wordStreamCtx.strokeStyle = "rgba(5, 8, 18, 0.96)";
    wordStreamCtx.strokeText(stream.word, 0, 0);
    wordStreamCtx.fillStyle = stream.color;
    wordStreamCtx.fillText(stream.word, 0, 0);
    wordStreamCtx.restore();
  });
}

function updateHUD() {
  scoreEl.textContent = String(state.score);
  bestScoreEl.textContent = String(state.bestScore);
  comboEl.textContent = `x${state.combo}`;
  questionIndexEl.textContent = String(state.round);
}

function createAnswerButton(text, index) {
  const btn = document.createElement("button");
  btn.className = "answer-btn";
  btn.type = "button";
  btn.dataset.meaning = text;
  btn.textContent = `${index + 1}. ${text}`;
  btn.addEventListener("click", () => handleAnswer(index));
  return btn;
}

function renderChoices(options) {
  answersEl.innerHTML = "";
  state.answerButtons = options.map((option, index) => {
    const btn = createAnswerButton(option, index);
    answersEl.appendChild(btn);
    return btn;
  });
}

function shuffle(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function randomWord() {
  const pending = WORD_BANK.filter((card) => state.remainingWords.has(card.word));
  const missed = pending.filter((card) => (state.mistakeCounts.get(card.word) || 0) > 0);
  const unseen = pending.filter((card) => (state.mistakeCounts.get(card.word) || 0) === 0);
  const dueReviews = WORD_BANK.filter((card) => {
    const review = state.reviewProgress.get(card.word);
    return review && review.nextRound <= state.round;
  });
  const dueMissed = missed.filter((card) => (
    !state.reviewProgress.has(card.word)
    && (state.retryAfterRound.get(card.word) || 1) <= state.round
  ));
  const completed = WORD_BANK.filter((card) => (
    !state.remainingWords.has(card.word) && !state.reviewProgress.has(card.word)
  ));
  let candidates;

  if (dueReviews.length > 0) candidates = dueReviews;
  if (!candidates && missed.length <= 10 && state.round % 4 === 0) {
    const review = WORD_BANK.filter((card) => (
      !state.reviewProgress.has(card.word)
      && (
        (state.mistakeCounts.get(card.word) || 0) >= 2
        || state.masteredWords.has(card.word)
      )
    ));
    if (review.length > 0) candidates = review;
  }

  if (!candidates && dueMissed.length > 0) candidates = dueMissed;
  if (!candidates && unseen.length > 0) candidates = unseen;
  if (!candidates && missed.length > 0) {
    candidates = missed.filter((card) => !state.reviewProgress.has(card.word));
  }
  if (!candidates && completed.length > 0) candidates = completed;
  if (!candidates || candidates.length === 0) {
    const nextReviewRound = Math.min(
      ...[...state.reviewProgress.values()].map((review) => review.nextRound),
    );
    candidates = WORD_BANK.filter((card) => (
      state.reviewProgress.has(card.word)
      && state.reviewProgress.get(card.word).nextRound === nextReviewRound
    ));
  }
  if (!candidates || candidates.length === 0) candidates = pending;

  const withoutImmediateRepeat = candidates.filter((card) => card.word !== state.lastAskedWord);
  const pool = withoutImmediateRepeat.length ? withoutImmediateRepeat : candidates;
  const card = pool[Math.floor(Math.random() * pool.length)] || WORD_BANK[0];
  state.lastAskedWord = card.word;
  return card;
}

function nextQuestion() {
  const card = randomWord();
  state.currentWord = card;
  const distractors = shuffle([...new Set(
    WORD_BANK.filter((candidate) => candidate.meaning !== card.meaning)
      .map((candidate) => candidate.meaning),
  )]).slice(0, 3);
  const options = shuffle([card.meaning, ...distractors]);
  state.currentOptions = options;
  state.lastAnswer = null;
  renderChoices(options);
  wordEl.textContent = card.word.toLowerCase();
  difficultyEl.textContent = `難易度 ${"★".repeat(card.difficulty)}${"☆".repeat(5 - card.difficulty)}`;
  difficultyEl.setAttribute("aria-label", `難易度 ${card.difficulty}/5`);
  statusEl.textContent = "LIVE";
  promptEl.textContent = "意味として正しいものは？";
  updateHUD();
  saveGameProgress();
}

function updateStatus(text, tone = "normal") {
  statusEl.textContent = text;
  statusEl.style.color = tone === "danger" ? "#ff9bb0" : tone === "good" ? "#69f0ae" : "#69d9ff";
}

function triggerSuccessBurst({ tier, firstTime, hardClear, accuracyChallenge, accuracy, bonus }) {
  const target = state.answerButtons.find((button) => button.classList.contains("golden"));
  const targetRect = target?.getBoundingClientRect();
  const x = targetRect ? targetRect.left + targetRect.width / 2 : window.innerWidth / 2;
  const y = targetRect ? targetRect.top + targetRect.height / 2 : window.innerHeight / 2;
  const tierScale = [1, 1, 1.2, 1.45, 1.75][tier];
  const scale = Math.min(2.5, tierScale * (firstTime ? 1.45 : 1) * (hardClear ? 1.3 : 1));
  const comboName = comboTitle(tier);
  const title = hardClear ? "激ムズ正解！" : firstTime ? "NEW WORD!" : comboName;
  const subtitle = accuracyChallenge
    ? `直近${accuracy.recentTotal}回 ${Math.round(accuracy.recentAccuracy * 100)}% · 累計 ${Math.round(accuracy.overallAccuracy * 100)}% · +${bonus} pt`
    : hardClear
      ? `難易度 ${state.currentWord.difficulty}/5 · +${bonus} pt`
    : firstTime ? state.currentWord.word.toUpperCase() : `COMBO x${state.combo}`;
  state.flash = Math.min(0.86, 0.58 + scale * 0.12);
  state.screenShake = 8 + scale * 9;
  state.callout = {
    title,
    subtitle,
    color: hardClear || firstTime || tier >= 3 ? "#ffe66d" : "#69f0ae",
    startedAt: performance.now(),
    endsAt: performance.now() + (hardClear ? 1500 : firstTime ? 1200 : 760),
  };
  queueCelebration(x, y, scale);
  spawnWordStreams(hardClear ? 72 : 24);
  addParticles(x, y, "#69f0ae", 42, scale);
  addParticles(x, y, "#ffe66d", 30, scale);
  addParticles(x, y, "#b95dff", 20, scale);
  addRing(x, y, "#ffe66d", 240, scale);
  addRing(x, y, "#69f0ae", 190, scale);
  addRing(window.innerWidth / 2, window.innerHeight / 2, "#69d9ff", 300, scale);
  for (let i = 0; i < 6; i += 1) {
    addLightning(
      x + randomBetween(-35, 35),
      y + randomBetween(-35, 35),
      randomBetween(180, Math.max(window.innerWidth, window.innerHeight) * 0.62),
      (Math.PI * 2 * i) / 6 + randomBetween(-0.18, 0.18),
      scale,
    );
  }
  wordEl.classList.remove("miss");
  wordEl.classList.add("hit");
  setTimeout(() => wordEl.classList.remove("hit"), 500);
}

function triggerMistakeBurst() {
  state.flash = 0.3;
  addParticles(window.innerWidth / 2, window.innerHeight / 2, "#ff5b7a", 28);
  addRing(window.innerWidth / 2, window.innerHeight / 2, "#ff5b7a", 180);
  wordEl.classList.remove("hit");
  wordEl.classList.add("miss");
  setTimeout(() => wordEl.classList.remove("miss"), 450);
}

function updateReviewProgress(word, isCorrect) {
  if (!isCorrect) {
    state.remainingWords.add(word);
    state.retryAfterRound.set(word, state.round + 3);
    state.reviewProgress.set(word, {
      streak: 0,
      interval: 3,
      nextRound: state.round + 3,
    });
    return;
  }

  state.retryAfterRound.delete(word);
  const review = state.reviewProgress.get(word);
  if (!review) return;
  review.streak += 1;
  if (review.streak >= 5) {
    state.reviewProgress.delete(word);
    return;
  }

  review.nextRound = state.round + review.interval;
  review.interval += 2;
}

function handleAnswer(index) {
  if (!state.active || !state.currentWord) return;

  const buttons = [...state.answerButtons];
  const correctIndex = buttons.findIndex((btn) => btn.dataset.meaning === state.currentWord.meaning);
  const isCorrect = index === correctIndex;

  buttons.forEach((btn, btnIndex) => {
    btn.disabled = true;
    if (btnIndex === correctIndex) {
      btn.classList.add("correct");
    }
    if (btnIndex === index && btnIndex !== correctIndex) {
      btn.classList.add("wrong");
    }
  });
  if (isCorrect) spawnGlassShatter(buttons[index]);

  const revealDuration = isCorrect ? 1100 : 2800;
  showAnswerReveal(
    state.currentWord.word,
    state.currentWord.meaning,
    revealDuration,
    isCorrect,
    isCorrect ? state.combo + 1 : 0,
  );
  const accuracy = recordAnswer(state.currentWord.word, isCorrect);

  if (isCorrect) {
    spawnConfetti();
    state.remainingWords.delete(state.currentWord.word);
    updateReviewProgress(state.currentWord.word, true);
    const mistakeCount = state.mistakeCounts.get(state.currentWord.word) || 0;
    const difficultyBonus = state.currentWord.difficulty >= 4
      ? (state.currentWord.difficulty - 3) * 100
      : 0;
    const recoveryBonus = mistakeCount > 0 ? Math.min(mistakeCount, 3) * 75 : 0;
    const bonus = difficultyBonus + recoveryBonus;
    const accuracyChallenge = accuracy.total >= 3
      && (accuracy.recentAccuracy + accuracy.overallAccuracy) / 2 <= 0.5;
    const hardClear = state.currentWord.difficulty >= 4 || accuracyChallenge;
    state.combo += 1;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    state.score += 100 + state.combo * 25 + bonus;
    state.bestScore = Math.max(state.bestScore, state.score);
    try {
      localStorage.setItem(BEST_SCORE_STORAGE_KEY, String(state.bestScore));
    } catch (error) {
      console.warn("Could not save best score to local storage.", error);
    }
    const firstTime = !state.masteredWords.has(state.currentWord.word);
    state.masteredWords.add(state.currentWord.word);
    persistMasteredWords();
    const tier = comboTier(state.combo);
    updateStatus(hardClear ? "激ムズ正解！" : firstTime ? "NEW WORD!" : `COMBO ${comboTitle(tier)}`, "good");
    promptEl.textContent = hardClear
      ? `${state.currentWord.word} = ${state.currentWord.meaning}　BONUS +${bonus} pt`
      : firstTime
      ? `初めて正解！ ${state.currentWord.word} = ${state.currentWord.meaning}`
      : `${state.currentWord.word} = ${state.currentWord.meaning}`;
    state.answerButtons[correctIndex].classList.add("golden");
    triggerSuccessBurst({ tier, firstTime, hardClear, accuracyChallenge, accuracy, bonus });
  } else {
    state.combo = 0;
    const mistakeCount = (state.mistakeCounts.get(state.currentWord.word) || 0) + 1;
    state.mistakeCounts.set(state.currentWord.word, mistakeCount);
    updateReviewProgress(state.currentWord.word, false);
    persistMistakeCounts();
    updateStatus("MISS", "danger");
    promptEl.textContent = `正解は ${state.currentWord.meaning} だよ`;
    state.answerButtons[correctIndex].classList.add("golden");
    triggerMistakeBurst();
  }

  updateHUD();
  const delay = isCorrect ? 900 : revealDuration;
  state.lastAnswer = {
    isCorrect,
    selectedIndex: index,
    correctIndex,
    status: statusEl.textContent,
    prompt: promptEl.textContent,
    nextAt: Date.now() + delay,
  };
  saveGameProgress();
  window.setTimeout(advanceQuestion, delay);
}

function advanceQuestion() {
  state.round += 1;
  state.lastAnswer = null;
  if (state.remainingWords.size === 0 && state.reviewProgress.size === 0) {
    state.active = false;
    wordEl.textContent = "CLEAR";
    promptEl.textContent = `全${WORD_BANK.length}語正解！ SCORE ${state.score} / ${state.round - 1} QUESTIONS`;
    updateStatus("STAGE CLEAR", "good");
    startBtn.disabled = false;
    startBtn.textContent = "RESTART";
    saveGameProgress();
    return;
  }
  nextQuestion();
}

function resetGame() {
  window.clearTimeout(state.revealTimeout);
  answerRevealEl.hidden = true;
  state.score = 0;
  state.combo = 0;
  state.bestCombo = 0;
  state.round = 1;
  state.currentOptions = [];
  state.lastAnswer = null;
  state.remainingWords = new Set(WORD_BANK.map((card) => card.word));
  state.retryAfterRound.clear();
  state.reviewProgress.clear();
  state.lastAskedWord = null;
  state.shards = [];
  state.active = true;
  startBtn.disabled = true;
  startBtn.textContent = "RUNNING";
  updateStatus("READY", "normal");
  updateHUD();
  nextQuestion();
}

function restoreGameProgress() {
  const saved = loadGameProgress();
  if (
    !saved
    || !Number.isSafeInteger(saved.score)
    || saved.score < 0
    || !Number.isSafeInteger(saved.combo)
    || saved.combo < 0
    || !Number.isSafeInteger(saved.bestCombo)
    || saved.bestCombo < 0
    || !Number.isSafeInteger(saved.round)
    || saved.round < 1
    || !Array.isArray(saved.remainingWords)
    || !Array.isArray(saved.retryAfterRound)
    || !Array.isArray(saved.currentOptions)
    || saved.currentOptions.length !== 4
    || new Set(saved.currentOptions).size !== 4
  ) {
    return false;
  }

  const currentWord = WORD_BANK.find((card) => card.word === saved.currentWord);
  if (
    !currentWord
    || !saved.currentOptions.every((option) => typeof option === "string")
    || !saved.currentOptions.includes(currentWord.meaning)
  ) {
    return false;
  }

  const remainingWords = saved.remainingWords.filter((word) => (
    typeof word === "string" && WORD_BANK.some((card) => card.word === word)
  ));
  if (new Set(remainingWords).size !== remainingWords.length) return false;

  const savedReviewProgress = saved.reviewProgress === undefined ? [] : saved.reviewProgress;
  if (!Array.isArray(savedReviewProgress)) return false;
  const reviewProgress = savedReviewProgress.filter((entry) => (
    Array.isArray(entry)
    && typeof entry[0] === "string"
    && WORD_BANK.some((card) => card.word === entry[0])
    && entry[1]
    && Number.isSafeInteger(entry[1].streak)
    && entry[1].streak >= 0
    && entry[1].streak < 5
    && Number.isSafeInteger(entry[1].interval)
    && entry[1].interval >= 3
    && Number.isSafeInteger(entry[1].nextRound)
    && entry[1].nextRound >= 1
  ));
  if (
    reviewProgress.length !== savedReviewProgress.length
    || new Set(reviewProgress.map(([word]) => word)).size !== reviewProgress.length
  ) {
    return false;
  }

  const lastAnswer = saved.lastAnswer;
  if (lastAnswer && (
    typeof lastAnswer.isCorrect !== "boolean"
    || !Number.isInteger(lastAnswer.selectedIndex)
    || lastAnswer.selectedIndex < 0
    || lastAnswer.selectedIndex > 3
    || !Number.isInteger(lastAnswer.correctIndex)
    || lastAnswer.correctIndex < 0
    || lastAnswer.correctIndex > 3
    || !Number.isSafeInteger(lastAnswer.nextAt)
    || typeof lastAnswer.status !== "string"
    || typeof lastAnswer.prompt !== "string"
  )) {
    return false;
  }

  state.score = saved.score;
  state.combo = saved.combo;
  state.bestCombo = saved.bestCombo;
  state.round = saved.round;
  state.currentWord = currentWord;
  state.currentOptions = saved.currentOptions;
  state.remainingWords = new Set(remainingWords);
  state.retryAfterRound = new Map(saved.retryAfterRound.filter((entry) => (
    Array.isArray(entry)
    && typeof entry[0] === "string"
    && WORD_BANK.some((card) => card.word === entry[0])
    && Number.isSafeInteger(entry[1])
    && entry[1] >= 1
  )));
  state.reviewProgress = new Map(reviewProgress.map(([word, progress]) => [word, { ...progress }]));
  state.lastAskedWord = typeof saved.lastAskedWord === "string" ? saved.lastAskedWord : currentWord.word;
  state.lastAnswer = lastAnswer || null;
  state.active = true;
  renderChoices(state.currentOptions);
  wordEl.textContent = currentWord.word.toLowerCase();
  difficultyEl.textContent = `難易度 ${"★".repeat(currentWord.difficulty)}${"☆".repeat(5 - currentWord.difficulty)}`;
  difficultyEl.setAttribute("aria-label", `難易度 ${currentWord.difficulty}/5`);
  startBtn.disabled = true;
  startBtn.textContent = "RUNNING";

  if (state.lastAnswer) {
    const { isCorrect, selectedIndex, correctIndex, nextAt } = state.lastAnswer;
    state.answerButtons.forEach((button, index) => {
      button.disabled = true;
      if (index === correctIndex) button.classList.add("correct", "golden");
      if (index === selectedIndex && !isCorrect) button.classList.add("wrong");
    });
    const delay = Math.max(0, nextAt - Date.now());
    updateStatus(state.lastAnswer.status, isCorrect ? "good" : "danger");
    promptEl.textContent = state.lastAnswer.prompt;
    showAnswerReveal(currentWord.word, currentWord.meaning, delay, isCorrect, isCorrect ? state.combo : 0);
    window.setTimeout(advanceQuestion, delay);
  } else {
    updateStatus("LIVE", "normal");
    promptEl.textContent = "意味として正しいものは？";
  }

  updateHUD();
  return true;
}

function tick() {
  drawBackground();
  drawWordStreams();
  requestAnimationFrame(tick);
}

startBtn.addEventListener("click", () => {
  resetGame();
});

window.addEventListener("resize", () => {
  resizeCanvas();
  spawnBackgroundParticles();
});

resizeCanvas();
spawnBackgroundParticles();
updateHUD();
if (!restoreGameProgress()) {
  startBtn.disabled = false;
  startBtn.textContent = "START";
  wordEl.textContent = "DOPA";
  promptEl.textContent = "英語を解け。画面をブチ上げろ。";
  updateStatus("READY", "normal");
}
requestAnimationFrame(tick);
