#!/usr/bin/env node
// Run: node scripts/generate-icons.js
// Generates simple SVG icons for the PWA manifest

const fs = require('fs');
const path = require('path');

const iconSvg = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="#1a1a2e"/>
  <text x="50%" y="55%" font-size="${size * 0.55}" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif">🏨</text>
</svg>`;

const iconsDir = path.join(__dirname, '../public/icons');
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

fs.writeFileSync(path.join(iconsDir, 'icon-192.svg'), iconSvg(192));
fs.writeFileSync(path.join(iconsDir, 'icon-512.svg'), iconSvg(512));

console.log('Icons generated (SVG). For PNG, convert manually or use sharp.');
