import { useLayoutEffect } from 'react';
import type { ReactNode } from 'react';
import type { Preview } from '@storybook/react-vite';
import { setLocale, useLocale } from '../src/locale.js';
import type { Locale } from '../src/locale.js';
import '../src/style.css';

function LocalePreview({
  requested,
  children,
}: {
  requested: Locale;
  children: (locale: Locale) => ReactNode;
}) {
  const { locale } = useLocale();
  useLayoutEffect(() => {
    document.documentElement.dataset.k8k = 'provisional';
    setLocale(requested);
  }, [requested]);
  return children(locale);
}

const preview: Preview = {
  globalTypes: {
    locale: {
      description: 'K8K Academy',
      toolbar: {
        icon: 'globe',
        items: [
          { value: 'ru', title: 'Русский' },
          { value: 'ro', title: 'Română' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { locale: 'ru', viewport: { value: undefined, isRotated: false } },
  parameters: {
    viewport: {
      options: Object.fromEntries(
        [360, 768, 1024, 1280].map((width) => [
          `width${width}`,
          { name: `${width} px`, styles: { width: `${width}px`, height: '900px' } },
        ]),
      ),
    },
    a11y: { test: 'error' },
  },
  decorators: [
    (Story, context) => (
      <LocalePreview requested={context.globals.locale === 'ro' ? 'ro' : 'ru'}>
        {(locale) => <Story args={{ ...context.args, locale }} />}
      </LocalePreview>
    ),
  ],
};

export default preview;
