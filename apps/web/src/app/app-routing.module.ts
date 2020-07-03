import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';

@NgModule({
  imports: [
    RouterModule.forRoot([
      {
        path: '',
        pathMatch: 'full',
        loadChildren: () => import('@rpd10/home').then((m) => m.HomeModule),
      },
      {
        path: 'blog',
        loadChildren: () => import('@rpd10/blog').then((m) => m.BlogModule),
      },
      {
        path: '**',
        redirectTo: '',
      },
    ]),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
