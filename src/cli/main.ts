#!/usr/bin/env node

import 'dotenv/config';
import { Command } from 'commander';
import { runLearnCommand } from './cmd.learn.js';
import { runInstallCommand } from './cmd.install.js';
import { runAddCommand } from './cmd.add.js';
import { runDiffCommand } from './cmd.diff.js';
import { runMixCommand } from './cmd.mix.js';

const program = new Command();

program
  .name('design-memory')
  .description('Extract and interpret design systems from websites')
  .version('0.1.0');

program
  .command('learn')
  .description('Learn a design system from a URL or local image')
  .argument('<url>', 'URL to crawl and analyze (or local image path with --from-image)')
  .option('--api-key <key>', 'API key (or set OPENAI_API_KEY / ANTHROPIC_API_KEY env var)')
  .option('--model <model>', 'LLM model to use', 'gpt-4o-mini')
  .option('--provider <provider>', 'LLM provider: openai or anthropic (auto-detected from env vars)')
  .option('--from-image', 'Learn from a local screenshot/image instead of a URL')
  .option('--pages <urls...>', 'Additional URLs to crawl (multi-page mode)')
  .option('--no-cache', 'Skip crawl cache and re-acquire from scratch')
  .option('--project-root <path>', 'Project root directory', process.cwd())
  .action(runLearnCommand);

program
  .command('install')
  .description('Install design memory to current project')
  .action(runInstallCommand);

program
  .command('add')
  .description('Add a design memory package (stub)')
  .argument('<package>', 'Package name')
  .action(runAddCommand);

program
  .command('diff')
  .description('Compare design systems of two URLs')
  .argument('<a>', 'First URL')
  .argument('<b>', 'Second URL')
  .option('--api-key <key>', 'API key (or set OPENAI_API_KEY / ANTHROPIC_API_KEY env var)')
  .option('--model <model>', 'LLM model to use', 'gpt-4o-mini')
  .option('--provider <provider>', 'LLM provider: openai or anthropic (auto-detected from env vars)')
  .option('--output <path>', 'Output path for the diff report', 'design-diff.md')
  .action(runDiffCommand);

program.command('mix').description('Mix design memories (stub)').action(runMixCommand);

program.parse();
