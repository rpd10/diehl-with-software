import { ScullyConfig, setPluginConfig } from '@scullyio/scully';
import { baseHrefRewrite } from '@scullyio/scully-plugin-base-href-rewrite';
const { getFlashPreventionPlugin } = require('scully-plugin-flash-prevention');

const defaultPostRenderers = [
  'seoHrefOptimise',
  baseHrefRewrite,
  getFlashPreventionPlugin({
    appRootSelector: 'rpd10-root',
    displayType: 'flex',
  }),
];
setPluginConfig(baseHrefRewrite, { href: '/diehl-with-software/' });
export const config: ScullyConfig = {
  projectRoot: './apps/web/src',
  projectName: 'web',
  outDir: './docs',
  defaultPostRenderers,
  routes: {
    '/blog/:slug': {
      type: 'contentFolder',
      slug: {
        folder: './blog',
      },
    },
  },
};
