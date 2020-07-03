import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
} from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { BlogDataService, BlogRoute, Tag } from '@rpd10/blog-data';
import { combineLatest, Observable, Subject } from 'rxjs';
import { map, startWith } from 'rxjs/operators';

@Component({
  selector: 'rpd10-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class HomeComponent {
  public filteredArticles$: Observable<BlogRoute[]>;
  private currentFilters$ = new Subject<Tag[]>();
  constructor(
    public articlesService: BlogDataService,
    private title: Title,
    private meta: Meta
  ) {
    this.title.setTitle('Diehl With Software');
    this.meta.updateTag({
      name: 'description',
      content: 'Software related blog with articles focused mainly on Angular.',
    });
    this.meta.updateTag({
      name: 'keywords',
      content: 'angular, blog, nx, Ryan Diehl, @DiehlWithRyan',
    });

    this.filteredArticles$ = combineLatest([
      this.articlesService.articles$,
      this.currentFilters$.asObservable().pipe(startWith([])),
    ]).pipe(
      map(([articles, tags]) =>
        tags.length > 0
          ? articles.filter((a) => (a.tags || []).some((t) => tags.includes(t)))
          : articles
      )
    );
  }

  public updateFilter(tags: Tag[]): void {
    this.currentFilters$.next(tags);
  }
}
