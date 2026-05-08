// ========== 设置面板 & 快捷键面板 ==========

import { open } from '@tauri-apps/plugin-dialog';
import { saveToggles, applyTogglesUI } from './toggles.js';

// ========== 设置面板 ==========

// updateCacheDirDisplay(featureToggles)
export function updateCacheDirDisplay(featureToggles) {
  const el = document.getElementById('cache-dir-path');
  if (el) el.textContent = featureToggles.cacheDir || 'E:\\LENS\\thumbnails';
}

let _settingsInitialized = false;

// initSettingsPanel({ settingsBtn, settingsPanel, featureToggles, onToggleChange })
// onToggleChange called with (key) when sortFilter is toggled
export function initSettingsPanel({ settingsBtn, settingsPanel, featureToggles, onToggleChange }) {
  if (_settingsInitialized) return;
  _settingsInitialized = true;
  function openSettingsPanel() {
    settingsPanel.classList.add('settings-panel--open');
  }
  function closeSettingsPanel() {
    settingsPanel.classList.remove('settings-panel--open');
  }

  updateCacheDirDisplay(featureToggles);

  settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    settingsPanel.classList.contains('settings-panel--open') ? closeSettingsPanel() : openSettingsPanel();
  });

  settingsPanel.addEventListener('click', async (e) => {
    const sw = e.target.closest('.toggle-switch');
    if (sw) {
      const key = sw.dataset.key;
      featureToggles[key] = !featureToggles[key];
      saveToggles(featureToggles);
      sw.classList.toggle('toggle-switch--on', featureToggles[key]);
      applyTogglesUI(featureToggles);
      if (key === 'sortFilter') {
        if (onToggleChange) onToggleChange(key, featureToggles[key]);
      }
      return;
    }
    const db = e.target.closest('.density-btn');
    if (db) {
      featureToggles.density = db.dataset.density;
      saveToggles(featureToggles);
      applyTogglesUI(featureToggles);
      return;
    }
    const cacheBtn = e.target.closest('#cache-dir-btn');
    if (cacheBtn) {
      const selected = await open({ directory: true, multiple: false, title: '选择缓存文件夹' });
      if (selected) {
        const cachePath = selected + '\\thumbnails';
        featureToggles.cacheDir = cachePath;
        saveToggles(featureToggles);
        updateCacheDirDisplay(featureToggles);
      }
      return;
    }
  });

  document.addEventListener('click', (e) => {
    if (!settingsPanel.classList.contains('settings-panel--open')) return;
    if (!settingsPanel.contains(e.target) && e.target !== settingsBtn) {
      closeSettingsPanel();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && settingsPanel.classList.contains('settings-panel--open')) {
      closeSettingsPanel();
    }
  });
}

// ========== 快捷键面板 ==========

let _shortcutsInitialized = false;

// initShortcutsPanel({ featureToggles })
export function initShortcutsPanel({ featureToggles }) {
  if (_shortcutsInitialized) return;
  _shortcutsInitialized = true;
  const shortcutsOverlay = document.getElementById('shortcuts-overlay');
  const shortcutsBtn = document.getElementById('tb-shortcuts');
  const shortcutsPanel = shortcutsOverlay.querySelector('.shortcuts-panel');
  let shortcutsClosing = false;

  function openShortcuts() {
    // 中断正在进行的关闭动画
    if (shortcutsClosing) {
      shortcutsClosing = false;
      shortcutsPanel.classList.remove('shortcuts-panel--out');
    }
    shortcutsOverlay.classList.add('shortcuts-overlay--open');
    // 共享 overflow 锁（与 dev panel 协调）
    const lock = window.__lensOverflowLock = (window.__lensOverflowLock || 0) + 1;
    if (lock === 1) document.body.style.overflow = 'hidden';
  }
  function closeShortcuts() {
    if (shortcutsClosing) return;
    shortcutsClosing = true;
    shortcutsPanel.classList.add('shortcuts-panel--out');
    shortcutsOverlay.classList.remove('shortcuts-overlay--open');
    const cleanup = () => {
      shortcutsPanel.removeEventListener('animationend', onEnd);
      shortcutsPanel.classList.remove('shortcuts-panel--out');
      shortcutsClosing = false;
      window.__lensOverflowLock = Math.max(0, (window.__lensOverflowLock || 0) - 1);
      if (window.__lensOverflowLock === 0) document.body.style.overflow = '';
    };
    const onEnd = (e) => {
      if (e.animationName !== 'panelDissolve') return;
      cleanup();
    };
    shortcutsPanel.addEventListener('animationend', onEnd);
    setTimeout(cleanup, 500); // 兜底
  }
  function toggleShortcuts() {
    if (shortcutsOverlay.classList.contains('shortcuts-overlay--open')) {
      closeShortcuts();
    } else {
      openShortcuts();
    }
  }

  shortcutsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!featureToggles.shortcuts) return;
    toggleShortcuts();
  });
  shortcutsOverlay.addEventListener('click', (e) => {
    if (e.target === shortcutsOverlay) toggleShortcuts();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === '?' && featureToggles.shortcuts) {
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      // 灯箱或幻灯片激活时不打开快捷键面板
      if (document.getElementById('lightbox')?.classList.contains('active')) return;
      if (document.getElementById('slideshow')?.classList.contains('active')) return;
      e.preventDefault();
      toggleShortcuts();
    }
    if (e.key === 'Escape' && shortcutsOverlay.classList.contains('shortcuts-overlay--open')) {
      toggleShortcuts();
    }
  });
}
