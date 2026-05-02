// ========== 设置面板 & 快捷键面板 ==========

import { open } from '@tauri-apps/plugin-dialog';
import { saveToggles, applyTogglesUI } from './toggles.js';

// ========== 设置面板 ==========

// updateCacheDirDisplay(featureToggles)
export function updateCacheDirDisplay(featureToggles) {
  const el = document.getElementById('cache-dir-path');
  if (el) el.textContent = featureToggles.cacheDir || 'E:\\LENS\\thumbnails';
}

// initSettingsPanel({ settingsBtn, settingsPanel, featureToggles, onToggleChange })
// onToggleChange called with (key) when sortFilter is toggled
export function initSettingsPanel({ settingsBtn, settingsPanel, featureToggles, onToggleChange }) {
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

// initShortcutsPanel({ featureToggles })
export function initShortcutsPanel({ featureToggles }) {
  const shortcutsOverlay = document.getElementById('shortcuts-overlay');
  const shortcutsBtn = document.getElementById('tb-shortcuts');
  const shortcutsPanel = shortcutsOverlay.querySelector('.shortcuts-panel');
  let shortcutsClosing = false;

  function openShortcuts() {
    shortcutsOverlay.classList.add('shortcuts-overlay--open');
    shortcutsPanel.classList.remove('shortcuts-panel--out');
    document.body.style.overflow = 'hidden';
  }
  function closeShortcuts() {
    if (shortcutsClosing) return;
    shortcutsClosing = true;
    shortcutsPanel.classList.add('shortcuts-panel--out');
    shortcutsOverlay.classList.remove('shortcuts-overlay--open');
    const onEnd = () => {
      shortcutsPanel.removeEventListener('animationend', onEnd);
      shortcutsPanel.classList.remove('shortcuts-panel--out');
      shortcutsClosing = false;
      document.body.style.overflow = '';
    };
    shortcutsPanel.addEventListener('animationend', onEnd);
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
      e.preventDefault();
      toggleShortcuts();
    }
    if (e.key === 'Escape' && shortcutsOverlay.classList.contains('shortcuts-overlay--open')) {
      toggleShortcuts();
    }
  });
}
