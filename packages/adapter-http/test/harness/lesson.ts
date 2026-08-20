import type { LessonManifest } from '@cuestack/schema'

/** One valid lesson with an asset, so every adapter has something real to carry. */
export const lesson = (): LessonManifest =>
  ({
    schemaVersion: '1.0',
    lesson: { id: 'lesson', title: 'Over HTTP', language: 'en', aspectRatio: '16:9' },
    slides: [
      {
        id: 'slide_0',
        durationMs: 8000,
        advance: { mode: 'after_duration' },
        elements: [
          {
            id: 'img',
            type: 'image',
            x: 0,
            y: 0,
            width: 400,
            height: 300,
            zIndex: 0,
            startMs: 0,
            endMs: 8000,
            payload: { asset: { assetId: 'asset_photo', mimeType: 'image/png' } },
            accessibility: { altText: 'A diagram' },
          },
        ],
      },
    ],
  }) as unknown as LessonManifest
