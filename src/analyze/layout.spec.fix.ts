import { z } from 'zod';
import type { ScreenshotResult } from '../acquire/screenshots.js';
import type { LayoutSpec } from './layout.spec.js';

/** Loose shape of a section before schema validation/fixing */
interface RawSection {
  position?: {
    vertical?: string;
    horizontal?: string;
    order?: number;
  };
  layout?: {
    pattern?: string;
    alignment?: string;
    columns?: number;
    gap?: string;
  };
  type?: string;
  [key: string]: unknown;
}

/** Loose shape of the parsed layout before schema validation/fixing */
interface RawLayoutSpec {
  viewport?: { width: number; height: number };
  container?: Record<string, unknown>;
  sections?: RawSection[];
  [key: string]: unknown;
}

export function fixLayoutSpec(
  parsed: unknown,
  screenshot: ScreenshotResult,
  schema: z.ZodSchema<LayoutSpec>
): LayoutSpec {
  const fixed = parsed as RawLayoutSpec;

  if (!fixed.viewport && screenshot) {
    fixed.viewport = { width: screenshot.width, height: screenshot.height };
  }

  if (!fixed.container) {
    fixed.container = {};
  }

  if (fixed.sections && Array.isArray(fixed.sections)) {
    fixed.sections = fixed.sections.map((s: RawSection, index: number) => {
      if (!s.position) {
        s.position = { vertical: 'middle', horizontal: 'full-width', order: index };
      }
      if (!s.layout) {
        s.layout = { pattern: 'single' };
      }
      if (s.layout && s.layout.alignment) {
        const validAlignments = [
          'start',
          'center',
          'end',
          'stretch',
          'space-between',
          'left',
          'right',
          'justify',
        ];
        if (!validAlignments.includes(s.layout.alignment)) {
          s.layout.alignment = 'center';
        }
      }
      if (s.layout && s.layout.pattern) {
        const validPatterns = ['single', 'row', 'column', 'grid', 'flex', 'centered'];
        if (!validPatterns.includes(s.layout.pattern)) {
          s.layout.pattern = 'single';
        }
      }
      if (s.position && s.position.vertical) {
        const validVertical = ['top', 'middle', 'bottom'];
        if (!validVertical.includes(s.position.vertical)) {
          s.position.vertical = 'middle';
        }
      }
      if (s.position && s.position.horizontal) {
        const validHorizontal = ['left', 'center', 'right', 'full-width'];
        if (!validHorizontal.includes(s.position.horizontal)) {
          s.position.horizontal = 'full-width';
        }
      }
      // Fix content: ensure it's an object and items are strings
      const raw = s as Record<string, unknown>;
      if (!raw.content || typeof raw.content !== 'object') {
        raw.content = {};
      }
      const content = raw.content as Record<string, unknown>;
      if (content.items && Array.isArray(content.items)) {
        content.items = (content.items as unknown[]).map((item) => {
          if (typeof item === 'string') return item;
          if (item && typeof item === 'object') {
            const obj = item as Record<string, unknown>;
            return String(obj.text ?? obj.label ?? obj.name ?? obj.title ?? JSON.stringify(item));
          }
          return String(item);
        });
      }

      if (s.type) {
        const validTypes = [
          'header',
          'navigation',
          'hero',
          'section',
          'sidebar',
          'footer',
          'card',
          'button',
          'text',
          'image',
        ];
        if (!validTypes.includes(s.type)) {
          s.type = 'section';
        }
      } else {
        s.type = 'section';
      }
      return s;
    });
  }

  return schema.parse(fixed);
}
