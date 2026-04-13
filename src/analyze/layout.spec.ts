import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import type { ScreenshotResult } from '../acquire/screenshots.js';
import type { LLMConfig } from '../interpret/llm.client.js';
import type { Logger } from 'loglevel';
import { z } from 'zod';
import { buildLayoutSpecPrompt } from './layout.spec.prompt.js';
import { fixLayoutSpec } from './layout.spec.fix.js';
import { layoutSpecSchema } from './layout.spec.schema.js';

export type { LayoutSpec, LayoutSection } from './layout.spec.schema.js';
export { layoutSpecSchema } from './layout.spec.schema.js';

const SYSTEM_PROMPT = `You are a design system expert. Analyze the webpage screenshot and create a detailed layout specification in JSON format that any LLM can use to recreate this design.

Your output must be valid JSON matching this schema. Be extremely precise about:
- Section positions (top/middle/bottom, left/center/right/full-width)
- Layout patterns (row, column, grid, flex, centered)
- Content hierarchy and relationships
- Spacing, gaps, padding, margins
- Responsive behavior

This specification will be used by LLMs to generate code that recreates the exact layout.`;

export async function analyzeLayoutSpec(
  screenshot: ScreenshotResult,
  config: LLMConfig,
  logger?: Logger
): Promise<z.infer<typeof layoutSpecSchema>> {
  logger?.debug('Analyzing layout specification with vision model...');

  const base64Image = screenshot.buffer.toString('base64');
  const userPrompt = buildLayoutSpecPrompt(screenshot.width, screenshot.height);

  let content: string;

  if (config.provider === 'anthropic') {
    const client = new Anthropic({ apiKey: config.apiKey });
    const response = await client.messages.create({
      model: config.model ?? 'claude-haiku-4-5-20251001',
      max_tokens: 2500,
      system: SYSTEM_PROMPT + '\n\nReturn only valid JSON. No markdown, no code blocks.',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: userPrompt },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: base64Image,
              },
            },
          ],
        },
      ],
    });
    const block = response.content[0];
    if (!block || block.type !== 'text') throw new Error('Unexpected Anthropic response type');
    content = block.text;
  } else {
    const client = new OpenAI({ apiKey: config.apiKey });
    const response = await client.chat.completions.create({
      model: config.model?.includes('vision') ? config.model : 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: userPrompt,
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 2500,
      temperature: 0.0,
    });
    content = response.choices[0]?.message?.content ?? '';
  }

  if (!content) {
    throw new Error('Empty vision model response');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    logger?.error('Failed to parse JSON response', error);
    throw new Error('Invalid JSON response from vision model');
  }

  let spec: z.infer<typeof layoutSpecSchema>;
  try {
    spec = layoutSpecSchema.parse(parsed);
  } catch (error) {
    logger?.warn('Schema validation failed, attempting to fix...', error);

    if (error instanceof z.ZodError) {
      try {
        spec = fixLayoutSpec(parsed, screenshot, layoutSpecSchema);
        logger?.debug('Successfully fixed schema validation errors');
      } catch (retryError) {
        logger?.error('Failed to fix schema validation', retryError);
        throw new Error(`Schema validation failed: ${error.message}`);
      }
    } else {
      throw error;
    }
  }

  logger?.debug('Layout specification generated');

  return spec;
}
