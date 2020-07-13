---
title: 'Angular Dynamic Environment Configuration'
description: "Improve upon Angular's default strategy for managing environment configuration by loading it dynamically at runtime, in a type-safe manner."
published: true
date: '2020-07-06'
tags: ['Angular', 'Nx']
keywords:
  [
    'angular dynamic environment',
    'angular environment properties',
    'angular environment runtime',
  ]
---

# Angular Dynamic Environment Configuration

Out of the box, Angular provides a compile-time solution for managing environment-specific configuration. The default solution uses
file replacements at compile time - see the [Angular Guide](https://angular.io/guide/build#configuring-application-environments).
This can work for many apps, but if you're working with a microservice-based backend using GitOps principles,
or doing continuous delivery with feature flags, you may want to be able to change configuration at runtime without rebuilding
the application.

Most of the solutions in this area resolve around the use of `APP_INITIALIZER` to delay loading the Angular application until
you can load the properties from a JSON file using a service over HTTP. At Penn State, we've been using that solution for
around 3 years (since Angular 2!), and it's worked well for us. I've also seen suggestions about using Angular Universal to inject the
configuration as environment variables on the server, and pass them to the client using TransferState, but that requires
adding SSR to your stack, which may be a big ask.

Recently I had the opportunity to take another look at our original implementation and freshen it up with some lessons learned over time.
Frankly, I was a little disappointed in myself when looking back at our old code - it lacked type safety, and seemed to be prone
to race conditions. In this space, I'll walk through an alternative implementation that does not use `APP_INITIALIZER`.

## The Setup

I'll be using an [Nx Monorepo](https://nx.dev) and illustrating a workflow based on feature flags. We'll be loading configuration
at runtime and using `InjectionToken` to provide configuration to our apps and libs. The example repository is [here](https://github.com/rpd10/example-angular-dynamic-environment)

To get things started, I'll generate a new empty Nx workspace:

```bash
npx create-nx-workspace
? Workspace name (e.g., org name)     example-angular-dynamic-environment
? What to create in the new workspace empty
? CLI to power the Nx workspace       Angular CLI
? Use the free tier of the distributed cache provided by Nx Cloud? No
```

Next, we'll use the Nx CLI to generate a new Angular application with routing. I highly recommend using [Nx Console](https://nx.dev/angular/cli/console)
to help with the CLI commands. Throughout the rest of this article, I'll show the raw CLI commands, but most likely I've copied/pasted
those commands from Nx Console.

```bash
npm i -D @nrwl/angular
nx generate @nrwl/angular:application --name=demo --style=scss --routing --prefix=app
```

Once Nx does it's thing, I'll remove the Nx branding from the generated application by removing the content from `app.component.scss`,
and `app.component.html`.
Next, I'll add Angular Material using the schematic, and generate a sidenav so we have some nice layout to work with in our application.

```bash
nx add @angular/material
? Choose a prebuilt theme name, or "custom" for a custom theme: Indigo/Pink
? Set up global Angular Material typography styles? Yes
? Set up browser animations for Angular Material? Yes

nx generate @angular/material:navigation --name=layout --project=demo
```

Finally, we'll modify the `app.component.html` to add `<app-layout></app-layout>`, and then modify `layout.component.html` to include the router outlet.
Look for the `<!-- Add Content Here -->` comment and replace it with `<router-outlet></router-outlet>`. If we start up the application at this point,
you should see a material sidenav with some dummy links.

## The Project

We've been tasked with building out the first few features of our application. We'll have a home/dashboard page with links out to our features,
and the first iteration will have 2 teams working concurrently to build out the first 2 features - Widgets and Customers. Our backend services
are going to be built and hosted elsewhere, and exposed over REST APIs. Our 2 project teams are going to race to see who can complete their feature
first, but each feature should be independently deployable - so if the Customers feature takes 1 sprint while Widgets takes 3, we want to be able
to deploy and turn on the Customers feature as soon as it's ready. We're going to have a staging and production environment, which will point
to different backends. Additionally, we do not want to have long-running feature branches - we want frequent integrations with the upstream branch,
so we need a way to disable a feature in the production environment, while having it turned on in staging so our stakeholders can check progress,
without rebuilding the application.

In this article, we'll focus on the Angular implementation. For our project, one key takeaway is that we need to build the application once,
host it in 2 places (staging and production), and change the configuration per hosting environment. So, we need to dynamically load the configuration
on bootstrap of the app, which means we cannot use the default environment.ts file. We'll need to make an HTTP request to a known endpoint to
load the configuration, and then provide that to the apps/libraries for consumption. Thankfully, Angular's dependency injection is
well suited to solve this problem.

## Generate a Config Library

One thing we need to figure out is where should the application configuration be defined. In an Nx application, using a Library for this is an
obvious choice. This will allow both apps and libraries to import the configuration from a shared library. Depending on the complexity of your
application, you may even have multiple -config libraries, so you can take advantage of the `affected:` commands from Nx to only build what changed.
So let's go ahead and generate a configuration library, and while we're at it we'll generate the feature modules for home, widgets, and customers.

```bash
nx generate @nrwl/angular:library --name=config --style=scss
nx generate @nrwl/angular:library --name=home --style=scss --lazy --routing
nx generate @nrwl/angular:library --name=customers --style=scss --lazy --routing
nx generate @nrwl/angular:library --name=widgets --style=scss --lazy --routing
```

## Define the App Configuration

Next we'll need to define the shape of the application configuration. Since we're loading it dynamically, it would be nice to have an interface
describing what we expect the JSON to look like. We'll add this to the libs/config library, and make sure we export it from the library so it's
consumable from other areas. Here's our first cut:

```typescript
// libs/config/src/lib/app.config.ts
import { InjectionToken } from '@angular/core';

export interface AppConfig {
  customers: CustomersConfig;
  widgets: WidgetsConfig;
}

export interface CustomersConfig {
  enabled: boolean;
  url: string;
}

export interface WidgetsConfig {
  enabled: boolean;
  url: string;
}

export const APP_CONFIG = new InjectionToken<AppConfig>('demo.app.config');

export const CUSTOMERS_CONFIG = new InjectionToken<CustomersConfig>(
  'demo.customers.config'
);

export const WIDGETS_CONFIG = new InjectionToken<WidgetsConfig>(
  'demo.widgets.config'
);
```

Pretty simple - we've defined a high level configuration object that will be composed of smaller individual configurations. Next, we need to be able to
provide that configuration to injectable services. This is where [InjectionToken](https://angular.io/api/core/InjectionToken) comes in.
Now our customer library can inject the `CUSTOMERS_CONFIG` token and receive an object in the shape of `CustomerConfig`.
But we still need to provide those injection tokens. Let's do the simplest thing possible to get started - we can provide static, mock data by
defining providing the APP_CONFIG token in AppModule. We will then define factory functions for the customers and widgets tokens.

```typescript
// app.module.ts
import { APP_CONFIG, AppConfig } from '@example-angular-dynamic-environment/config';

const appConfig: AppConfig = {
  customers: {
    enabled: true,
    url: 'http://fake-customers'
  },
  widgets: {
    enabled: true,
    url: 'http://fake-widgets'
  }
};

export function customersConfigFactory(config: AppConfig): CustomersConfig {
  return config.customers;
}

export function widgetsConfigFactory(config: AppConfig): WidgetsConfig {
  return config.widgets;
}

@NgModule({
  imports: [...],
  providers: [
    { provide: APP_CONFIG, useValue: appConfig },
    {
      provide: CUSTOMERS_CONFIG,
      useFactory: customersConfigFactory,
      deps: [APP_CONFIG],
    },
    {
      provide: WIDGETS_CONFIG,
      useFactory: widgetsConfigFactory,
      deps: [APP_CONFIG],
    },
  ],
})
export class AppModule {}
```

## Consuming the Injection Tokens

Let's see if we can now inject those `CUSTOMERS_CONFIG` and `WIDGETS_CONFIG` injection tokens into their respective feature libraries.
For both customers and widgets, we need to generate routed components, and then configure the application routing to use lazy-loading,
configure the child routing modules to display these routed components, and update the layout component to show the correct links.
In the interest of brevity, I will just list out the CLI commands I've run to get the boilerplate setup, the full setup is in the example repo.

```bash
nx generate @schematics/angular:component --name=home --project=home --style=scss --changeDetection=OnPush --flat
nx generate @schematics/angular:component --name=customers --project=customers --style=scss --changeDetection=OnPush --flat
nx generate @schematics/angular:component --name=widgets --project=widgets --style=scss --changeDetection=OnPush --flat
```

Let's update the Customers and Widgets components to inject their configuration, and just spit it out as JSON for now. We'll start with
Customers, the pattern will be the same for Widgets.

Here's the HTML:

```html
<h1>Customers</h1>
{{config | json}}
```

And then the backing component:

```typescript
// libs/customers/src/lib/customers.component.ts
import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import {
  CustomersConfig,
  CUSTOMERS_CONFIG,
} from '@example-angular-dynamic-environment/config';

@Component({
  selector: 'example-angular-dynamic-environment-customers',
  templateUrl: './customers.component.html',
  styleUrls: ['./customers.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomersComponent {
  constructor(@Inject(CUSTOMERS_CONFIG) public config: CustomersConfig) {}
}
```

We're using Angular's `@Inject()` helper to grab the configuration and just spit it out as JSON. We can repeat the process for widgets,
run the application, and at this point we should be able to navigate to each page using the menu, and see our mock JSON spit out on the page.
The next step is going to be dynamically loading the actual configuration, instead of mocking it.

## Loading Configuration Dynamically

So at this point, we have all of the pieces in place to consume the injection tokens, we just need to figure out how to load the
configuration dynamically. Most existing patterns I've seen use `APP_INITIALIER` to call some Service that loads the config over HTTP.
In this example, we're going to leverage the `extraProviders` parameter for `platformBrowserDynamic` in conjuntion with `fetch`.

First, let's go back to our `AppModule` and remove the mock provider for `APP_CONFIG`, and the mock JSON configuration. Then, open
up `main.ts` and make a couple changes.

```typescript
// main.ts

const configUrl = '???';

// NOTE: IE11 will require a polyfill for fetch
fetch(configUrl, { cache: 'no-cache' })
  .then((response): Promise<AppConfig> => response.json())
  .then((json) => {
    platformBrowserDynamic([{ provide: APP_CONFIG, useValue: json }])
      .bootstrapModule(AppModule)
      .catch((err) => console.error(err));
  });
```

In a nutshell, we're going to wrap the call to bootstrap the Angular application with a fetch call to load the configuration.
_Note: IE 11 requires a polyfill for fetch support_

After using fetch to request the configuration, we then provide the `APP_CONFIG` injection token as an argument to `platformBrowserDynamic`.
When the `AppModule` provider factory functions inject the `APP_CONFIG`, they will be provided with this value we loaded dynamically! Note that
I'm specifying `{ cache: no-cache }` as an option to fetch - this is important to allow your application to always get the most up-to-date config.

Just one thing left - at what URL should we query the configuration? This is going to vary based upon your deployment/ops setup,
and also will vary between local development and production. This is actually a great use case for the default Angular environment strategy.
Open up `environment.ts`. In the environment object, add a field for `configurationUrl`. Repeat for `environment.prod.ts`.

```typescript
// environment.ts
export const environment = {
  production: false,
  configurationUrl: 'TODO',
};
```

Next, go back to `main.ts` and update to fetch the url provided from the environment:

```typescript
// main.ts
fetch(environment.configurationUrl, { cache: 'no-cache' });
```

First, let's setup dev mode.

## Loading Configuration in Development Mode

When developing locally, we probably want the configuration to be hosted locally. The simplest way to do that is to place the configuration
in the `assets` folder of your application. Since Nx is running on top of the Angular CLI, anything we put into assets will be available
as a static asset at runtime. I'm going to group it under a config folder: `apps/demo/src/assets/config/my-app.json`

```json
// assets/config/my-app.json
{
  "customers": {
    "enabled": true,
    "url": "http://fake-customers"
  },
  "widgets": {
    "enabled": true,
    "url": "http://fake-widgets"
  }
}
```

Now I can update `environment.ts` with the path to that file:

```typescript
// environment.ts
export const environment = {
  production: false,
  configurationUrl: 'assets/config/my-app.json',
};
```

Running `npm run start` at this point should yield a functional app again. You can try making a change to `my-app.json` - it should live reload
in the browser and your app should be updated. Nice! Next, we need to figure out how to deal with production builds.

## Loading Configuration in Production

Disclaimer - this section is probably going to vary based on how you deploy your application, and how you are going to manage the configuration
in production. If you're deploying using Docker and Kubernetes, maybe your app is running on NGINX and you're hosting the configuration JSON
at some relative path. Or perhaps you've got a 3rd-party service-discovery service that hosts all your configuration JSON at a well-known URL.
Regardless, the one key is that you need to have a known URL that you can put into the `environment.prod.ts` file.

Let's say you've got some backend service that is hosting all of your configuration JSON. You'd simply update the prod file with the path
to that service:

```typescript
// environment.prod.ts
export const environment = {
  production: true,
  configurationUrl: 'https://your-company-service-portal/my-app.json',
};
```

One last thing - we probably don't want our local development version of `my-app.json` to be shipped out in the production build of the application.
Right now, if you run `nx build --prod` and then `cat dist/apps/demo/assets/config/my-app.json`, you'll see the config is being included.
We need to instruct the Angular CLI to exclude that file in production builds. We can do that by modifying the production build configuration.

Let's open up `angular.json`, find the `demo` project, and drill down to `architect->build`. Around line 24 we'll see the static assets, and
around line 32 you'll see the declaration for the production configuration. We're going to redefine how assets are included in production builds.

```json
// angular.json
"configurations": {
  "production": {
    "fileReplacements": [{
      "replace": "apps/demo/src/environments/environment.ts",
      "with": "apps/demo/src/environments/environment.prod.ts"
    }],
    "assets": ["apps/demo/src/favicon.ico", {
      "glob": "**/*",
      "input": "apps/demo/src/assets/",
      "ignore": ["config/**"],
      "output": "/assets/"
    }]
  }
```

Running `nx build --prod` again, and the `my-app.json` file should not appear in the dist folder. (Note: if you have no other files
under assets, the entire dist/apps/demo/assets directory will be excluded).

## Summary

Hopefully this outlines an alternative way to load environment-specific configuration at runtime. I like this approach because it guarantees
the configuration is loaded before Angular even begins to bootstrap. We can then use the default provider factory functions and injection tokens
in order to work with these dynamic properties in a type-safe manner. The full example repository is up
on [GitHub](https://github.com/rpd10/example-angular-dynamic-environment).
