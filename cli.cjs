#!/usr/bin/env node
'use strict';
/**
 * WeMove CLI (skeleton)
 * Usage:
 *   node cli.cjs version
 *   node cli.cjs providers
 *   node cli.cjs help
 */
const {LABELS, RCLONE_PROVIDERS} = require('./lib/providers.cjs');

function help() {
  console.log(`WeMove CLI 0.9.1

Usage:
  we-move version          Show version
  we-move providers        List supported providers
  we-move help             Show this help

Future:
  we-move list <provider> <path>
  we-move copy <src> <dst>
  we-move sync <plan>

Note: Full transfer commands require authenticated sessions.
Currently a foundation for scripting and automation.
`);
}

const cmd = process.argv[2] || 'help';

switch (cmd) {
  case 'version':
  case '-v':
  case '--version':
    console.log('WeMove 0.9.1');
    break;
  case 'providers':
  case 'list-providers':
    console.log('Supported providers:');
    for (const [id, label] of Object.entries(LABELS)) {
      const tag = RCLONE_PROVIDERS.includes(id) ? ' (rclone)' : '';
      console.log(`  ${id.padEnd(12)} ${label}${tag}`);
    }
    break;
  case 'help':
  case '-h':
  case '--help':
  default:
    help();
    break;
}
