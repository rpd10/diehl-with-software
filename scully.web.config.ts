import { ScullyConfig } from '@scullyio/scully';
const { getFlashPreventionPlugin } = require('scully-plugin-flash-prevention');

export const config: ScullyConfig = {
  projectRoot: './apps/web/src',
  projectName: 'web',
  outDir: './dist/static',
  defaultPostRenderers: [
    getFlashPreventionPlugin({
      appRootSelector: 'rpd10-root',
      displayType: 'flex',
    }),
  ],
  routes: {
    '/blog/:slug': {
      type: 'contentFolder',
      slug: {
        folder: './blog',
      },
    },
  },
};
