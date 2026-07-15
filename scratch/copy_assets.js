import fs from 'fs';
import path from 'path';

const src = 'd:\\stock_courier\\assets\\video-erasio.mp4';
const dest = 'd:\\nulip-new.worktrees\\copilot-worktree-2026-05-21T10-17-55\\apps\\portal\\public\\assets\\video-erasio.mp4';

console.log('Copying from', src, 'to', dest);

try {
  fs.copyFileSync(src, dest);
  console.log('Copy successful!');
} catch (err) {
  console.error('Error copying file:', err);
}
