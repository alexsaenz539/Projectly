import { Pipe, PipeTransform } from '@angular/core';
@Pipe({ name: 'initials' })
export class InitialsPipe implements PipeTransform {
  transform(value: string): string {
    return value
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((x) => x[0] ?? '')
      .join('')
      .toUpperCase();
  }
}
