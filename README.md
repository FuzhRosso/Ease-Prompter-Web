<p><img width="1735" height="637" alt="Logo_Ease_Prompter" src="https://github.com/user-attachments/assets/e6ea7e5e-a7fe-4c67-b39d-1aadb4564b6c" /></p>


# Ease Prompter (Web Based) 🎬

<p>Ease Prompter — A lightweight, browser-based teleprompter with speed control, adjustable text size & margins, HH:MM:SS timer, and a center-spotlight highlighter. No installation, no backend, runs entirely in your browser.
</p>
<p></p>
A clean, dark-themed teleprompter that runs entirely in your browser.
Load a folder of `.txt` scripts, hit **Play**, and read along — no install,
no account, no server. Your scripts never leave your computer.

## ✨ Features

### 📂 Script Management
- **Select Library** — pick any folder on your computer and the app
  automatically loads every `.txt` file inside it as a script.
- **Script dropdown** — switch between loaded scripts instantly.
- **Edit in-app** — modify script text without leaving the browser;
  changes are saved locally and persist across reloads.
- **Remove from list** — hide scripts you don't need (the original
  files on your disk are never touched).

### ▶️ Prompting Controls
- **Play / Pause** — start or pause scrolling with one click or the
  **Space** bar. The button visually switches between green (play)
  and red (pause).
- **Delay start** — set a countdown (1–60 s) before scrolling begins,
  with a large on-screen counter so you can get into position.
- **Reset** — jump back to the top of the script and reset the timer
  in one action.
- **Speed control** — fine-tune scroll speed with `+` / `−` buttons;
  the current value is always displayed.

### 🎨 Visual Customization
- **Font size slider** — 15 px to 120 px, applied in real time.
- **Margin sliders** — independently adjust horizontal (`↔`) and
  vertical (`↕`) padding for comfortable line width and eye line.
- **Text color picker** — any color you want, with a live swatch on
  the button.
- **Dark GitHub-inspired theme** — easy on the eyes for long sessions.

### ⏱️ Session Timer
- **HH:MM:SS timer** in the top-right corner of the text area.
- Counts only while scrolling is active — pauses freeze the timer,
  resuming continues from the same point.
- **Reset** clears it back to `00:00:00`.
- Monospaced, tabular-digit font so numbers don't jitter.

### 🎯 Center Highlighter
- **Toggleable spotlight band** pinned to the vertical center of the
  screen — dims everything above and below so your eyes lock onto the
  current line.
- The band **auto-scales with font size**, so it always covers exactly
  one line of text.
- Mask edges are soft-gradient-faded for a natural reading focus,
  with subtle accent-blue borders on the band.
- Preference is remembered across sessions.

### 🖵 Fullscreen Mode
- One click (or **Esc** to exit) hides the control panel and gives the
  script the entire screen.
- Timer and highlighter remain visible in fullscreen.

### 💾 Local-First & Private
- All scripts, settings, and preferences are stored **in your browser**
  (`localStorage` + `IndexedDB`).
- **Nothing is uploaded to any server** — your scripts never leave
  your computer.
- Reload the page and your last script, folder, highlight state, and
  visual settings are restored automatically.
- Works fully **offline** after the first load.

### 🔒 Zero Dependencies
- Pure **HTML + CSS + vanilla JavaScript** — no build step, no
  framework, no `node_modules`.
- Deploys as static files anywhere: GitHub Pages, Netlify, Vercel,
  any web host, or even `file://` for quick local testing.

### ⌨️ Keyboard Shortcuts
| Key | Action |
|-----|--------|
| `Space` | Play / Pause |
| `Esc` | Exit fullscreen / close modal |


######################################################

## 🌐 Browser Support

| Browser | Folder picker | Folder re-remembering |
|---------|---------------|----------------------|
| Chrome / Edge | ✅ Native picker | ✅ Automatic on revisit |
| Firefox / Safari | ✅ Standard file picker | ⚠️ Scripts cached, but re-pick folder after reload |

All other features (timer, highlighter, sliders, fullscreen, local
storage) work identically across all popular browsers.

## Credit
<p>Fuzh Rosso<p>
Developed by Gemini & Deepseek



