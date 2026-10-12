#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { LABELS, RCLONE_PROVIDERS } = require('./lib/providers.cjs');

const DATA = path.join(os.homedir(), 'Library/Application Support/PanMover');

function help() {
  console.log(`WeMove CLI 0.9.1

Usage:
  wemove version
  wemove providers
  wemove status
  wemove jobs
  wemove list <provider> [path]
  wemove copy <srcProvider> <srcPath> <dstProvider> <dstPath> [names...]
  wemove help

Examples:
  wemove list ali /
  wemove copy ali /docs baidu /backup "*.pdf" "report*.docx"

Requires a running WeMove desktop instance (session-url.txt).
`);
}

async function session() {
  const file = path.join(DATA, 'session-url.txt');
  if (!fs.existsSync(file)) throw Error('WeMove 未运行。请先打开桌面应用。');
  const url = fs.readFileSync(file, 'utf8').trim();
  const u = new URL(url);
  return { host: u.host, key: u.searchParams.get('key') };
}

function api(pathname, body = {}) {
  return session().then(({ host, key }) => new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      host: host.split(':')[0],
      port: host.split(':')[1],
      path: pathname + '?key=' + key,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), Host: host }
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(raw || '{}');
          if (res.statusCode >= 400) reject(Error(j.error || raw));
          else resolve(j);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.end(data);
  }));
}

function getState() {
  return session().then(({ host, key }) => new Promise((resolve, reject) => {
    http.get(`http://${host}/state?key=${key}`, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  }));
}

const [cmd, ...args] = process.argv.slice(2);

(async () => {
  try {
    switch (cmd || 'help') {
      case 'version':
      case '-v':
      case '--version':
        console.log('WeMove 0.9.1');
        break;
      case 'providers':
        console.log('Supported providers:');
        for (const [id, label] of Object.entries(LABELS)) {
          console.log(`  ${id.padEnd(12)} ${label}${RCLONE_PROVIDERS.includes(id) ? ' (rclone)' : ''}`);
        }
        break;
      case 'status': {
        const s = await getState();
        console.log(`运行中任务: ${s.jobs.filter(j => !['complete','canceled','paused','failed','queued'].includes(j.status)).length}`);
        console.log(`排队任务: ${s.jobs.filter(j => j.status === 'queued').length}`);
        console.log(`忙碌: ${s.busy ? '是' : '否'}`);
        break;
      }
      case 'jobs': {
        const s = await getState();
        if (!s.jobs.length) return console.log('暂无任务');
        for (const j of s.jobs.slice(0, 20)) {
          console.log(`${j.id.slice(0,8)}  ${j.status.padEnd(12)}  ${j.done}/${j.total}  ${j.names.slice(0,2).join(', ')}`);
        }
        break;
      }
      case 'list': {
        const [provider, p = '/'] = args;
        if (!provider) throw Error('用法: wemove list <provider> [path]');
        const r = await api('/list', { ref: { provider, path: p } });
        for (const e of (r.items || []).slice(0, 50)) {
          console.log(`${e.isDir ? 'D' : 'F'}  ${(e.size || 0).toString().padStart(10)}  ${e.name}`);
        }
        if ((r.items || []).length > 50) console.log(`... 共 ${r.items.length} 项`);
        break;
      }
      case 'copy': {
        let [srcP, srcPath, dstP, dstPath, ...patterns] = args;
        if (!srcP || !dstP || !patterns.length) throw Error('用法: wemove copy <srcProvider> <srcPath> <dstProvider> <dstPath> <name|pattern...>');
        // Normalize paths
        srcPath = srcPath.startsWith('/') ? srcPath : '/' + srcPath;
        dstPath = dstPath.startsWith('/') ? dstPath : '/' + dstPath;
        let names = [];
        const hasWildcard = patterns.some(p => /[*?]/.test(p));
        if (hasWildcard) {
          const listed = await api('/list', { ref: { provider: srcP, path: srcPath } });
          const items = listed.items || [];
          for (const pat of patterns) {
            if (/[*?]/.test(pat)) {
              const re = new RegExp('^' + pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');
              names.push(...items.filter(e => re.test(e.name)).map(e => e.name));
            } else names.push(pat);
          }
          names = [...new Set(names)];
          if (!names.length) throw Error('通配符未匹配到任何项目');
          const dirs = names.filter(n => items.find(e => e.name === n)?.isDir).length;
          console.log(`匹配到 ${names.length} 项（文件 ${names.length - dirs}，目录 ${dirs}）`);
        } else names = patterns;
        console.log(`目标: ${dstP}:${dstPath}`);
        const r = await api('/copy', {
          source: { provider: srcP, path: srcPath },
          target: { provider: dstP, path: dstPath },
          names
        });
        console.log('已加入队列:', r.id);
        break;
      }
      case 'help':
      case '-h':
      case '--help':
      default:
        help();
    }
  } catch (e) {
    console.error('错误:', e.message);
    process.exit(1);
  }
})();
