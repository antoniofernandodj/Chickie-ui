import { Component, input } from '@angular/core';

@Component({
  selector: 'ui-skeleton',
  standalone: true,
  template: `
    <div [class]="'skeleton bg-gray-200 ' + cls()"></div>
  `,
})
export class UiSkeletonComponent {
  cls = input('h-4 w-full rounded');
}
