import { Injectable } from '@angular/core';
import { ScullyRoutesService } from '@scullyio/ng-lib';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { BlogRoute } from './blog.model';
import { Tag } from './tags.model';

@Injectable({ providedIn: 'root' })
export class BlogDataService {
  public articles$: Observable<BlogRoute[]>;
  public tags$: Observable<Tag[]>;

  constructor(private scullyRoutes: ScullyRoutesService) {
    this.articles$ = this.scullyRoutes.available$.pipe(
      map(
        (routes) =>
          <BlogRoute[]>(
            routes
              .filter((r) => r.route.startsWith('/blog/'))
              .sort((a, b) =>
                new Date(a.date).getTime() < new Date(b.date).getTime() ? 1 : -1
              )
          )
      )
    );

    this.tags$ = this.scullyRoutes.available$.pipe(
      map((routes: BlogRoute[]) =>
        routes.reduce((set, cur) => {
          (cur.tags || []).forEach((tag) => set.add(tag));
          return set;
        }, new Set<Tag>())
      ),
      map((tags) => [...tags].sort())
    );
  }
}
