// Test the sanitization functions

// From popup.js
function sanitizeSubPopup(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/^\/?r\//, '')
    .replace(/^r\//, '')
    .replace(/[^a-z0-9_]/g, '');
}

// From config.js sanitizeTemp
function sanitizeSubConfig(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/^\/?r\//, '');
}

const testInputs = [
  'webdev',
  'graphic_design',
  'chatgpt',
  'ChatGPT',
  'r/webdev',
  'r/graphic_design',
  '/r/ChatGPT'
];

console.log('=== POPUP SANITIZATION ===');
for (const input of testInputs) {
  console.log(`"${input}" -> "${sanitizeSubPopup(input)}"`);
}

console.log('\n=== CONFIG SANITIZATION ===');
for (const input of testInputs) {
  console.log(`"${input}" -> "${sanitizeSubConfig(input)}"`);
}

console.log('\n=== COMPARISON ===');
for (const input of testInputs) {
  const popup = sanitizeSubPopup(input);
  const config = sanitizeSubConfig(input);
  const match = popup === config ? '✓' : '✗';
  console.log(`${match} "${input}": popup="${popup}" config="${config}"`);
}
