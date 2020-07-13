import { ScullyRoute } from '@scullyio/ng-lib';
import { Tag } from './tags.model';

export interface BlogRoute extends ScullyRoute {
  tags: Tag[];
  description: string;
  keywords: string[];
  date: string;
}
