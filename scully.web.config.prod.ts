import { ScullyConfig, setPluginConfig } from '@scullyio/scully';
import { baseHrefRewrite } from '@scullyio/scully-plugin-base-href-rewrite';

const defaultPostRenderers = ['seoHrefOptimise', baseHrefRewrite];
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
