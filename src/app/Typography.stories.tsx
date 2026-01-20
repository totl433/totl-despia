import type { Meta, StoryObj } from '@storybook/react'
import React from 'react'
import { getTotlTextVariantSpec, TOTL_TEXT_VARIANTS } from '../../packages/ui/src/typography'

function SpecTable() {
  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <div className="text-2xl font-extrabold tracking-tight">Typography</div>
          <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            This is the single source of truth for app text variants (used by <code>@totl/ui</code>).
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="grid grid-cols-12 gap-0 border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:border-slate-800 dark:text-slate-300">
            <div className="col-span-3">Variant</div>
            <div className="col-span-2 text-right">Size</div>
            <div className="col-span-2 text-right">Line</div>
            <div className="col-span-2 text-right">Weight</div>
            <div className="col-span-1 text-right">LS</div>
            <div className="col-span-2">Example</div>
          </div>

          {TOTL_TEXT_VARIANTS.map((v) => {
            const spec = getTotlTextVariantSpec(v.variant)
            const exampleText =
              v.variant === 'sectionTitle'
                ? 'LEADERBOARDS'
                : v.variant === 'sectionSubtitle'
                  ? 'Gameweek 22 Live Tables'
                  : v.variant === 'heading'
                    ? 'Your Gameweek Results'
                    : v.variant === 'micro' || v.variant === 'microMuted'
                      ? 'Micro text'
                      : v.variant === 'caption'
                        ? 'Caption text'
                        : v.variant === 'muted'
                          ? 'Muted body text'
                          : 'Body text'

            const style: React.CSSProperties = {
              fontSize: spec.fontSize,
              lineHeight: `${spec.lineHeight}px`,
              fontWeight: Number(spec.fontWeight),
              letterSpacing: spec.letterSpacing ?? undefined,
              textTransform: spec.textTransform === 'uppercase' ? 'uppercase' : undefined,
              color: spec.colorRole === 'muted' ? 'rgba(148,163,184,0.95)' : undefined,
            }

            return (
              <div
                key={v.variant}
                className="grid grid-cols-12 items-start gap-0 border-b border-slate-100 px-4 py-4 last:border-b-0 dark:border-slate-800"
              >
                <div className="col-span-3">
                  <div className="font-semibold">{v.variant}</div>
                  {v.note ? (
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{v.note}</div>
                  ) : null}
                </div>
                <div className="col-span-2 text-right font-mono text-xs text-slate-600 dark:text-slate-300">
                  {spec.fontSize}
                </div>
                <div className="col-span-2 text-right font-mono text-xs text-slate-600 dark:text-slate-300">
                  {spec.lineHeight}
                </div>
                <div className="col-span-2 text-right font-mono text-xs text-slate-600 dark:text-slate-300">
                  {spec.fontWeight}
                </div>
                <div className="col-span-1 text-right font-mono text-xs text-slate-600 dark:text-slate-300">
                  {typeof spec.letterSpacing === 'number' ? spec.letterSpacing : '—'}
                </div>
                <div className="col-span-2">
                  <div style={style}>{exampleText}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const meta: Meta<typeof SpecTable> = {
  title: 'App/Design/Typography',
  component: SpecTable,
  parameters: {
    layout: 'fullscreen',
  },
}

export default meta
type Story = StoryObj<typeof SpecTable>

export const Variants: Story = {}

