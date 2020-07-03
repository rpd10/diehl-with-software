import { AfterViewChecked, Component, ViewEncapsulation } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { BlogDataService } from '@rpd10/blog-data';
import { combineLatest } from 'rxjs';
import { map, pluck, take } from 'rxjs/operators';
import { HighlightService } from './highlight.service';

@Component({
  selector: 'rpd10-blog',
  templateUrl: './blog.component.html',
  styleUrls: ['./blog.component.scss'],
  preserveWhitespaces: true,
  encapsulation: ViewEncapsulation.Emulated,
})
export class BlogComponent implements AfterViewChecked {
  public shareLink: string;

  constructor(
    private activatedRoute: ActivatedRoute,
    private highlightService: HighlightService,
    private blogDataService: BlogDataService,
    private title: Title,
    private meta: Meta
  ) {
    combineLatest([
      this.activatedRoute.params.pipe(pluck('slug')),
      this.blogDataService.articles$,
    ])
      .pipe(
        map(([slug, routes]) =>
          routes.find((r) => r.route === `/blog/${slug}`)
        ),
        take(1)
      )
      .subscribe((article) => {
        this.title.setTitle(`${article.title} | Diehl With Software`);
        this.meta.updateTag({
          name: 'keywords',
          content: [
            'blog',
            ...(article.tags || []),
            ...(article.keywords || []),
          ].join(', '),
        });
        this.meta.updateTag({
          name: 'description',
          content: article.description,
        });

        this.shareLink = `https://twitter.com/intent/tweet?url=${window.location.href}`;
      });
  }

  public ngAfterViewChecked(): void {
    this.highlightService.highlightAll();
  }
}
