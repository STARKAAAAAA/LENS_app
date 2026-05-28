const fs = require('fs');
let s = fs.readFileSync('src/js/dev-panel.js', 'utf8');

// Find the broken section and fix it
s = s.replace(
  /const bp = rv\('blur', 6\), sat = rv\('saturate', 1\.3\), rf = rv\('refraction', 150\);\s*\n\s*const w = rv\('width', BASE_W\), h = rv\('height', BASE_H\);\s*\n\s*const effectiveRefraction = rf \* scale;/,
  "const bp = rv('blur', 6), sat = rv('saturate', 1.3), rf = rv('refraction', 150);\n\t    const depth = rv('depth', 10);\n\t    const w = rv('width', BASE_W), h = rv('height', BASE_H);"
);

// Fix effectiveBlur reference
s = s.replace('effectiveBlur.toFixed(1)', 'bp.toFixed(1)');

// Fix setRefraction call
s = s.replace("st.setRefraction(effectiveRefraction); st.updateControls", "st.setRefraction(rf); st.setDepth(depth); st.updateControls");

fs.writeFileSync('src/js/dev-panel.js', s);
console.log('Fixed');
