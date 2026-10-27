/* =============================================================
 * Ease Prompter — Web Edition
 * Port dari ease_prompter_dark.py + Timer + Highlighter
 * ============================================================= */
(() => {
  'use strict';

  /* -----------------------------------------------------------
   * KONSTANTA
   * ----------------------------------------------------------- */
  const CONFIG_KEY     = 'easePrompter.config';
  const IDB_NAME       = 'easePrompterDB';
  const IDB_VERSION    = 1;
  const STORE_SCRIPTS  = 'scripts';
  const STORE_META     = 'meta';

  const $ = (id) => document.getElementById(id);

  /* -----------------------------------------------------------
   * STATE
   * ----------------------------------------------------------- */
  const state = {
    isPlaying:        false,
    isFullscreen:     false,
    scrollSpeed:      30,
    fontSize:         36,
    textColor:        '#c9d1d9',
    marginX:          100,
    marginY:          50,
    scripts:          {},
    currentScript:    '',
    lastFolderName:   '',
    folderHandle:     null,
    rafId:            null,
    lastFrameTime:    0,
    scrollAccum:      0,
    countdownTimer:   null,
    editingScript:    null,
    db:               null,

    // === NEW: Timer ===
    elapsedMs:        0,       // total terakumulasi saat pause
    timerStartedAt:   0,       // performance.now() saat mulai play
    timerRafId:       null,

    // === NEW: Highlighter ===
    isHighlight:      false,
  };

  let dom = {};

  /* =============================================================
   * INDEXEDDB
   * ============================================================= */
  function openDB() {
    if (state.db) return Promise.resolve(state.db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_SCRIPTS)) db.createObjectStore(STORE_SCRIPTS);
        if (!db.objectStoreNames.contains(STORE_META))    db.createObjectStore(STORE_META);
      };
      req.onsuccess = () => { state.db = req.result; resolve(state.db); };
      req.onerror   = () => reject(req.error);
    });
  }
  async function idbPut(store, key, value) {
    const db = await openDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).put(value, key);
      tx.oncomplete = () => res();
      tx.onerror    = () => rej(tx.error);
    });
  }
  async function idbGet(store, key) {
    const db = await openDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(key);
      req.onsuccess = () => res(req.result);
      req.onerror   = () => rej(req.error);
    });
  }
  async function idbDelete(store, key) {
    const db = await openDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).delete(key);
      tx.oncomplete = () => res();
      tx.onerror    = () => rej(tx.error);
    });
  }
  async function idbKeys(store) {
    const db = await openDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAllKeys();
      req.onsuccess = () => res(req.result);
      req.onerror   = () => rej(req.error);
    });
  }
  async function idbClear(store) {
    const db = await openDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).clear();
      tx.oncomplete = () => res();
      tx.onerror    = () => rej(tx.error);
    });
  }

  /* =============================================================
   * KONFIGURASI
   * ============================================================= */
  function loadConfig() {
    try { return JSON.parse(localStorage.getItem(CONFIG_KEY)) || {}; }
    catch { return {}; }
  }

  function saveConfig() {
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify({
        lastFolder:   state.lastFolderName,
        lastScript:   state.currentScript,
        isHighlight:  state.isHighlight,   // === NEW ===
      }));
    } catch (e) { console.warn('saveConfig failed', e); }
  }

  /* =============================================================
   * CACHE SKRIP
   * ============================================================= */
  async function persistScripts() {
    try {
      await idbClear(STORE_SCRIPTS);
      for (const [title, data] of Object.entries(state.scripts)) {
        await idbPut(STORE_SCRIPTS, title, data);
      }
    } catch (e) { console.warn('persistScripts', e); }
  }

  async function restoreScripts() {
    try {
      const keys = await idbKeys(STORE_SCRIPTS);
      const out = {};
      for (const k of keys) out[k] = await idbGet(STORE_SCRIPTS, k);
      state.scripts = out;
    } catch (e) { console.warn('restoreScripts', e); }
  }

  /* =============================================================
   * TOAST
   * ============================================================= */
  let toastTimer = null;
  function showToast(msg, ms = 3000) {
    dom.toast.textContent = msg;
    dom.toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      dom.toast.classList.remove('show');
      toastTimer = null;
    }, ms);
  }

  /* =============================================================
   * === NEW: TIMER ===
   * Akumulasi elapsed selama playing; freeze saat pause; reset
   * bersama resetScroll.
   * ============================================================= */
  function formatHMS(ms) {
    const totalSec = Math.floor(ms / 1000);
    const h   = Math.floor(totalSec / 3600);
    const m   = Math.floor((totalSec % 3600) / 60);
    const s   = totalSec % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  function renderTimer() {
    const total = state.elapsedMs +
      (state.isPlaying && state.timerStartedAt
        ? performance.now() - state.timerStartedAt
        : 0);
    dom.timerDisplay.textContent = formatHMS(total);
  }

  function startTimerLoop() {
    if (state.timerRafId) return;             // idempoten
    state.timerStartedAt = performance.now();
    state.timerRafId = requestAnimationFrame(timerLoop);
  }

  function stopTimerLoop() {
    if (state.timerRafId) {
      cancelAnimationFrame(state.timerRafId);
      state.timerRafId = null;
    }
    if (state.timerStartedAt) {
      state.elapsedMs += performance.now() - state.timerStartedAt;
      state.timerStartedAt = 0;
    }
    renderTimer();                            // pastikan label sinkron
  }

  function timerLoop(now) {
    if (!state.isPlaying) return;
    const total = state.elapsedMs + (now - state.timerStartedAt);
    dom.timerDisplay.textContent = formatHMS(total);
    state.timerRafId = requestAnimationFrame(timerLoop);
  }

  function resetTimer() {
    state.elapsedMs = 0;
    state.timerStartedAt = state.isPlaying ? performance.now() : 0;
    dom.timerDisplay.textContent = '00:00:00';
  }

  /* =============================================================
   * === NEW: HIGHLIGHTER ===
   * ============================================================= */
  function setHighlight(on) {
    state.isHighlight = !!on;
    dom.highlighter.classList.toggle('visible', state.isHighlight);
    dom.btnHighlight.classList.toggle('btn-active', state.isHighlight);
    dom.btnHighlight.setAttribute('aria-pressed', String(state.isHighlight));
  }

  function toggleHighlight() {
    setHighlight(!state.isHighlight);
    saveConfig();
  }

  /* =============================================================
   * MANAJEMEN SKRIP
   * ============================================================= */
  function updateDropdown() {
    const dd = dom.scriptDropdown;
    dd.innerHTML = '';
    const titles = Object.keys(state.scripts);
    if (titles.length === 0) {
      const o = document.createElement('option');
      o.value = ''; o.textContent = '— No scripts loaded —';
      dd.appendChild(o);
      return;
    }
    for (const t of titles) {
      const o = document.createElement('option');
      o.value = t; o.textContent = t;
      dd.appendChild(o);
    }
  }

  function loadScript(title) {
    title = title || dom.scriptDropdown.value;
    if (!title || !state.scripts[title]) return;
    pausePrompter();
    state.currentScript = title;
    const content = state.scripts[title].content;
    dom.prompterText.textContent = `--- ${title} ---\n\n${content}\n\n[ END ]`;
    resetScroll();          // reset scroll + timer
    saveConfig();
    document.activeElement?.blur();
  }

  async function replaceScripts(newScripts) {
    state.scripts = newScripts;
    await persistScripts();
    updateDropdown();
    const titles = Object.keys(newScripts);
    if (titles.length) {
      dom.scriptDropdown.value = titles[0];
      loadScript(titles[0]);
    } else {
      state.currentScript = '';
      dom.prompterText.textContent = '';
    }
  }

  /* -------- Select Library -------- */
  async function selectLibrary() {
    pausePrompter();

    if (typeof window.showDirectoryPicker === 'function') {
      let dir;
      try {
        dir = await window.showDirectoryPicker({ mode: 'read' });
      } catch (e) {
        if (e.name !== 'AbortError') console.error(e);
        return;
      }
      try {
        const loaded = {};
        let count = 0;
        for await (const entry of dir.values()) {
          if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.txt')) {
            const file = await entry.getFile();
            const title = entry.name.replace(/\.txt$/i, '');
            loaded[title] = { content: (await file.text()).trim() };
            count++;
          }
        }
        if (count === 0) {
          showToast('No .txt files found in that folder.');
          return;
        }
        state.folderHandle  = dir;
        state.lastFolderName = dir.name;
        try { await idbPut(STORE_META, 'folderHandle', dir); } catch {}
        await replaceScripts(loaded);
        saveConfig();
        showToast(`Loaded ${count} script(s) from "${dir.name}".`);
      } catch (e) {
        console.error(e);
        showToast('Failed to read folder: ' + e.message);
      }
      return;
    }

    dom.folderInput.click();
  }

  async function handleFolderInput(e) {
    pausePrompter();
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const loaded = {};
    let count = 0;
    for (const file of files) {
      if (file.name.toLowerCase().endsWith('.txt')) {
        const title = file.name.replace(/\.txt$/i, '');
        loaded[title] = { content: (await file.text()).trim() };
        count++;
      }
    }
    dom.folderInput.value = '';

    if (count === 0) { showToast('No .txt files found.'); return; }

    const firstPath = files[0].webkitRelativePath || '';
    state.lastFolderName = firstPath.split('/')[0] || 'Folder';
    await replaceScripts(loaded);
    saveConfig();
    showToast(`Loaded ${count} script(s).`);
  }

  /* -------- Edit Script -------- */
  function openEditModal() {
    const title = state.currentScript;
    if (!title || !state.scripts[title]) return;
    pausePrompter();
    state.editingScript = title;
    dom.modalTitle.textContent = `Edit Script: ${title}`;
    dom.editTextarea.value = state.scripts[title].content;
    dom.editModal.classList.remove('hidden');
    setTimeout(() => dom.editTextarea.focus(), 0);
  }

  function closeEditModal() {
    dom.editModal.classList.add('hidden');
    state.editingScript = null;
  }

  async function saveEdit() {
    const title = state.editingScript;
    if (!title) return;
    const newContent = dom.editTextarea.value.trim();
    if (newContent) {
      state.scripts[title].content = newContent;
      try { await idbPut(STORE_SCRIPTS, title, state.scripts[title]); } catch {}
      loadScript(title);
    }
    closeEditModal();
  }

  /* -------- Delete Script -------- */
  async function deleteScript() {
    const title = state.currentScript;
    if (!title || !state.scripts[title]) return;
    pausePrompter();

    if (!confirm(`Remove script "${title}" from the list? (The original file won't be deleted)`)) return;

    delete state.scripts[title];
    try { await idbDelete(STORE_SCRIPTS, title); } catch {}
    updateDropdown();

    const remaining = Object.keys(state.scripts);
    if (remaining.length) {
      dom.scriptDropdown.value = remaining[0];
      loadScript(remaining[0]);
    } else {
      dom.scriptDropdown.value = '';
      state.currentScript = '';
      dom.prompterText.textContent = '';
      saveConfig();
    }
  }

  /* =============================================================
   * KONTROL PROMPTER
   * ============================================================= */
  function pausePrompter() {
    if (state.isPlaying) togglePlay();
  }

  function togglePlay() {
    if (Object.keys(state.scripts).length === 0 || !state.currentScript) return;
    state.isPlaying = !state.isPlaying;

    if (state.isPlaying) {
      dom.btnPlay.textContent = '⏸ Pause (Space)';
      dom.btnPlay.classList.remove('btn-primary');
      dom.btnPlay.classList.add('btn-danger');

      dom.prompterViewport.classList.add('is-playing');     // === NEW ===

      state.lastFrameTime = performance.now();
      state.scrollAccum  = 0;
      state.rafId = requestAnimationFrame(scrollLoop);
      startTimerLoop();                                     // === NEW ===
    } else {
      dom.btnPlay.textContent = '▶ Play (Space)';
      dom.btnPlay.classList.remove('btn-danger');
      dom.btnPlay.classList.add('btn-primary');

      dom.prompterViewport.classList.remove('is-playing');  // === NEW ===

      if (state.rafId) {
        cancelAnimationFrame(state.rafId);
        state.rafId = null;
      }
      stopTimerLoop();                                      // === NEW ===
    }
  }

  function scrollLoop(timestamp) {
    if (!state.isPlaying) return;
    const dt = Math.min(Math.max(timestamp - state.lastFrameTime, 0), 100);
    state.lastFrameTime = timestamp;

    state.scrollAccum += dt / state.scrollSpeed;
    const px = Math.floor(state.scrollAccum);
    if (px > 0) {
      dom.prompterScreen.scrollTop += px;
      state.scrollAccum -= px;
    }
    state.rafId = requestAnimationFrame(scrollLoop);
  }

  function resetScroll() {
    dom.prompterScreen.scrollTop = 0;
    resetTimer();                                           // === NEW ===
  }

  /* =============================================================
   * DELAY / COUNTDOWN
   * ============================================================= */
  function cancelCountdown() {
    if (state.countdownTimer) {
      clearTimeout(state.countdownTimer);
      state.countdownTimer = null;
    }
    dom.countdownOverlay.classList.add('hidden');
  }

  async function startDelay() {
    document.activeElement?.blur();
    cancelCountdown();
    let secs = parseInt(dom.delayInput.value, 10);
    if (isNaN(secs)) secs = 3;

    if (secs > 0) {
      pausePrompter();
      await runCountdown(secs);
      if (!state.isPlaying) togglePlay();
    } else {
      togglePlay();
    }
  }

  function runCountdown(seconds) {
    return new Promise((resolve) => {
      dom.countdownNumber.textContent = String(seconds);
      dom.countdownOverlay.classList.remove('hidden');
      let remaining = seconds;

      const tick = () => {
        remaining--;
        if (remaining > 0) {
          dom.countdownNumber.textContent = String(remaining);
          dom.countdownNumber.style.animation = 'none';
          void dom.countdownNumber.offsetWidth;
          dom.countdownNumber.style.animation = '';
          state.countdownTimer = setTimeout(tick, 1000);
        } else {
          dom.countdownOverlay.classList.add('hidden');
          state.countdownTimer = null;
          resolve();
        }
      };
      state.countdownTimer = setTimeout(tick, 1000);
    });
  }

  /* =============================================================
   * FULLSCREEN
   * ============================================================= */
  function enterFullscreen() {
    dom.app.classList.add('fullscreen');
    state.isFullscreen = true;
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (req) {
      try { req.call(el)?.catch?.(() => {}); } catch {}
    }
    document.activeElement?.blur();
  }

  function exitFullscreen() {
    dom.app.classList.remove('fullscreen');
    state.isFullscreen = false;
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }

  /* =============================================================
   * SPEED / SLIDER / COLOR
   * ============================================================= */
  function changeSpeed(delta) {
    if (state.scrollSpeed + delta > 0) {
      state.scrollSpeed += delta;
      dom.speedLabel.textContent = String(state.scrollSpeed);
    }
  }

  function applyTextColor(color) {
    state.textColor = color;
    document.documentElement.style.setProperty('--prompter-text-color', color);
    dom.colorSwatch.style.background = color;
    dom.colorPicker.value = color;
  }

  /* =============================================================
   * KEYBOARD SHORTCUT
   * ============================================================= */
  function handleKeydown(e) {
    const tag = document.activeElement?.tagName;
    const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

    if (e.code === 'Escape') {
      if (!dom.editModal.classList.contains('hidden')) {
        e.preventDefault();
        closeEditModal();
        return;
      }
      if (state.isFullscreen) {
        e.preventDefault();
        exitFullscreen();
        return;
      }
    }

    if (inField) return;

    if (e.code === 'Space') {
      e.preventDefault();
      togglePlay();
    }
  }

  /* =============================================================
   * INIT
   * ============================================================= */
  async function init() {
    dom = {
      app:              $('app'),
      controlPanel:     $('controlPanel'),
      prompterViewport: $('prompterViewport'),   // === NEW ===
      prompterScreen:   $('prompterScreen'),
      prompterText:     $('prompterText'),
      timerDisplay:     $('timerDisplay'),       // === NEW ===
      highlighter:      $('highlighter'),        // === NEW ===
      btnHighlight:     $('btnHighlight'),       // === NEW ===
      btnSelectLibrary: $('btnSelectLibrary'),
      scriptDropdown:   $('scriptDropdown'),
      btnEdit:          $('btnEdit'),
      btnRemove:        $('btnRemove'),
      btnFullscreen:    $('btnFullscreen'),
      btnPlay:          $('btnPlay'),
      delayInput:       $('delayInput'),
      btnStartDelay:    $('btnStartDelay'),
      btnReset:         $('btnReset'),
      btnSpeedMinus:    $('btnSpeedMinus'),
      btnSpeedPlus:     $('btnSpeedPlus'),
      speedLabel:       $('speedLabel'),
      fontSlider:       $('fontSlider'),
      marginXSlider:    $('marginXSlider'),
      marginYSlider:    $('marginYSlider'),
      btnColor:         $('btnColor'),
      colorPicker:      $('colorPicker'),
      colorSwatch:      $('colorSwatch'),
      countdownOverlay: $('countdownOverlay'),
      countdownNumber:  $('countdownNumber'),
      editModal:        $('editModal'),
      modalTitle:       $('modalTitle'),
      editTextarea:     $('editTextarea'),
      btnCancelEdit:    $('btnCancelEdit'),
      btnSaveEdit:      $('btnSaveEdit'),
      toast:            $('toast'),
      folderInput:      $('folderInput'),
    };

    /* --- Event listeners --- */
    dom.btnSelectLibrary.addEventListener('click', selectLibrary);
    dom.scriptDropdown.addEventListener('change', (e) => loadScript(e.target.value));
    dom.btnEdit.addEventListener('click', openEditModal);
    dom.btnRemove.addEventListener('click', deleteScript);
    dom.btnFullscreen.addEventListener('click', enterFullscreen);
    dom.btnPlay.addEventListener('click', () => { document.activeElement?.blur(); togglePlay(); });
    dom.btnStartDelay.addEventListener('click', startDelay);
    dom.btnReset.addEventListener('click', resetScroll);
    dom.btnHighlight.addEventListener('click', toggleHighlight);       // === NEW ===

    dom.btnSpeedMinus.addEventListener('click', () => changeSpeed(5));
    dom.btnSpeedPlus .addEventListener('click', () => changeSpeed(-5));

    dom.btnColor.addEventListener('click', () => dom.colorPicker.click());
    dom.colorPicker.addEventListener('input', (e) => applyTextColor(e.target.value));

    dom.btnCancelEdit.addEventListener('click', closeEditModal);
    dom.btnSaveEdit  .addEventListener('click', saveEdit);
    dom.folderInput  .addEventListener('change', handleFolderInput);

    dom.fontSlider.addEventListener('input', (e) => {
      const v = parseInt(e.target.value, 10);
      state.fontSize = v;
      document.documentElement.style.setProperty('--font-size', `${v}px`);
      // --highlighter-height pakai calc(var(--font-size)), jadi otomatis ikut
    });
    dom.marginXSlider.addEventListener('input', (e) => {
      const v = parseInt(e.target.value, 10);
      state.marginX = v;
      document.documentElement.style.setProperty('--margin-x', `${v}px`);
    });
    dom.marginYSlider.addEventListener('input', (e) => {
      const v = parseInt(e.target.value, 10);
      state.marginY = v;
      document.documentElement.style.setProperty('--margin-y', `${v}px`);
    });

    document.addEventListener('keydown', handleKeydown);

    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement && state.isFullscreen) {
        dom.app.classList.remove('fullscreen');
        state.isFullscreen = false;
      }
    });

    /* --- Terapkan default visual --- */
    dom.fontSlider.value    = state.fontSize;
    dom.marginXSlider.value = state.marginX;
    dom.marginYSlider.value = state.marginY;
    dom.speedLabel.textContent = String(state.scrollSpeed);
    applyTextColor(state.textColor);
    document.documentElement.style.setProperty('--font-size', `${state.fontSize}px`);
    document.documentElement.style.setProperty('--margin-x', `${state.marginX}px`);
    document.documentElement.style.setProperty('--margin-y', `${state.marginY}px`);

    // Timer & highlight baseline
    dom.timerDisplay.textContent = '00:00:00';
    setHighlight(false);

    /* --- Restore state --- */
    const cfg = loadConfig();
    await restoreScripts();

    if (Object.keys(state.scripts).length === 0) {
      state.scripts = {
        'User Guide': {
          content:
            'This is the guide text for Ease Prompter.\n\n' +
            'Click "Select Library" to choose a folder on your computer containing *.txt files.\n\n' +
            'Use the SLIDERS below to precisely adjust text size and margins.\n\n' +
            'Good luck!' +
            '\n\n(Additional text for scrolling effect...)'.repeat(15),
        },
      };
      await persistScripts();
    }

    updateDropdown();

    const titles = Object.keys(state.scripts);
    const pick = (cfg.lastScript && state.scripts[cfg.lastScript])
      ? cfg.lastScript
      : titles[0];
    if (pick) {
      dom.scriptDropdown.value = pick;
      loadScript(pick);
    }

    // === NEW: restore highlight preference ===
    if (cfg.isHighlight) setHighlight(true);

    /* --- Restore folder handle --- */
    if (cfg.lastFolder) {
      state.lastFolderName = cfg.lastFolder;
      try {
        const handle = await idbGet(STORE_META, 'folderHandle');
        if (handle) {
          state.folderHandle = handle;
          if (handle.name) state.lastFolderName = handle.name;

          let perm = 'prompt';
          try { perm = await handle.queryPermission({ mode: 'read' }); } catch {}

          if (perm === 'granted') {
            const loaded = {};
            for await (const entry of handle.values()) {
              if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.txt')) {
                const file = await entry.getFile();
                loaded[entry.name.replace(/\.txt$/i, '')] = {
                  content: (await file.text()).trim(),
                };
              }
            }
            if (Object.keys(loaded).length) {
              await replaceScripts(loaded);
              const pick2 = (cfg.lastScript && loaded[cfg.lastScript])
                ? cfg.lastScript
                : Object.keys(loaded)[0];
              if (pick2) {
                dom.scriptDropdown.value = pick2;
                loadScript(pick2);
              }
            }
          }
        }
      } catch (e) { /* silent */ }
    }

    // Sinkron ulang setelah semua async selesai
    dom.timerDisplay.textContent = '00:00:00';
  }

  document.addEventListener('DOMContentLoaded', init);
})();