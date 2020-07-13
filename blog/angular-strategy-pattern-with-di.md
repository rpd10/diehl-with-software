---
title: Strategy Pattern in Angular Using Dependency Injection
description: Use Angular's built-in dependency injection features to implement a variation of the strategy pattern and isolate your code from changes in vendor code and other third party dependencies.
published: true
date: '2020-07-12'
tags: ['Angular', 'Dependency Injection', 'Design Patterns']
keywords:
  [
    'angular strategy pattern',
    'angular dependency injection',
    'angular class interface',
    'angular design patterns',
  ]
---

# Strategy Pattern in Angular Using Dependency Injection

Lately I've been working on swapping out our authentication provider. I started out doing some proof-of-concept work, but in
order to be able to update our existing apps in production, there's a lot to consider - interceptors, guards, login and logout
actions. Authentication is usually a cross-cutting concern, so if you have many applications in your enterprise, you've probably
implemented some sort of shared library to handle it (hopefully not built from scratch). Much of that logic is unlikely to change
if the auth provider changes. In this article, I'll show how you can leverage Angular's dependency injection to compose a strategy
for decoupling the implementation of your authentication provider. We'll focus on two aspects here - the login/logout flow, and
token acquisition for an OAuth 2.0 implementation. I'm not even going to name-drop the auth provider I'm using - with the
pattern I'm going to show, it doesn't matter!

You may have heard the phrase "favor composition over inheritance" when talking about object-oriented programming. One design
pattern that illustrates this is the [Strategy Pattern](https://en.wikipedia.org/wiki/Strategy_pattern). To use this pattern,
you need to define various interfaces in order to abstract certain behaviors of a software system. Typescript provides interfaces,
but Angular cannot use them in dependency injection, because the interface is only relevant at compile-time. We'll see how to
deal with that later.

In our authentication example, we can break it down into two main sets of behaviors we need to model. First, we need to handle
logging in and out, and showing details about the currently logged in user. We will probably have components that need to show
user details, and a login/logout button on a component somewhere. Additionally, if we're using routing, we will probably have
router guards in place to protect some routes - those routes will need to know if a user is logged in before allowing access to
the page. Second, after the user is logged in, we need to handle acquiring OAuth 2.0 tokens in order to communicate with our
backend APIs. Angular's HTTP interceptors are a great place to do that token acquisition.

## Login and Logout

Let's start at the beginning for most enterprise apps - login. Again, I'm not going to focus on any specific authentication technology
here. We'll tackle the routing first. For the purposes of this exercise, let's say that we've got 2 routes in our application.
One of them is a dedicated login page, and the other is a protected page that only authenticated users should be able to see.
Here's what our `app-routing.module` might look like:

```typescript
// app-routing.module.ts
const routes: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    component: LoginComponent,
  },
  {
    path: 'protected',
    component: ProtectedComponent,
    canActivate: [RequireAuthGuard],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
```

If someone tries to access the `/protected` route, our `RequireAuthGuard` will kick in and ensure the user is authenticated.
Here's what the guard looks like:

```typescript
// require-auth.guard.ts
import {
  CanActivate,
  Router,
  UrlTree,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
} from '@angular/router';
import { AuthStrategy } from './auth.strategy';

@Injectable({ providedIn: 'root' })
export class RequireAuthGuard implements CanActivate {
  constructor(private router: Router, private authStrategy: AuthStrategy) {}

  public canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): true | UrlTree {
    if (this.authStrategy.isLoggedIn()) {
      return true;
    }

    try {
      this.authStrategy.loginRedirect(state.url);
      return true;
    } catch (err) {
      return this.router.parseUrl('/');
    }
  }
}
```

The guard is fairly straightforward. If the user is logged in, allow access to the route, otherwise ask the auth service to authenticate
the user using a redirect flow. If anything fails in that processs, redirect to the root of the app. We leverage Angular's dependency
injection to inject an `AuthStrategy` that will tell us if the user is logged in and handle the authentication details. Here's our `AuthStrategy`:

```typescript
// auth.strategy.ts
export abstract class AuthStrategy {
  isLoggedIn: () => boolean;

  getUserName: () => string;

  loginRedirect: (targetUrl: string) => any;

  logout: () => any;
}
```

Hmm...interesting. The AuthStrategy doesn't really do anything, it's just an abstract class that defines some methods. This is what's
called a ["class interface"](https://angular.io/guide/dependency-injection-in-action#provider-token-alternatives-class-interface-and-injectiontoken).
Since Angular's dependency injection system does not support injecting an interface, this is a way that you can accomplish the same thing.
The abstract class defines an interface for our login behaviors. Our guard only interacts with the abstract `AuthStrategy`, so it is
totally isolated from the implementation details of the authentication provider.

Let's look at the `LoginComponent` next, we'll see the same absraction.

```typescript
// login.component.ts
@Component({...})
export class LoginComponent {
  constructor(private authStrategy: AuthStrategy) {}

  public login() {
    this.authStrategy.loginRedirect('/protected');
  }
}
```

Using this strategy, we can have many different components - think app bar, sidenav, footer, etc. - be aware of the login state _without_
being aware of the auth implementation.

## Token Acquisition

After we've gotten a user logged in, let's assume the next problem we need to solve is calling a REST API on behalf of that user in an OAuth 2.0 flow.
We'll need to interact with our auth provider to acquire a token with the appropriate scopes. Angular's HTTP interceptors are a good choice for this.
Here again, the main flow of the interceptor is unlikely to vary between auth providers, while the details of how token acquisition happens probably will.
Let's sketch out the basic flow of the interceptor:

```typescript
// auth.interceptor.ts
import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, mergeMap } from 'rxjs/operators';
import { TokenStrategy } from './token.strategy';

const HTTP_AUTHORIZATION_HEADER = 'Authorization';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private tokenStrategy: TokenStrategy) {}

  public intercept(
    req: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    // figure out if the request requires authentication.
    const shouldAuth = this.requiresAuth(req);

    if (shouldAuth) {
      return this.tokenStrategy.acquireToken(req).pipe(
        mergeMap((token) =>
          next
            .handle(
              req.clone({
                setHeaders: {
                  [HTTP_AUTHORIZATION_HEADER]: `Bearer ${token}`,
                },
              })
            )
            .pipe(
              catchError((err) => {
                // if the error is HTTP 401, call the token service to handle the error
                if (
                  err instanceof HttpErrorResponse &&
                  err.status === 401 &&
                  this.tokenStrategy.onUnauthorized
                ) {
                  this.tokenStrategy.onUnauthorized(err, token);
                }
                return throwError(err);
              })
            )
        )
      );
    } else {
      return next.handle(req);
    }
  }

  private requiresAuth(req: HttpRequest<any>): boolean {
    return (
      !req.headers.has(HTTP_AUTHORIZATION_HEADER) &&
      this.tokenStrategy.requiresAuth(req)
      // plus whatever other rules you may have - check headers, etc.
    );
  }
}
```

First we'll check the outgoing HTTP request to see if we should even bother acquiring a token - maybe it's going to a public endpoint,
or maybe it's already been authorized using some other means. If the request requires a token, we'll reach out to the token service to acquire one,
pipe the result and set the `Authorization` header for the outgoing request, and then forward the cloned request along the HTTP interceptor chain.
We also use the catchError operator to check for HTTP 401 Unauthorized responses, and notify the token handler. Here's our `TokenStrategy`
another class interface with no implementation.:

```typescript
// token.service.ts
import { HttpErrorResponse, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';

export abstract class TokenStrategy {
  /**
   * Determine whether this token handler is able to acquire a token for a given request.
   *
   * @returns true if this token handler is able to acquire a token for the given request, false otherwise
   */
  requiresAuth: (req: HttpRequest<any>) => boolean;

  /**
   * Acquire a token for the given request.
   *
   * @returns an Observable of a bearer token
   */
  acquireToken: (req: HttpRequest<any>) => Observable<string>;

  /**
   * Handle HTTP 401 Unauthorized responses from the server.  This function is optional.
   * The auth provider may want to clear token caches, etc.
   */
  onUnauthorized?: (err: HttpErrorResponse, token: string) => void;
}
```

## Providing Concrete Implementations

We've decoupled the implementation details from the guard, components, and interceptors, but we still need to provide an auth implementation
in order for the app to run. For the purposes of this demonstration, we'll just outline a mock auth service and token service with some pseudo-code.

```typescript
// mock-auth.service.ts
@Injectable({ providedIn: 'root' })
export class MockAuthService implements AuthStrategy {
  constructor(private mockAuthLib: MockAuthLib) {}

  getUserName = () => this.mockAuthLib.getIdToken()?.userName;

  isLoggedIn = () => !!this.getUserName();

  loginRedirect = (targetUrl: string) =>
    this.mockAuthLib.loginWithRedirect(targetUrl);

  logout = () => this.mockAuthLib.logout();
}

// mock-token.service.ts
@Injectable({ providedIn: 'root' })
export class MockTokenStrategy implements TokenStrategy {
  constructor(private mockAuthLib: MockAuthLib) {}

  requiresAuth = (req: HttpRequest<any>) =>
    this.mockAuthLib.isProtectedRequest(req.url);

  acquireToken = (req: HttpRequest<any>) =>
    this.mockAuthLib.acquireTokenSilent(req.url);

  onUnauthorized = (err: HttpErrorResponse, token: string) =>
    this.mockAuthLib.clearTokenCache(token);
}
```

The final piece of the puzzle is telling Angular's dependency injection how to provide the `AuthStrategy` and `TokenStrategy` for our
components, guards, and interceptors. Remember, those resources inject the generic class interfaces, not a specific implementation,
so we have to tell Angular which class to use as the concrete class. To do that, we can use the `useExisting` provider option.

```typescript
// app.module.ts
@NgModule({
  imports: [
    HttpClientModule,
    MockAuthLibModule, // whatever auth library you're using
    ...
  ],
  declarations: [...],
  providers: [
    { provide: HTTP_INTERCEPTORS, multi: true, useClass: AuthInterceptor },
    { provide: AuthStrategy, useExisting: MockAuthService },
    { provide: TokenStrategy, useExisting: MockTokenService }
  ]
})
export class AppModule {}
```

With this configuration, Angular will be able to inject the correct implementations, and all is well. The beauty of this is that in
the future when you need to support some other authentication method, the amount of code you need to change is minimized - you don't
need to touch any of the guards, interceptors, components or other services - you just need to provide a new implementation for the
strategies! Once you embrace this powerful pattern, you will find yourself using it to isolate your code from changes in third party
dependencies.

You can see an example repository here: https://github.com/rpd10/example-angular-strategy-pattern
