---
title: Publishing a Scully site via GitHub Pages
description: Learn how to use GitHub Actions to publish your Scully blog and serve using GitHub Pages.
published: true
date: '2020-08-03'
tags: ['Scully', 'GitHub', 'CI/CD']
keywords:
  ['scully github pages', 'scully github actions', 'scully github publish']
---

# Publishing a Scully site via GitHub Pages

Look at that - I managed to make it 3 whole blog posts before the inevitable "how I made my blog" post. Spoiler alert - I used
Angular and [Scully](https://scully.io) to generate the static content. I'm not going to do a deep dive into Scully, I think
their documentation is pretty good. What I will do is outline the strategy I used to publish the blog.

First things first - I'm.....frugal. I was looking for a no-cost option. Maybe when this takes off, I'll go buy the domain and
splurge on some cloud hosting. For now, "free" is the name of the game. More importantly, I want this to be as automated as possible.
Since I'm using GitHub as my source control, I started by looking into using [GitHub Pages](https://pages.github.com) to serve my site.
My goal: on any push to the default branch, GitHub should automatically build the latest site, and on a successful build, it should
start serving it automatically. There are 3 basic areas in play here.

## GitHub Pages

The GitHub docs around pages are great, so I won't try and duplicate them here. Basically all that you need to do is flip a
setting in your repository's settings page to turn on Pages, and give it a folder to serve. There are some rules - it has
to be a public repo - but other than that it's pretty straightforward. One key thing here - remember the "free" comment above?
That does have some implications here. The site's URL will be something like `https://<user>.github.io/<repo-name>`. We'll come back
to that later on. In my case, I am going to configure Pages to serve from the `master` branch, and use the `/docs` folder.

## GitHub Actions

Actions are a relatively new GitHub feature. They allow you to do CI/CD type actions, among many other things. In my case, on
pushes to the master branch, I want to build the Angular app, run Scully to generate the static site content, and then push the
static content back to the branch from which GitHub Pages is configured to serve - in this case, the master branch. So obviously,
we'll need to prevent an infinite loop of builds there.

To setup the Actions, by convention I'll setup a YAML file in `.github/workflows/main.yml`. Here's what that looks like, with some
comments to outline the flow:

```yaml
# .github/workflows/main.yml`
name: Scully Publish

# Run this action on any push to master, except to the /docs folder
on:
  push:
    branches:
      - master
    paths-ignore:
      - 'docs/**'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      # Checkout the repository
      - uses: actions/checkout@v2
      # Setup Node 12 to run Angular and Scully builds
      - uses: actions/setup-node@v1
        with:
          node-version: '12'
      # Install Node dependencies in CI mode
      - name: Install
        run: npm ci
      # Run an Angular production build
      - name: Build
        run: npm run build -- --prod
      # Run a Scully production build, passing a custom config file
      - name: Scully
        run: npm run scully -- --configFile scully.web.config.prod.ts
      # Commit and push the contents of the /docs folder back to master
      # 41898282+github-actions[bot] is the user id of the Github Actions account/bot
      - name: Deploy
        run: |
          git config --global user.name "github-actions[bot]"
          git config --global user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add ./docs
          git commit -m "Auto-deploy live docs with new content"
          git push
```

So this is fairly straightforward until the last step. We clone the repository, build Angular and then run Scully to
generate the prerendered static site content. The static content will be generated in the `/docs` directory (shown below).
We then push that folder back up to GitHub in order to serve it. In order to prevent an infinite loop of builds, I've set the `paths-ignore`
option to ignore any pushes to the docs folder when running actions.

## Scully

The final piece of the puzzle here is the Scully configuration for a production build. For me, this was a little bit of trial and
error, but I was able to get some good help by filing issues in the Scully repository. Remember that little detail from the GitHub Pages
section where it's going to serve the app at `https://<user>.github.io/<repo>`? That's an important piece of information for Scully,
because it needs to know the full URL in order to effectively generate the static site.

In a normal Angular app, you would use the `<base href="">` option in conjunction with Angular's Router. I originally tried to just
use my repository name as an argument to --base-href in a production build, but that didn't work. I was pointed to a Scully plugin
called [scully-plugin-base-href-rewrite](https://www.npmjs.com/package/@scullyio/scully-plugin-base-href-rewrite), and once I installed and
configured that, it worked a charm. Since I only want to use that in a production build (not when running locally in dev mode), I created a
`scully.web.config.prod.ts` file to house my production configuration, and I'm passing that as an option when running Scully in CI.
Here's that file:

```typescript
// scully.web.config.prod.ts
import { ScullyConfig, setPluginConfig } from '@scullyio/scully';
import { baseHrefRewrite } from '@scullyio/scully-plugin-base-href-rewrite';
const { getFlashPreventionPlugin } = require('scully-plugin-flash-prevention');

// setup some plugins you want to use
const defaultPostRenderers = [
  'seoHrefOptimise',
  baseHrefRewrite, // <--- this is the key for this topic
  getFlashPreventionPlugin({
    appRootSelector: 'rpd10-root',
    displayType: 'flex',
  }),
];
// Setup to match your GitHub repository name (or other path)
setPluginConfig(baseHrefRewrite, { href: '/<your-repo-name>/' });
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
```

## Wrap Up

With these three pieces in place, I now have an automated way to deploy my blog! Since a couple of these technologies are in
beta mode, I wanted to list out the exact versions of Scully and its plugins that I'm using (I'm sure they're out of date already):

```JSON
// package.json, dependencies
"@scullyio/init": "0.0.28",
"@scullyio/ng-lib": "0.0.27",
"@scullyio/scully": "0.0.99",
"@scullyio/scully-plugin-base-href-rewrite": "0.0.2"
```

You can see the code and configuration for this here: https://github.com/rpd10/diehl-with-software
