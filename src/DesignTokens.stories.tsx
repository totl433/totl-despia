import type { Meta, StoryObj } from '@storybook/react'
import './index.css'

/**
 * Design Tokens - Complete documentation of fonts, colors, and typography used across TOTL Web
 * 
 * This story documents all design system tokens including:
 * - Font families and weights
 * - Complete color palette (Tailwind + custom colors)
 * - Dark mode color mappings
 * - Typography scale and usage patterns
 * - Gradients used throughout the app
 * 
 * Note: This is an app-first design - no hover states are used anywhere in the application.
 * Dark mode uses Tailwind's `dark:` variant classes and respects system preference by default.
 */

const meta: Meta = {
  title: 'Design System/Design Tokens',
  parameters: {
    docs: {
      description: {
        component: 'Complete design system documentation including fonts, colors, and typography patterns used throughout the TOTL Web application.',
      },
    },
  },
}

export default meta

type Story = StoryObj

/**
 * Font Families
 */
export const Fonts: Story = {
  render: () => (
    <div className="p-8 space-y-12 bg-white">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Font Families</h2>
        <div className="space-y-8">
          {/* Gramatika - Primary Font */}
          <div className="border border-slate-200 rounded-xl p-6 bg-slate-50">
            <h3 className="text-xl font-bold text-slate-800 mb-4">Gramatika (Primary Font)</h3>
            <p className="text-sm text-slate-600 mb-4">
              The primary font family used throughout the application. Configured as the default sans-serif font in Tailwind.
            </p>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2">Regular (400)</p>
                <p className="text-2xl" style={{ fontFamily: 'Gramatika', fontWeight: 400 }}>
                  The quick brown fox jumps over the lazy dog
                </p>
                <p className="text-sm text-slate-600 mt-2">Usage: Body text, default text</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2">Medium (500)</p>
                <p className="text-2xl" style={{ fontFamily: 'Gramatika', fontWeight: 500 }}>
                  The quick brown fox jumps over the lazy dog
                </p>
                <p className="text-sm text-slate-600 mt-2">Usage: Medium emphasis text, buttons</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2">Bold (700)</p>
                <p className="text-2xl" style={{ fontFamily: 'Gramatika', fontWeight: 700 }}>
                  The quick brown fox jumps over the lazy dog
                </p>
                <p className="text-sm text-slate-600 mt-2">Usage: Headings, strong emphasis</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2">Italic (400)</p>
                <p className="text-2xl" style={{ fontFamily: 'Gramatika', fontStyle: 'italic', fontWeight: 400 }}>
                  The quick brown fox jumps over the lazy dog
                </p>
                <p className="text-sm text-slate-600 mt-2">Usage: Emphasis, quotes</p>
              </div>
            </div>
            <div className="mt-4 p-4 bg-white rounded-lg border border-slate-200">
              <p className="text-xs font-mono text-slate-600">
                Tailwind: <code className="bg-slate-100 px-1 rounded">font-sans</code> (default)
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  ),
}

/**
 * Color Palette
 */
export const Colors: Story = {
  render: () => (
    <div className="p-8 space-y-12 bg-white dark:bg-slate-900">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">Color Palette</h2>
        
        {/* Dark Mode Info */}
        <div className="mb-8 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">Dark Mode Support</h3>
          <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
            TOTL Web supports dark mode using Tailwind CSS's <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">dark:</code> variant classes.
          </p>
          <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
            <strong>Implementation:</strong> Uses class-based dark mode (<code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">darkMode: 'class'</code>) with system preference detection.
          </p>
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Usage:</strong> Add <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">dark:</code> variants to your classes, e.g., <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">bg-white dark:bg-slate-800</code>
          </p>
        </div>

        {/* Dark Mode Color Mappings */}
        <div className="mb-12 p-6 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">Dark Mode Color Mappings</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Light Mode → Dark Mode</p>
              <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                <li><code className="bg-white dark:bg-slate-700 px-1 rounded">bg-white</code> → <code className="bg-white dark:bg-slate-700 px-1 rounded">dark:bg-slate-800</code></li>
                <li><code className="bg-white dark:bg-slate-700 px-1 rounded">bg-[#f5f7f6]</code> → <code className="bg-white dark:bg-slate-700 px-1 rounded">dark:bg-slate-900</code></li>
                <li><code className="bg-white dark:bg-slate-700 px-1 rounded">text-slate-900</code> → <code className="bg-white dark:bg-slate-700 px-1 rounded">dark:text-slate-100</code></li>
                <li><code className="bg-white dark:bg-slate-700 px-1 rounded">text-slate-600</code> → <code className="bg-white dark:bg-slate-700 px-1 rounded">dark:text-slate-400</code></li>
                <li><code className="bg-white dark:bg-slate-700 px-1 rounded">border-slate-200</code> → <code className="bg-white dark:bg-slate-700 px-1 rounded">dark:border-slate-700</code></li>
              </ul>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Example Usage</p>
              <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1 font-mono">
                <div className="bg-white dark:bg-slate-700 p-2 rounded">
                  <div className="text-slate-500 dark:text-slate-400">Card:</div>
                  <div>bg-white dark:bg-slate-800</div>
                </div>
                <div className="bg-white dark:bg-slate-700 p-2 rounded mt-2">
                  <div className="text-slate-500 dark:text-slate-400">Text:</div>
                  <div>text-slate-900 dark:text-slate-100</div>
                </div>
                <div className="bg-white dark:bg-slate-700 p-2 rounded mt-2">
                  <div className="text-slate-500 dark:text-slate-400">Border:</div>
                  <div>border-slate-200 dark:border-slate-700</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Primary/Brand Colors */}
        <div className="mb-12">
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">Primary/Brand Colors</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <div className="h-24 bg-[#1C8376]"></div>
              <div className="p-4 bg-white dark:bg-slate-800">
                <p className="font-semibold text-slate-900 dark:text-slate-100">Primary Teal</p>
                <p className="text-sm text-slate-600 dark:text-slate-400 font-mono">#1C8376</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Main brand color - buttons, links, highlights</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Tailwind: <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">bg-[#1C8376]</code></p>
              </div>
            </div>
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <div className="h-24 bg-[#156b60]"></div>
              <div className="p-4 bg-white dark:bg-slate-800">
                <p className="font-semibold text-slate-900 dark:text-slate-100">Primary Dark</p>
                <p className="text-sm text-slate-600 dark:text-slate-400 font-mono">#156b60</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Darker variant of primary color (available but not commonly used)</p>
              </div>
            </div>
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <div className="h-24 bg-[#1C8376]/90"></div>
              <div className="p-4 bg-white dark:bg-slate-800">
                <p className="font-semibold text-slate-900 dark:text-slate-100">Primary 90% Opacity</p>
                <p className="text-sm text-slate-600 dark:text-slate-400 font-mono">#1C8376/90</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Semi-transparent variant for overlays and subtle backgrounds</p>
              </div>
            </div>
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <div className="h-24 bg-[#f5f7f6] dark:bg-slate-900"></div>
              <div className="p-4 bg-white dark:bg-slate-800">
                <p className="font-semibold text-slate-900 dark:text-slate-100">Background</p>
                <p className="text-sm text-slate-600 dark:text-slate-400 font-mono">#f5f7f6 / #0f172a</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Page background color (light/dark)</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Tailwind: <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">bg-[#f5f7f6] dark:bg-slate-900</code></p>
              </div>
            </div>
          </div>
        </div>

        {/* Tailwind Slate Colors */}
        <div className="mb-12">
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">Slate Colors (Neutrals)</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-4">
            {[
              { name: 'Slate 50', class: 'bg-slate-50', hex: '#f8fafc' },
              { name: 'Slate 100', class: 'bg-slate-100', hex: '#f1f5f9' },
              { name: 'Slate 200', class: 'bg-slate-200', hex: '#e2e8f0' },
              { name: 'Slate 300', class: 'bg-slate-300', hex: '#cbd5e1' },
              { name: 'Slate 400', class: 'bg-slate-400', hex: '#94a3b8' },
              { name: 'Slate 500', class: 'bg-slate-500', hex: '#64748b' },
              { name: 'Slate 600', class: 'bg-slate-600', hex: '#475569' },
              { name: 'Slate 700', class: 'bg-slate-700', hex: '#334155' },
              { name: 'Slate 800', class: 'bg-slate-800', hex: '#1e293b' },
              { name: 'Slate 900', class: 'bg-slate-900', hex: '#0f172a' },
            ].map((color) => (
              <div key={color.name} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                <div className={`h-16 ${color.class}`}></div>
                <div className="p-3 bg-white dark:bg-slate-800">
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">{color.name}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-mono">{color.hex}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-4">
            Usage: Body text (800), secondary text (600, 700), borders (200, 300), backgrounds (50, 100). 
            In dark mode: Use slate-800/900 for backgrounds, slate-100/200 for text.
          </p>
        </div>

        {/* Tailwind Emerald Colors */}
        <div className="mb-12">
          <h3 className="text-xl font-bold text-slate-800 mb-4">Emerald Colors (Success/Accent)</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-9 gap-4">
            {[
              { name: 'Emerald 50', class: 'bg-emerald-50', hex: '#ecfdf5' },
              { name: 'Emerald 100', class: 'bg-emerald-100', hex: '#d1fae5' },
              { name: 'Emerald 500', class: 'bg-emerald-500', hex: '#10b981' },
              { name: 'Emerald 600', class: 'bg-emerald-600', hex: '#059669' },
              { name: 'Emerald 700', class: 'bg-emerald-700', hex: '#047857' },
              { name: 'Emerald 800', class: 'bg-emerald-800', hex: '#065f46' },
              { name: 'Emerald 900', class: 'bg-emerald-900', hex: '#064e3b' },
            ].map((color) => (
              <div key={color.name} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                <div className={`h-16 ${color.class}`}></div>
                <div className="p-3 bg-white dark:bg-slate-800">
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">{color.name}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-mono">{color.hex}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-4">
            Usage: Success states, positive indicators, form validation, secondary buttons, accents. Note: Primary brand color #1C8376 is similar but distinct from emerald-600.
          </p>
        </div>

        {/* Red Colors */}
        <div className="mb-12">
          <h3 className="text-xl font-bold text-slate-800 mb-4">Red Colors (Error/Danger/Live)</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            {[
              { name: 'Red 50', class: 'bg-red-50', hex: '#fef2f2', usage: 'Light backgrounds for error messages' },
              { name: 'Red 100', class: 'bg-red-100', hex: '#fee2e2', usage: 'Light backgrounds, active states' },
              { name: 'Red 200', class: 'bg-red-200', hex: '#fecaca', usage: 'Borders, active states' },
              { name: 'Red 400', class: 'bg-red-400', hex: '#f87171', usage: 'Animation pings' },
              { name: 'Red 500', class: 'bg-red-500', hex: '#ef4444', usage: 'Main red - indicators, buttons, dots' },
              { name: 'Red 600', class: 'bg-red-600', hex: '#dc2626', usage: 'Main red - buttons, text, live indicators' },
              { name: 'Red 700', class: 'bg-red-700', hex: '#b91c1c', usage: 'Text for error messages' },
              { name: 'Red 800', class: 'bg-red-800', hex: '#991b1b', usage: 'Text for error messages' },
            ].map((color) => (
              <div key={color.name} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                <div className={`h-16 ${color.class}`}></div>
                <div className="p-3 bg-white dark:bg-slate-800">
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">{color.name}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-mono">{color.hex}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{color.usage}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-4">
            <strong>Usage:</strong> Live indicators, error states, danger actions, delete buttons, incorrect picks, position down indicators. All rose colors have been standardized to red equivalents.
          </p>
        </div>

        {/* Amber Colors */}
        <div className="mb-12">
          <h3 className="text-xl font-bold text-slate-800 mb-4">Amber Colors (Warning/Info)</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
            {[
              { name: 'Amber 500', class: 'bg-amber-500', hex: '#f59e0b' },
              { name: 'Amber 600', class: 'bg-amber-600', hex: '#d97706' },
              { name: 'Amber 700', class: 'bg-amber-700', hex: '#b45309' },
              { name: 'Amber 800', class: 'bg-amber-800', hex: '#92400e' },
            ].map((color) => (
              <div key={color.name} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                <div className={`h-16 ${color.class}`}></div>
                <div className="p-3 bg-white dark:bg-slate-800">
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">{color.name}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-mono">{color.hex}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-4">
            Usage: Warning states, info banners, starting soon indicators
          </p>
        </div>


        {/* Blue Colors */}
        <div className="mb-12">
          <h3 className="text-xl font-bold text-slate-800 mb-4">Blue Colors</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
            {[
              { name: 'Blue 600', class: 'bg-blue-600', hex: '#2563eb' },
              { name: 'Blue 600/10', class: 'bg-blue-600/10', hex: '#2563eb/10' },
              { name: 'Blue 600/20', class: 'bg-blue-600/20', hex: '#2563eb/20' },
              { name: 'Blue 600/50', class: 'bg-blue-600/50', hex: '#2563eb/50' },
            ].map((color) => (
              <div key={color.name} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                <div className={`h-16 ${color.class}`}></div>
                <div className="p-3 bg-white dark:bg-slate-800">
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">{color.name}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-mono">{color.hex}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-4">
            Usage: Info states, links, secondary actions. All blue colors use blue-600 as the base with opacity variants for backgrounds and borders.
          </p>
        </div>


        {/* Gradients */}
        <div className="mb-12">
          <h3 className="text-xl font-bold text-slate-800 mb-4">Gradients</h3>
          <div className="space-y-6">
            <div>
              <p className="text-sm text-slate-600 mb-4">
                Gradients used for buttons, headers, and special elements.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Primary/Button Gradient */}
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  <div className="h-24 bg-gradient-to-r from-emerald-500 to-teal-600"></div>
                  <div className="p-4 bg-white dark:bg-slate-800">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">Primary Button Gradient</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-mono mt-1">bg-gradient-to-r from-emerald-500 to-teal-600</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Usage: Gameweek results buttons, primary CTAs</p>
                  </div>
                </div>

                {/* Banner Background Gradient */}
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  <div className="h-24 bg-gradient-to-br from-[#1C8376]/10 to-blue-600/10"></div>
                  <div className="p-4 bg-white dark:bg-slate-800">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">Banner Background Gradient</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-mono mt-1">bg-gradient-to-br from-[#1C8376]/10 to-blue-600/10</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Usage: Subtle background gradients for banners</p>
                  </div>
                </div>

                {/* Shiny/Unicorn Gradient */}
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  <div className="h-24 bg-gradient-to-br from-yellow-400 via-orange-500 via-pink-500 to-purple-600"></div>
                  <div className="p-4 bg-white dark:bg-slate-800">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">Shiny/Unicorn Gradient</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-mono mt-1">bg-gradient-to-br from-yellow-400 via-orange-500 via-pink-500 to-purple-600</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Usage: Special badges, unicorn indicators</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Base Colors */}
        <div className="mb-12">
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">Base Colors</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
              <div className="h-16 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"></div>
              <div className="p-3 bg-white dark:bg-slate-800">
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">White / Slate-800</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 font-mono">#ffffff / #1e293b</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Card backgrounds, content areas</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Dark: <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">dark:bg-slate-800</code></p>
              </div>
            </div>
            <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
              <div className="h-16 bg-black"></div>
              <div className="p-3 bg-white dark:bg-slate-800">
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">Black</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 font-mono">#000000</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Text, borders (Old School Mode)</p>
              </div>
            </div>
            <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
              <div className="h-16 bg-[#DCDCDD] dark:bg-slate-600"></div>
              <div className="p-3 bg-white dark:bg-slate-800">
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">Light Gray / Slate-600</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 font-mono">#DCDCDD / #475569</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Timestamps, subtle text</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  ),
}

/**
 * Typography Scale
 */
export const Typography: Story = {
  render: () => (
    <div className="p-8 space-y-12 bg-white dark:bg-slate-900">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">Typography Scale</h2>
        
        <div className="space-y-8">
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-6 bg-slate-50 dark:bg-slate-800">
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">Font Sizes</h3>
            <div className="space-y-6">
              {[
                { name: 'text-[9px]', size: '0.5625rem', usage: 'Very small labels, chips (intentional for specific UI elements)' },
                { name: 'text-[10px]', size: '0.625rem', usage: 'Small chips, compact labels, bottom nav text (intentional for specific UI elements)' },
                { name: 'text-xs', size: '0.75rem', usage: 'Labels, timestamps, small text' },
                { name: 'text-sm', size: '0.875rem', usage: 'Body text, captions, secondary info' },
                { name: 'text-base', size: '1rem', usage: 'Default body text' },
                { name: 'text-lg', size: '1.125rem', usage: 'Slightly emphasized text' },
                { name: 'text-xl', size: '1.25rem', usage: 'Small headings, card titles' },
                { name: 'text-2xl', size: '1.5rem', usage: 'Section headings' },
                { name: 'text-3xl', size: '1.875rem', usage: 'Page headings' },
                { name: 'text-4xl', size: '2.25rem', usage: 'Large headings, scores' },
                { name: 'text-5xl', size: '3rem', usage: 'Hero headings' },
                { name: 'text-6xl', size: '3.75rem', usage: 'Extra large displays' },
              ].map((item) => (
                <div key={item.name} className="border-b border-slate-200 dark:border-slate-700 pb-4 last:border-0">
                  <div className="flex items-baseline gap-4 mb-2">
                    <code className="text-sm font-mono bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-700 dark:text-slate-300">
                      {item.name}
                    </code>
                    <span className="text-sm text-slate-500 dark:text-slate-400 font-mono">{item.size}</span>
                  </div>
                  <p className={`${item.name} font-sans text-slate-900 dark:text-slate-100 mb-1`}>
                    The quick brown fox jumps over the lazy dog
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{item.usage}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-6 bg-slate-50 dark:bg-slate-800">
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">Font Weights</h3>
            <div className="space-y-4">
              {[
                { name: 'font-normal', weight: '400', usage: 'Default text' },
                { name: 'font-medium', weight: '500', usage: 'Secondary buttons, labels' },
                { name: 'font-semibold', weight: '600', usage: 'Primary buttons, headings (H1, H2, H3), tabs' },
                { name: 'font-bold', weight: '700', usage: 'Strong emphasis, special cases' },
              ].map((item) => (
                <div key={item.name} className="border-b border-slate-200 dark:border-slate-700 pb-4 last:border-0">
                  <div className="flex items-baseline gap-4 mb-2">
                    <code className="text-sm font-mono bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-700 dark:text-slate-300">
                      {item.name}
                    </code>
                    <span className="text-sm text-slate-500 dark:text-slate-400 font-mono">{item.weight}</span>
                  </div>
                  <p className={`text-lg ${item.name} font-sans text-slate-900 dark:text-slate-100 mb-1`}>
                    The quick brown fox jumps over the lazy dog
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{item.usage}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-6 bg-slate-50 dark:bg-slate-800">
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-4">Common Typography Patterns</h3>
            <div className="space-y-6">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Page Heading</p>
                <h1 className="text-4xl font-semibold text-slate-900 dark:text-slate-100 mb-2">Page Title</h1>
                <code className="text-xs font-mono bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-700 dark:text-slate-300">text-4xl font-semibold text-slate-900 dark:text-slate-100</code>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Section Heading</p>
                <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 mb-2">Section Title</h2>
                <code className="text-xs font-mono bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-700 dark:text-slate-300">text-2xl font-semibold text-slate-800 dark:text-slate-200</code>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Body Text</p>
                <p className="text-base text-slate-800 dark:text-slate-200 mb-2">
                  This is regular body text that should be used for most content throughout the application.
                </p>
                <code className="text-xs font-mono bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-700 dark:text-slate-300">text-base text-slate-800 dark:text-slate-200</code>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Secondary Text</p>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                  This is secondary text used for captions, metadata, and less important information.
                </p>
                <code className="text-xs font-mono bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-700 dark:text-slate-300">text-sm text-slate-600 dark:text-slate-400</code>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Muted Text</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                  This is muted text for even less emphasis, like hints or disabled states.
                </p>
                <code className="text-xs font-mono bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-700 dark:text-slate-300">text-sm text-slate-500 dark:text-slate-400</code>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Button Text</p>
                <button className="px-4 py-2 bg-[#1C8376] text-white font-medium rounded-lg mb-2">
                  Button Text
                </button>
                <code className="text-xs font-mono bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded block text-slate-700 dark:text-slate-300">font-medium text-white</code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  ),
}

