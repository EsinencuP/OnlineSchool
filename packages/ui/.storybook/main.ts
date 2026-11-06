import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  stories: ['../stories/*.stories.tsx'],
  addons: ['@storybook/addon-a11y'],
  core: { disableTelemetry: true, disableWhatsNewNotifications: true },
  previewHead: (head) => `${head}
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'">
  `,
  viteFinal: (viteConfig) => ({
    ...viteConfig,
    envDir: false,
    envPrefix: [],
    plugins: [
      ...(viteConfig.plugins ?? []),
      {
        name: 'local-catalog-no-api',
        moduleParsed({ id }) {
          if (/(?:\/apps\/|\/(?:api-contracts|account-ui)\/)/u.test(id.replaceAll('\\', '/'))) {
            this.error(`Runtime app or API module imported into the local catalog: ${id}`);
          }
        },
        configureServer(server) {
          server.middlewares.use((request, response, next) => {
            if (/^\/api(?:[/?]|$)/u.test(request.url ?? '')) {
              response.writeHead(403).end();
              return;
            }
            next();
          });
        },
      },
    ],
  }),
};

export default config;
