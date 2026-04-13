import chalk from 'chalk';
import { runAcquireStage } from '../pipeline/stage.acquire.js';
import { runAnalyzeStage } from '../pipeline/stage.analyze.js';
import { runInterpretStage } from '../pipeline/stage.interpret.js';
import { runProjectStage } from '../pipeline/stage.project.js';
import { analyzeLayoutSpec } from '../analyze/layout.spec.js';
import { acquireFromImage } from '../acquire/from-image.js';
import { captureMultiplePages, mergeBundles } from '../acquire/multi-page.js';
import { loadCachedBundle, saveBundleToCache } from '../cache/crawl-cache.js';
import { createProgress } from './progress.js';
import { defaultLogger } from '../util/log.js';
import type { CaptureBundle } from '../acquire/capture.js';

export async function runLearnCommand(
  urlOrPath: string,
  options: {
    apiKey?: string;
    model?: string;
    provider?: string;
    fromImage?: boolean;
    pages?: string[];
    noCache?: boolean;
    projectRoot?: string;
  }
): Promise<void> {
  const totalSteps = options.fromImage ? 4 : 5;
  const progress = createProgress(totalSteps);

  try {
    const provider = (options.provider ??
      (process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'openai')) as 'openai' | 'anthropic';
    const apiKey =
      options.apiKey ??
      (provider === 'anthropic' ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY);
    if (!apiKey) {
      progress.fail(
        'API key required (--api-key, ANTHROPIC_API_KEY or OPENAI_API_KEY env var, or .env file)'
      );
      process.exit(1);
    }

    const logger = defaultLogger;
    logger.setLevel('error');

    let bundle: CaptureBundle;

    if (options.fromImage) {
      // Image-based flow: skip crawl and computed styles
      progress.step(`Reading image ${chalk.yellow(urlOrPath)}`);
      bundle = await acquireFromImage(urlOrPath);
    } else if (options.pages && options.pages.length > 0) {
      // Multi-page flow: crawl primary + extra pages, then merge
      const allUrls = [urlOrPath, ...options.pages];
      progress.step(`Acquiring ${chalk.yellow(String(allUrls.length))} pages`);
      const bundles = await captureMultiplePages(allUrls, logger);
      bundle = mergeBundles(bundles);
    } else {
      // Check cache first (Task 30)
      progress.step('Acquiring data from website');
      const projectRoot = options.projectRoot ?? process.cwd();
      const cached = options.noCache ? null : await loadCachedBundle(urlOrPath, projectRoot);
      if (cached) {
        bundle = cached;
        progress.spinner.text += chalk.dim(' (cached)');
      } else {
        bundle = await runAcquireStage(urlOrPath, logger);
        await saveBundleToCache(urlOrPath, bundle, projectRoot);
      }
    }

    progress.step(`Analyzing ${chalk.yellow(String(bundle.styles.length))} style elements`);
    const partialIR = runAnalyzeStage(bundle, logger);

    progress.step('Interpreting design signals with AI');
    const ir = await runInterpretStage(
      partialIR,
      {
        apiKey,
        model: options.model,
        temperature: 0.2,
        provider,
      },
      logger
    );

    progress.step('Analyzing layout with vision AI');
    const layoutSpec = await analyzeLayoutSpec(
      bundle.screenshot,
      {
        apiKey,
        model: options.model ?? (provider === 'anthropic' ? 'claude-haiku-4-5-20251001' : 'gpt-4o'),
        provider,
      },
      logger
    );

    progress.step('Generating design memory files');
    await runProjectStage(ir, urlOrPath, layoutSpec, options.projectRoot, logger);

    progress.succeed(`Design memory created in ${chalk.bold('.design-memory/')}`);

    const source = options.fromImage
      ? 'image'
      : options.pages
        ? `${1 + options.pages.length} pages`
        : 'URL';
    console.log(chalk.dim(`\n   Source: ${source} — ${urlOrPath}`));
    console.log(
      chalk.dim(
        `   Found ${chalk.yellow(String(ir.colors.length))} colors, ${chalk.yellow(String(ir.typography.length))} typography tokens, ${chalk.yellow(String(ir.components.length))} components`
      )
    );
  } catch (error) {
    progress.fail(`Failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
