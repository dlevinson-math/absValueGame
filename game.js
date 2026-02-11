/* ═══════════════════════════════════════════════
   V-Quest — Absolute Value Transformation Game
   Core Game Logic — Vertex + Slope + UFO Laser Animation
   Light Theme Edition
   ═══════════════════════════════════════════════ */

const Game = (() => {
    // ── State ──────────────────────────────────
    let state = {
        level: 1,
        score: 0,
        attempts: 2,
        maxAttempts: 2,
        a: null,          // null = not yet set by student
        h: null,
        k: null,
        target: { x: 0, y: 0 },      // vertex target
        slopeTarget: { x: 0, y: 0 },  // second point that arm must pass through
        solved: false,
        editingVar: null,
        levelHistory: [],
    };

    // ── Animation State ────────────────────────
    let anim = {
        active: false,
        phase: 'none',       // 'fly' | 'glow' | 'laser' | 'hit' | 'hold' | 'done'
        startTime: 0,
        saucerX: 0,
        saucerY: 0,
        startPx: [0, 0],
        endPx: [0, 0],
        laserProgress: 0,
        glowAlpha: 0,
        hitParticles: [],    // for hit animation
    };

    // Phase durations (ms)
    const FLY_DURATION = 800;
    const GLOW_DURATION = 600;
    const LASER_DURATION = 500;
    const HIT_DURATION = 700;
    const HOLD_DURATION = 800;

    // ── Canvas ─────────────────────────────────
    let canvas, ctx;
    let canvasWidth, canvasHeight;
    let bounds = { xMin: -10, xMax: 10, yMin: -10, yMax: 10 };
    let unitPx = 1;

    // ── Colors (light theme) ──────────────────
    const C = {
        bg: '#f5f3ee',
        grid: '#e0ddd6',
        axis: '#b0aaa0',
        axisLabel: '#8a8478',
        target: '#d94f4f',
        targetGlow: 'rgba(217, 79, 79, 0.18)',
        slopeTarget: '#2563eb',
        slopeTargetGlow: 'rgba(37, 99, 235, 0.18)',
        vertex: '#2563eb',
        vertexGlow: 'rgba(37, 99, 235, 0.2)',
        saucerBody: '#8b949e',
        saucerDome: '#2563eb',
        saucerGlow: 'rgba(37, 99, 235, 0.5)',
        laserCore: '#16a34a',
        laserGlow: 'rgba(22, 163, 74, 0.30)',
        laserOuter: 'rgba(22, 163, 74, 0.08)',
        hitGlow: '#f59e0b',
    };

    // ── Level Generation (vertex + slope) ─────
    function generateLevel(levelNum) {
        const difficulty = Math.min(Math.floor((levelNum - 1) / 2), 5);
        const range = Math.min(3 + difficulty, 8);

        // Generate vertex target
        const correctH = randInt(-range, range);
        const correctK = randInt(-range, range);

        // Generate slope (a) — keep it simple: small integers, avoid 0
        // Early levels: a = 1 or -1 or 2; later: wider range
        let possibleA;
        if (levelNum <= 3) {
            possibleA = [1, -1, 2];
        } else if (levelNum <= 6) {
            possibleA = [1, -1, 2, -2, 3];
        } else {
            possibleA = [1, -1, 2, -2, 3, -3];
        }
        const correctA = possibleA[randInt(0, possibleA.length - 1)];

        // Compute a second point on the function y = a|x - h| + k
        // Pick an offset dx (1-3 units from vertex), compute dy
        const dx = randInt(1, 3) * (Math.random() < 0.5 ? 1 : -1);
        const slopeX = correctH + dx;
        const slopeY = correctA * Math.abs(dx) + correctK; // y = a|slopeX - h| + k

        return {
            target: { x: correctH, y: correctK },
            slopeTarget: { x: slopeX, y: slopeY },
            correctH,
            correctK,
            correctA,
        };
    }

    function randInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // Build the mission text string
    function buildMissionText(target, slopeTarget) {
        const dx = slopeTarget.x - target.x;
        const dy = slopeTarget.y - target.y;

        let vertDir = '';
        if (dy > 0) vertDir = `${Math.abs(dy)} unit${Math.abs(dy) !== 1 ? 's' : ''} up`;
        else if (dy < 0) vertDir = `${Math.abs(dy)} unit${Math.abs(dy) !== 1 ? 's' : ''} down`;

        let horizDir = '';
        if (dx > 0) horizDir = `${Math.abs(dx)} unit${Math.abs(dx) !== 1 ? 's' : ''} right`;
        else if (dx < 0) horizDir = `${Math.abs(dx)} unit${Math.abs(dx) !== 1 ? 's' : ''} left`;

        let offsetPart = '';
        if (vertDir && horizDir) offsetPart = `${vertDir} and ${horizDir}`;
        else offsetPart = vertDir || horizDir || 'at the same spot';

        return `Land vertex on (${target.x}, ${target.y}) and adjust slope to hit a point ${offsetPart}`;
    }

    // ── Init ───────────────────────────────────
    function init() {
        canvas = document.getElementById('graph-canvas');
        ctx = canvas.getContext('2d');

        window.addEventListener('resize', () => { resizeCanvas(); if (!anim.active) draw(); });

        document.getElementById('eq-a').addEventListener('click', () => openInput('a'));
        document.getElementById('eq-h').addEventListener('click', () => openInput('h'));
        document.getElementById('eq-k').addEventListener('click', () => openInput('k'));

        document.getElementById('input-field').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') confirmInput();
            if (e.key === 'Escape') cancelInput();
        });

        loadState();
    }

    // ── Screens ────────────────────────────────
    function showScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(id).classList.add('active');
    }

    function showTitle() {
        showScreen('title-screen');
        hideOverlays();
        const saved = localStorage.getItem('vquest_state');
        document.getElementById('btn-continue').style.display = saved ? 'inline-flex' : 'none';
    }

    function showHow() { showScreen('how-screen'); }

    function showGame() {
        showScreen('game-screen');
        resizeCanvas();
        draw();
    }

    function hideOverlays() {
        document.getElementById('level-complete').style.display = 'none';
        document.getElementById('level-failed').style.display = 'none';
    }

    // ── Game Flow ──────────────────────────────
    function startNew() {
        state.level = 1;
        state.score = 0;
        state.levelHistory = [];
        saveState();
        setupLevel();
        showGame();
    }

    function continueGame() {
        loadState();
        setupLevel();
        showGame();
    }

    function setupLevel() {
        const lvl = generateLevel(state.level);
        state.target = lvl.target;
        state.slopeTarget = lvl.slopeTarget;
        state.attempts = state.maxAttempts;
        state.solved = false;
        state.a = null;
        state.h = null;
        state.k = null;
        state.editingVar = null;
        state._correct = { h: lvl.correctH, k: lvl.correctK, a: lvl.correctA };

        // Reset animation
        anim.active = false;
        anim.phase = 'none';

        // Auto-fit bounds
        const allX = [Math.abs(state.target.x), Math.abs(state.slopeTarget.x)];
        const allY = [Math.abs(state.target.y), Math.abs(state.slopeTarget.y)];
        const maxCoord = Math.max(...allX, ...allY, 6) + 2;
        const b = Math.min(Math.max(maxCoord, 7), 14);
        bounds = { xMin: -b, xMax: b, yMin: -b, yMax: b };

        // Update mission text
        document.getElementById('mission-text').textContent = buildMissionText(state.target, state.slopeTarget);

        updateUI();
        hideOverlays();
        hideFeedback();
        draw();
    }

    function updateUI() {
        document.getElementById('level-number').textContent = 'Level ' + state.level;
        document.getElementById('score-display').textContent = state.score;
        document.getElementById('attempts-display').textContent = state.attempts;

        // Show placeholder letters when null, numbers when set
        const eqA = document.getElementById('eq-a');
        const eqH = document.getElementById('eq-h');
        const eqK = document.getElementById('eq-k');

        if (state.a === null) {
            eqA.textContent = 'a';
            eqA.classList.add('placeholder');
        } else {
            eqA.textContent = state.a;
            eqA.classList.remove('placeholder');
        }
        if (state.h === null) {
            eqH.textContent = 'h';
            eqH.classList.add('placeholder');
        } else {
            eqH.textContent = state.h;
            eqH.classList.remove('placeholder');
        }
        if (state.k === null) {
            eqK.textContent = 'k';
            eqK.classList.add('placeholder');
        } else {
            eqK.textContent = state.k;
            eqK.classList.remove('placeholder');
        }
    }

    // ── Input ──────────────────────────────────
    function openInput(varName) {
        if (state.solved || anim.active) return;

        state.editingVar = varName;
        ['eq-a', 'eq-h', 'eq-k'].forEach(id => document.getElementById(id).classList.remove('active'));
        document.getElementById('eq-' + varName).classList.add('active');

        const modal = document.getElementById('input-modal');
        const label = document.getElementById('input-label');
        const field = document.getElementById('input-field');

        label.textContent = `Set value for ${varName}:`;
        field.value = state[varName] !== null ? state[varName] : '';
        field.placeholder = varName === 'a' ? '1' : '0';
        modal.style.display = 'block';

        setTimeout(() => { field.focus(); field.select(); }, 50);
    }

    function confirmInput() {
        const field = document.getElementById('input-field');
        const val = parseInt(field.value, 10);
        if (isNaN(val)) return;

        // For 'a', disallow 0
        if (state.editingVar === 'a' && val === 0) {
            field.value = '';
            field.placeholder = 'Not 0!';
            return;
        }

        const clamped = Math.max(-15, Math.min(15, val));
        state[state.editingVar] = clamped;

        closeInput();
        updateUI();
    }

    function cancelInput() { closeInput(); }

    function closeInput() {
        document.getElementById('input-modal').style.display = 'none';
        ['eq-a', 'eq-h', 'eq-k'].forEach(id => document.getElementById(id).classList.remove('active'));
        state.editingVar = null;
    }

    // ── Solution Check + Animation ─────────────
    function trySolution() {
        if (state.solved || state.attempts <= 0 || anim.active) return;
        if (state.a === null || state.h === null || state.k === null) {
            showFeedback('✏️ Set a, h, and k before trying!', 'fail');
            return;
        }

        state.attempts--;
        updateUI();

        // Check correctness: vertex matches AND slope matches
        const vertexCorrect = (state.h === state.target.x && state.k === state.target.y);
        // Check if the slope target point lies on y = a|x - h| + k
        const expectedY = state.a * Math.abs(state.slopeTarget.x - state.h) + state.k;
        const slopeCorrect = (expectedY === state.slopeTarget.y);

        const isCorrect = vertexCorrect && slopeCorrect;

        startSaucerAnimation(isCorrect);
    }

    // ═══════════════════════════════════════════
    //  FLYING SAUCER ANIMATION SYSTEM
    // ═══════════════════════════════════════════

    function startSaucerAnimation(isCorrect) {
        anim.active = true;
        anim.phase = 'fly';
        anim.startTime = performance.now();
        anim.isCorrect = isCorrect;

        const [endX, endY] = toPixel(state.h, state.k);
        anim.startPx = [canvasWidth / 2, -40];
        anim.endPx = [endX, endY];
        anim.saucerX = anim.startPx[0];
        anim.saucerY = anim.startPx[1];
        anim.laserProgress = 0;
        anim.glowAlpha = 0;
        anim.hitParticles = [];

        document.getElementById('btn-try').disabled = true;
        requestAnimationFrame(animationLoop);
    }

    function animationLoop(timestamp) {
        if (!anim.active) return;

        const elapsed = timestamp - anim.startTime;

        switch (anim.phase) {
            case 'fly': {
                const t = Math.min(elapsed / FLY_DURATION, 1);
                const ease = 1 - Math.pow(1 - t, 3);
                anim.saucerX = anim.startPx[0] + (anim.endPx[0] - anim.startPx[0]) * ease;
                anim.saucerY = anim.startPx[1] + (anim.endPx[1] - anim.startPx[1]) * ease;
                anim.saucerX += Math.sin(elapsed * 0.012) * 3 * (1 - t);

                if (t >= 1) {
                    anim.phase = 'glow';
                    anim.startTime = timestamp;
                    anim.saucerX = anim.endPx[0];
                    anim.saucerY = anim.endPx[1];
                }
                break;
            }

            case 'glow': {
                const t = Math.min(elapsed / GLOW_DURATION, 1);
                anim.glowAlpha = t < 0.5 ? t * 2 : 1;

                if (t >= 1) {
                    anim.phase = 'laser';
                    anim.startTime = timestamp;
                }
                break;
            }

            case 'laser': {
                const t = Math.min(elapsed / LASER_DURATION, 1);
                anim.laserProgress = 1 - Math.pow(1 - t, 2);

                if (t >= 1) {
                    anim.laserProgress = 1;
                    // If correct, go to hit animation phase
                    if (anim.isCorrect) {
                        anim.phase = 'hit';
                        anim.startTime = timestamp;
                        // Create particles at slope target
                        createHitParticles();
                    } else {
                        anim.phase = 'hold';
                        anim.startTime = timestamp;
                    }
                }
                break;
            }

            case 'hit': {
                const t = Math.min(elapsed / HIT_DURATION, 1);
                // Update particles
                updateHitParticles(t);

                if (t >= 1) {
                    anim.phase = 'hold';
                    anim.startTime = timestamp;
                }
                break;
            }

            case 'hold': {
                const t = Math.min(elapsed / HOLD_DURATION, 1);
                if (t >= 1) {
                    anim.phase = 'done';
                    anim.active = false;
                    document.getElementById('btn-try').disabled = false;
                    onAnimationComplete();
                    return;
                }
                break;
            }
        }

        drawAnimFrame();
        requestAnimationFrame(animationLoop);
    }

    function createHitParticles() {
        const [tx, ty] = toPixel(state.slopeTarget.x, state.slopeTarget.y);
        anim.hitParticles = [];
        const colors = ['#f59e0b', '#ef4444', '#22c55e', '#3b82f6', '#eab308', '#f97316'];
        for (let i = 0; i < 24; i++) {
            const angle = (Math.PI * 2 * i) / 24 + (Math.random() - 0.5) * 0.3;
            const speed = 40 + Math.random() * 80;
            anim.hitParticles.push({
                x: tx,
                y: ty,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                radius: 2 + Math.random() * 4,
                color: colors[i % colors.length],
                alpha: 1,
            });
        }
    }

    function updateHitParticles(t) {
        for (const p of anim.hitParticles) {
            p.x += p.vx * 0.02;
            p.y += p.vy * 0.02;
            p.alpha = Math.max(0, 1 - t * 1.2);
            p.radius *= 0.98;
        }
    }

    function drawAnimFrame() {
        if (!ctx) return;
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);

        drawGrid();
        drawAxes();
        drawTarget();
        drawSlopeTarget();

        // Draw laser beams (behind saucer)
        if (anim.phase === 'laser' || anim.phase === 'hit' || anim.phase === 'hold') {
            drawLaserBeams(anim.saucerX, anim.saucerY, state.h, state.k, state.a, anim.laserProgress);
        }

        // Draw hit particles
        if ((anim.phase === 'hit' || anim.phase === 'hold') && anim.hitParticles.length > 0) {
            drawHitParticles();
        }

        // Draw hit glow at slope target
        if (anim.phase === 'hit') {
            const [tx, ty] = toPixel(state.slopeTarget.x, state.slopeTarget.y);
            const elapsed = performance.now() - anim.startTime;
            const t = Math.min(elapsed / HIT_DURATION, 1);
            const glowSize = 30 + 20 * Math.sin(t * Math.PI);
            const alpha = 0.6 * (1 - t);
            ctx.save();
            const grad = ctx.createRadialGradient(tx, ty, 2, tx, ty, glowSize);
            grad.addColorStop(0, `rgba(245, 158, 11, ${alpha})`);
            grad.addColorStop(0.5, `rgba(245, 158, 11, ${alpha * 0.4})`);
            grad.addColorStop(1, `rgba(245, 158, 11, 0)`);
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(tx, ty, glowSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // Draw glow around saucer
        if (anim.glowAlpha > 0) {
            drawSaucerGlow(anim.saucerX, anim.saucerY, anim.glowAlpha);
        }

        // Draw saucer
        drawSaucer(anim.saucerX, anim.saucerY, anim.phase);
    }

    function drawHitParticles() {
        ctx.save();
        for (const p of anim.hitParticles) {
            if (p.alpha <= 0) continue;
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    function onAnimationComplete() {
        if (anim.isCorrect) {
            state.solved = true;
            const stars = state.attempts + 1; // 2 tries: first try = 2 stars, second = 1
            const points = stars * 100;
            state.score += points;
            state.levelHistory.push(stars);
            saveState();
            updateUI();

            showFeedback('🎯 Direct hit! Mission complete!', 'success');
            setTimeout(() => showLevelComplete(stars, points), 1000);
        } else {
            if (state.attempts > 0) {
                const hint = generateHint();
                showFeedback('✕ ' + hint, 'fail');
                setTimeout(() => draw(), 200);
            } else {
                showFeedback('✕ Out of tries!', 'fail');
                setTimeout(() => showLevelFailed(), 1000);
            }
        }
    }

    // ── Drawing: Saucer ────────────────────────
    function drawSaucer(sx, sy, phase) {
        ctx.save();
        ctx.translate(sx, sy);

        if (phase !== 'fly') {
            const bob = Math.sin(performance.now() * 0.005) * 2;
            ctx.translate(0, bob);
        }

        // --- Body (ellipse) ---
        ctx.beginPath();
        ctx.ellipse(0, 0, 22, 8, 0, 0, Math.PI * 2);
        const bodyGrad = ctx.createLinearGradient(-22, -8, 22, 8);
        bodyGrad.addColorStop(0, '#9ca3af');
        bodyGrad.addColorStop(0.5, '#e5e7eb');
        bodyGrad.addColorStop(1, '#9ca3af');
        ctx.fillStyle = bodyGrad;
        ctx.fill();
        ctx.strokeStyle = '#6b7280';
        ctx.lineWidth = 1;
        ctx.stroke();

        // --- Dome ---
        ctx.beginPath();
        ctx.ellipse(0, -3, 11, 11, 0, Math.PI, 0);
        const domeGrad = ctx.createRadialGradient(0, -8, 2, 0, -6, 12);
        domeGrad.addColorStop(0, 'rgba(37,99,235,0.9)');
        domeGrad.addColorStop(0.6, 'rgba(37,99,235,0.4)');
        domeGrad.addColorStop(1, 'rgba(37,99,235,0.1)');
        ctx.fillStyle = domeGrad;
        ctx.fill();
        ctx.strokeStyle = 'rgba(37,99,235,0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // --- Lights on body rim ---
        const lightColors = ['#ef4444', '#22c55e', '#eab308'];
        for (let i = -2; i <= 2; i++) {
            const lx = i * 8;
            const ly = 3;
            ctx.beginPath();
            ctx.arc(lx, ly, 2, 0, Math.PI * 2);
            const flicker = Math.sin(performance.now() * 0.008 + i * 1.5) > 0 ? 1 : 0.3;
            ctx.fillStyle = lightColors[(i + 2) % 3];
            ctx.globalAlpha = flicker;
            ctx.fill();
            ctx.globalAlpha = 1;
        }

        // --- Bottom beam indicator ---
        if (phase === 'laser' || phase === 'hit' || phase === 'hold' || phase === 'glow') {
            ctx.beginPath();
            ctx.moveTo(-4, 8);
            ctx.lineTo(4, 8);
            ctx.lineTo(0, 13);
            ctx.closePath();
            ctx.fillStyle = C.laserCore;
            ctx.globalAlpha = 0.6 + 0.4 * Math.sin(performance.now() * 0.01);
            ctx.fill();
            ctx.globalAlpha = 1;
        }

        ctx.restore();
    }

    function drawSaucerGlow(sx, sy, alpha) {
        ctx.save();
        const grad = ctx.createRadialGradient(sx, sy, 5, sx, sy, 50);
        grad.addColorStop(0, `rgba(37,99,235,${0.4 * alpha})`);
        grad.addColorStop(0.5, `rgba(22,163,74,${0.15 * alpha})`);
        grad.addColorStop(1, `rgba(22,163,74,0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(sx, sy, 50, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // ── Drawing: Laser Beams (absolute value with slope a) ──
    function drawLaserBeams(sx, sy, h, k, a, progress) {
        // y = a|x - h| + k
        // Right arm: slope = +a in math coords
        //   In pixel coords: +1 unit right = +unitPx px, +a units up = -a*unitPx py
        // Left arm: slope = -a in math coords
        //   In pixel coords: -1 unit left = -unitPx px, +a units up = -a*unitPx py

        const [vx, vy] = toPixel(h, k);

        const maxExtent = Math.max(canvasWidth, canvasHeight) * 1.5;

        // Normalize directions and extend
        // Right arm direction in pixels: (unitPx, -a * unitPx)
        const rDirX = unitPx;
        const rDirY = -a * unitPx;
        const rLen = Math.sqrt(rDirX * rDirX + rDirY * rDirY);
        const rightEndX = vx + (rDirX / rLen) * maxExtent;
        const rightEndY = vy + (rDirY / rLen) * maxExtent;

        // Left arm direction in pixels: (-unitPx, -a * unitPx)
        const lDirX = -unitPx;
        const lDirY = -a * unitPx;
        const lLen = Math.sqrt(lDirX * lDirX + lDirY * lDirY);
        const leftEndX = vx + (lDirX / lLen) * maxExtent;
        const leftEndY = vy + (lDirY / lLen) * maxExtent;

        // Apply progress
        const rCurX = vx + (rightEndX - vx) * progress;
        const rCurY = vy + (rightEndY - vy) * progress;
        const lCurX = vx + (leftEndX - vx) * progress;
        const lCurY = vy + (leftEndY - vy) * progress;

        ctx.save();
        ctx.lineCap = 'round';

        // Outer glow layer
        ctx.strokeStyle = C.laserOuter;
        ctx.lineWidth = 12;
        ctx.beginPath(); ctx.moveTo(vx, vy); ctx.lineTo(rCurX, rCurY); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(vx, vy); ctx.lineTo(lCurX, lCurY); ctx.stroke();

        // Middle glow layer
        ctx.strokeStyle = C.laserGlow;
        ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(vx, vy); ctx.lineTo(rCurX, rCurY); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(vx, vy); ctx.lineTo(lCurX, lCurY); ctx.stroke();

        // Core beam
        ctx.strokeStyle = C.laserCore;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = C.laserCore;
        ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.moveTo(vx, vy); ctx.lineTo(rCurX, rCurY); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(vx, vy); ctx.lineTo(lCurX, lCurY); ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.restore();
    }

    // ── Hint Generation ────────────────────────
    function generateHint() {
        const ca = state._correct.a;
        const ch = state._correct.h;
        const ck = state._correct.k;

        // Prioritize vertex hints first
        if (state.h !== ch && state.k !== ck) {
            if (state.h < ch) return 'Try moving h to the right.';
            return 'Try moving h to the left.';
        }
        if (state.h !== ch) {
            return state.h < ch ? 'Shift h to the right.' : 'Shift h to the left.';
        }
        if (state.k !== ck) {
            return state.k < ck ? 'Move k up (larger).' : 'Move k down (smaller).';
        }
        // Vertex is correct, slope hint
        if (state.a !== ca) {
            if (Math.abs(state.a) < Math.abs(ca)) return 'The V needs to be steeper — increase |a|.';
            if (Math.abs(state.a) > Math.abs(ca)) return 'The V is too steep — decrease |a|.';
            if (state.a > 0 && ca < 0) return 'Try flipping the V upside down (negative a).';
            if (state.a < 0 && ca > 0) return 'The V should open upward (positive a).';
            return 'Adjust the slope (a).';
        }
        return 'Close! Double-check your values.';
    }

    // ── Feedback Toast ─────────────────────────
    function showFeedback(msg, type) {
        const toast = document.getElementById('feedback-toast');
        toast.style.display = 'flex';
        toast.className = 'feedback-toast ' + type;
        document.getElementById('feedback-msg').textContent = msg;
        clearTimeout(showFeedback._timer);
        showFeedback._timer = setTimeout(hideFeedback, 3500);
    }
    function hideFeedback() {
        document.getElementById('feedback-toast').style.display = 'none';
    }

    // ── Level Complete / Failed ─────────────────
    function showLevelComplete(stars, points) {
        hideFeedback();
        document.getElementById('level-complete').style.display = 'flex';

        const starEls = document.querySelectorAll('#stars-row .star');
        starEls.forEach((el, i) => {
            el.classList.remove('earned');
            if (i < stars) {
                setTimeout(() => el.classList.add('earned'), 200 + i * 200);
            }
        });

        document.getElementById('complete-title').textContent = 'Mission Success!';
        document.getElementById('complete-msg').textContent = 'All of Glaxonia Prime 3 salutes you.';
        document.getElementById('complete-points').textContent = '+' + points;
        document.getElementById('complete-attempts').textContent =
            (state.maxAttempts - state.attempts) + '/' + state.maxAttempts;
    }

    function showLevelFailed() {
        hideFeedback();
        document.getElementById('level-failed').style.display = 'flex';
        const c = state._correct;
        document.getElementById('fail-msg').textContent =
            'Glaxonon police put you in Xinothropic Galactic Jail for 2 parsecs.';
        document.getElementById('fail-answer').textContent =
            `The answer was a = ${c.a}, h = ${c.h}, k = ${c.k}.`;
    }

    function nextLevel() {
        state.level++;
        saveState();
        setupLevel();
        showGame();
    }

    function retryLevel() {
        setupLevel();
        hideOverlays();
    }

    // ── Persistence ────────────────────────────
    function saveState() {
        const toSave = { level: state.level, score: state.score, levelHistory: state.levelHistory };
        try { localStorage.setItem('vquest_state', JSON.stringify(toSave)); } catch(e) {}
    }

    function loadState() {
        try {
            const raw = localStorage.getItem('vquest_state');
            if (raw) {
                const s = JSON.parse(raw);
                state.level = s.level || 1;
                state.score = s.score || 0;
                state.levelHistory = s.levelHistory || [];
            }
        } catch(e) {}
    }

    // ═══════════════════════════════════════════
    //  STATIC CANVAS RENDERING
    // ═══════════════════════════════════════════

    function resizeCanvas() {
        const wrapper = document.getElementById('canvas-wrapper');
        const dpr = window.devicePixelRatio || 1;
        canvasWidth = wrapper.clientWidth;
        canvasHeight = wrapper.clientHeight;
        canvas.width = canvasWidth * dpr;
        canvas.height = canvasHeight * dpr;
        canvas.style.width = canvasWidth + 'px';
        canvas.style.height = canvasHeight + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const xRange = bounds.xMax - bounds.xMin;
        const yRange = bounds.yMax - bounds.yMin;
        unitPx = Math.min(canvasWidth / xRange, canvasHeight / yRange);
    }

    function toPixel(mx, my) {
        const cx = canvasWidth / 2 + mx * unitPx;
        const cy = canvasHeight / 2 - my * unitPx;
        return [cx, cy];
    }

    function draw() {
        if (!ctx) return;
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        drawGrid();
        drawAxes();
        drawTarget();
        drawSlopeTarget();
    }

    function drawGrid() {
        ctx.strokeStyle = C.grid;
        ctx.lineWidth = 1;
        for (let x = Math.ceil(bounds.xMin); x <= bounds.xMax; x++) {
            const [px] = toPixel(x, 0);
            ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, canvasHeight); ctx.stroke();
        }
        for (let y = Math.ceil(bounds.yMin); y <= bounds.yMax; y++) {
            const [, py] = toPixel(0, y);
            ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(canvasWidth, py); ctx.stroke();
        }
    }

    function drawAxes() {
        const [ox, oy] = toPixel(0, 0);
        ctx.strokeStyle = C.axis;
        ctx.lineWidth = 1.5;

        ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(canvasWidth, oy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ox, 0); ctx.lineTo(ox, canvasHeight); ctx.stroke();

        ctx.fillStyle = C.axisLabel;
        ctx.font = '11px "DM Mono", monospace';

        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        for (let x = Math.ceil(bounds.xMin); x <= bounds.xMax; x++) {
            if (x === 0) continue;
            const [px] = toPixel(x, 0);
            ctx.beginPath(); ctx.moveTo(px, oy - 3); ctx.lineTo(px, oy + 3);
            ctx.strokeStyle = C.axis; ctx.lineWidth = 1; ctx.stroke();
            ctx.fillText(x, px, oy + 6);
        }

        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let y = Math.ceil(bounds.yMin); y <= bounds.yMax; y++) {
            if (y === 0) continue;
            const [, py] = toPixel(0, y);
            ctx.beginPath(); ctx.moveTo(ox - 3, py); ctx.lineTo(ox + 3, py);
            ctx.strokeStyle = C.axis; ctx.lineWidth = 1; ctx.stroke();
            ctx.fillText(y, ox - 7, py);
        }

        ctx.textAlign = 'right'; ctx.textBaseline = 'top';
        ctx.fillText('0', ox - 5, oy + 5);
    }

    function drawTarget() {
        const [tx, ty] = toPixel(state.target.x, state.target.y);

        // Glow
        ctx.beginPath();
        ctx.arc(tx, ty, 14, 0, Math.PI * 2);
        ctx.fillStyle = C.targetGlow;
        ctx.fill();

        // Pulsing ring
        const pulse = 1 + 0.15 * Math.sin(Date.now() / 300);
        ctx.beginPath();
        ctx.arc(tx, ty, 10 * pulse, 0, Math.PI * 2);
        ctx.strokeStyle = C.target;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Center dot
        ctx.beginPath();
        ctx.arc(tx, ty, 4, 0, Math.PI * 2);
        ctx.fillStyle = C.target;
        ctx.fill();

        // Label
        ctx.fillStyle = C.target;
        ctx.font = '600 12px "Outfit", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`(${state.target.x}, ${state.target.y})`, tx + 14, ty - 6);

        // Keep pulsing
        if (!anim.active) requestAnimationFrame(draw);
    }

    function drawSlopeTarget() {
        const [tx, ty] = toPixel(state.slopeTarget.x, state.slopeTarget.y);

        // Glow
        ctx.beginPath();
        ctx.arc(tx, ty, 12, 0, Math.PI * 2);
        ctx.fillStyle = C.slopeTargetGlow;
        ctx.fill();

        // Diamond shape
        const pulse = 1 + 0.12 * Math.sin(Date.now() / 350 + 1);
        const size = 7 * pulse;
        ctx.beginPath();
        ctx.moveTo(tx, ty - size);
        ctx.lineTo(tx + size, ty);
        ctx.lineTo(tx, ty + size);
        ctx.lineTo(tx - size, ty);
        ctx.closePath();
        ctx.strokeStyle = C.slopeTarget;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Center dot
        ctx.beginPath();
        ctx.arc(tx, ty, 3, 0, Math.PI * 2);
        ctx.fillStyle = C.slopeTarget;
        ctx.fill();

        // Label
        ctx.fillStyle = C.slopeTarget;
        ctx.font = '600 12px "Outfit", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`(${state.slopeTarget.x}, ${state.slopeTarget.y})`, tx + 14, ty - 6);
    }

    // ── Boot ───────────────────────────────────
    document.addEventListener('DOMContentLoaded', () => {
        init();
        showTitle();
    });

    return {
        startNew, continueGame, showTitle, showHow,
        trySolution, confirmInput, cancelInput,
        nextLevel, retryLevel,
    };
})();
