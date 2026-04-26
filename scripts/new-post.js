#!/usr/bin/env node
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('Usage: node scripts/new-post.js "Post Title" [category]');
  console.log('  category: defaults to "engineering"');
  process.exit(1);
}

const title = args[0];
const category = args[1] || 'engineering';
const date = new Date().toISOString().split('T')[0];
const slug = title
  .toLowerCase()
  .replace(/[^a-z0-9가-힣\s-]/g, '')
  .replace(/\s+/g, '-')
  .slice(0, 80);

const dir = join('src', 'content', 'blog');
const filename = `${date}-${slug}.md`;
const filepath = join(dir, filename);

if (existsSync(filepath)) {
  console.error(`Post already exists: ${filepath}`);
  process.exit(1);
}

const frontmatter = `---
title: '${title}'
description: ''
pubDate: '${date}'
category: '${category}'
tags: []
draft: true
---

<!-- Write your post content here -->
`;

writeFileSync(filepath, frontmatter, 'utf8');
console.log(`Created: ${filepath}`);
