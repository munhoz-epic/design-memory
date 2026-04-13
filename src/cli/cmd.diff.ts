import ora from 'ora';
import chalk from 'chalk';
import { runAcquireStage } from '../pipeline/stage.acquire.js';
import { runAnalyzeStage } from '../pipeline/stage.analyze.js';
import { runInterpretStage } from '../pipeline/stage.interpret.js';
import { diffDesignIRs, renderDiffMarkdown } from '../ir/diff.js';
import { writeTextFile } from '../util/io.js';
import { defaultLogger } from '../util/log.js';
import { join } from 'path';
import type { DesignIR } from '../ir/types.js';
import type { LLMConfig } from '../interpret/llm.client.js';

export async function runDiffCommand(
  a: string,
  b: string,
  options?: {
    apiKey?: string;
    model?: string;
    provider?: string;
    output?: string;
  }
): Promise<void> {
  const spinner = ora(chalk.cyan(`Diffing design systems...`)).start();

  try {
    const provider = (options?.provider ??
      (process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'openai')) as 'openai' | 'anthropic';
    const apiKey =
      options?.apiKey ??
      (provider === 'anthropic' ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY);
    if (!apiKey) {
      spinner.fail(
        chalk.red(
          'API key required (--api-key, ANTHROPIC_API_KEY or OPENAI_API_KEY env var, or .env file)'
        )
      );
      process.exit(1);
    }

    const logger = defaultLogger;
    logger.setLevel('error');

    const llmConfig: LLMConfig = { apiKey, model: options?.model, temperature: 0.2, provider };

    // Acquire & analyze both sites in parallel
    spinner.text = chalk.cyan(`Acquiring ${chalk.yellow(a)} and ${chalk.yellow(b)} in parallel...`);

    const [irA, irB] = await Promise.all([
      learnSingle(a, llmConfig, logger),
      learnSingle(b, llmConfig, logger),
    ]);

    spinner.text = chalk.cyan('Computing diff...');
    const diff = diffDesignIRs(irA, irB);

    const report = renderDiffMarkdown(diff, a, b);

    // Write report
    const outputPath = options?.output ?? join(process.cwd(), 'design-diff.md');
    await writeTextFile(outputPath, report);

    spinner.succeed(
      chalk.green(
        `Diff complete: ${chalk.bold(diff.summary.verdict)} (${diff.summary.totalChanges} changes)`
      )
    );

    console.log(
      chalk.dim(
        `\n   ${chalk.green(`+${diff.summary.addedCount}`)} added, ${chalk.red(`-${diff.summary.removedCount}`)} removed, ${chalk.yellow(`~${diff.summary.changedCount}`)} changed`
      )
    );
    console.log(chalk.dim(`   Report written to ${outputPath}`));
  } catch (error) {
    spinner.fail(chalk.red(`Failed: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }
}

async function learnSingle(
  url: string,
  config: LLMConfig,
  logger: typeof defaultLogger
): Promise<DesignIR> {
  const bundle = await runAcquireStage(url, logger);
  const partialIR = runAnalyzeStage(bundle, logger);
  return runInterpretStage(partialIR, config, logger);
}
