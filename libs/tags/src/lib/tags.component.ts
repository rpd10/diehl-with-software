import { COMMA, ENTER } from '@angular/cdk/keycodes';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatChipInputEvent } from '@angular/material/chips';
import { Tag } from '@rpd10/blog-data';
import { combineLatest, Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';

@Component({
  selector: 'rpd10-tags',
  templateUrl: './tags.component.html',
  styleUrls: ['./tags.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TagsComponent implements OnInit {
  @Input() public tags$: Observable<Tag[]>;

  @Output() public tagsChange = new EventEmitter<Tag[]>();

  public separatorKeysCodes: number[] = [ENTER, COMMA];
  public selectedTags: Tag[] = [];
  public filteredTags$: Observable<Tag[]>;
  public tagsControl = new FormControl();

  @ViewChild('tagsInput') tagsInput: ElementRef<HTMLInputElement>;

  public ngOnInit(): void {
    this.filteredTags$ = combineLatest([
      this.tagsControl.valueChanges.pipe(startWith('')),
      this.tags$.pipe(map((t) => t || [])),
      this.tagsChange.asObservable().pipe(startWith([])),
    ]).pipe(
      map(([filter, tags]) =>
        filter
          ? tags.filter(
              (t) => t.toLowerCase().indexOf(filter.toLowerCase()) === 0
            )
          : tags
      ),
      map((filtered) => filtered.filter((t) => !this.selectedTags.includes(t)))
    );
  }

  public add(event: MatChipInputEvent): void {
    const input = event.input;
    const value = <Tag>event.value;

    // Add our tag
    if ((value || '').trim()) {
      this.selectedTags.push(value);
      this.tagsChange.emit(this.selectedTags);
    }

    // Reset the input value
    if (input) {
      input.value = '';
    }

    this.tagsControl.setValue(null);
  }

  public remove(tag: Tag): void {
    const index = this.selectedTags.indexOf(tag);

    if (index >= 0) {
      this.selectedTags.splice(index, 1);
      this.tagsChange.emit(this.selectedTags);
    }
  }

  public selected(event: MatAutocompleteSelectedEvent): void {
    this.selectedTags.push(<Tag>event.option.viewValue);
    this.tagsChange.emit(this.selectedTags);
    this.tagsInput.nativeElement.value = '';
    this.tagsControl.setValue(null);
  }
}
