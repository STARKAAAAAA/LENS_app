// ========== 纯工具函数 ==========

export function cleanCategory(dirname) {
  const m = dirname.match(/^\d{4}\s+\d{1,2}\s+\d{1,2}\s*(.*)/);
  return (m && m[1]) ? m[1].trim() : dirname.trim();
}

export function cleanTitle(filename) {
  let name = filename.replace(/\.[^.]+$/, '');
  name = name.replace(/-DxO_DeepPRIME\s*XD2?s?/g, '');
  name = name.replace(/-CR3_DxO_DeepPRIMEXD/g, '');
  return name.trim();
}

export function preloadImages(imgs, onProgress) {
  let loaded = 0;
  const total = imgs.length;
  return Promise.all(imgs.map(img => {
    return new Promise(resolve => {
      if (img.complete) { loaded++; if (onProgress) onProgress(loaded, total); resolve(); return; }
      img.onload = () => { loaded++; if (onProgress) onProgress(loaded, total); resolve(); };
      img.onerror = () => { loaded++; if (onProgress) onProgress(loaded, total); resolve(); };
    });
  }));
}

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

// Apple-style button press feel: scale(1.22) on mousedown, spring-back on mouseup,
// exposure overlay for brightness burst. Handles !important cascade correctly.
export function addPressFeel(el) {
  const exposure = document.createElement('div');
  exposure.style.cssText = 'position:absolute;inset:0;border-radius:inherit;background:rgba(255,255,255,0.35);pointer-events:none;opacity:0;z-index:99;';
  el.appendChild(exposure);

  el.addEventListener('mouseenter', () => {
    el.style.setProperty('background', 'rgba(255,255,255,0.30)', 'important');
    el.style.setProperty('border-color', 'rgba(255,255,255,0.35)', 'important');
  });
  el.addEventListener('mouseleave', () => {
    el.style.background = 'transparent';
    el.style.setProperty('border-color', 'rgba(255,255,255,0.12)', 'important');
    el.style.removeProperty('transform');
    exposure.style.opacity = '0';
  });
  el.addEventListener('mousedown', () => {
    el.style.setProperty('transform', 'scale(1.22)', 'important');
    exposure.style.opacity = '1';
  });
  el.addEventListener('mouseup', () => {
    el.style.setProperty('transform', 'scale(1)', 'important');
    exposure.style.opacity = '0';
  });
}
