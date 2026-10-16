import {
  afterNextRender,
  booleanAttribute,
  Component,
  computed,
  effect,
  ElementRef,
  forwardRef,
  inject,
  Injector,
  input,
  signal,
  viewChild,
} from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator,
} from '@angular/forms';
import { OverlayModule } from '@angular/cdk/overlay';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { IconComponent } from './icon.component';
import { dateValue, monthDays, parseDate } from './calendar-utils';

@Component({
  selector: 'app-date-picker',
  imports: [OverlayModule, CdkTrapFocus, IconComponent],
  templateUrl: './date-picker.component.html',
  styleUrl: './date-picker.component.css',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DatePickerComponent), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => DatePickerComponent), multi: true },
  ],
})
export class DatePickerComponent implements ControlValueAccessor, Validator {
  readonly inputId = input.required<string>();
  readonly label = input('Seleccionar fecha');
  readonly required = input(false, { transform: booleanAttribute });
  readonly min = input('');
  readonly max = input('');
  readonly value = signal('');
  readonly disabled = signal(false);
  readonly opened = signal(false);
  readonly active = signal(dateValue(new Date()));
  readonly month = signal(new Date());
  readonly days = computed(() => monthDays(this.month()));
  readonly heading = computed(() =>
    this.month().toLocaleDateString('es', { month: 'long', year: 'numeric' }),
  );
  readonly display = computed(() => {
    const date = parseDate(this.value());
    return date
      ? date.toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : 'Seleccionar fecha';
  });
  readonly weekdays = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];
  readonly dateValue = dateValue;
  readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  private readonly injector = inject(Injector);
  private onChange: (value: string) => void = () => {};
  private validatorChanged: () => void = () => {};
  onTouched: () => void = () => {};

  constructor() {
    effect(() => {
      this.min();
      this.max();
      this.required();
      this.validatorChanged();
    });
  }

  validate(control: AbstractControl): ValidationErrors | null {
    const value = control.value;
    if (!value) return this.required() ? { required: true } : null;
    if (!parseDate(value)) return { date: true };
    if (this.min() && value < this.min()) return { minDate: { min: this.min(), actual: value } };
    if (this.max() && value > this.max()) return { maxDate: { max: this.max(), actual: value } };
    return null;
  }
  registerOnValidatorChange(fn: () => void): void {
    this.validatorChanged = fn;
  }

  writeValue(value: string | null): void {
    this.value.set(value ?? '');
  }
  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
    if (disabled) this.close(false);
  }

  open(): void {
    if (this.disabled() || this.opened()) return;
    let date = parseDate(this.value()) ?? new Date();
    if (this.min() && dateValue(date) < this.min()) date = parseDate(this.min()) ?? date;
    if (this.max() && dateValue(date) > this.max()) date = parseDate(this.max()) ?? date;
    this.month.set(date);
    this.active.set(dateValue(date));
    this.opened.set(true);
  }

  focusDay(): void {
    afterNextRender(
      () => {
        this.panel()
          ?.nativeElement.querySelector<HTMLButtonElement>(`[data-date="${this.active()}"]`)
          ?.focus();
      },
      { injector: this.injector },
    );
  }

  close(restoreFocus = true): void {
    if (!this.opened()) return;
    this.opened.set(false);
    this.onTouched();
    if (restoreFocus) this.trigger()?.nativeElement.focus();
  }

  allowed(value: string): boolean {
    return (!this.min() || value >= this.min()) && (!this.max() || value <= this.max());
  }

  select(value: string): void {
    if (value && !this.allowed(value)) return;
    this.value.set(value);
    this.onChange(value);
    this.close();
  }

  moveMonth(offset: number): void {
    if (!this.monthAllowed(offset)) return;
    const current = this.month();
    const next = new Date(current.getFullYear(), current.getMonth() + offset, 1, 12);
    this.month.set(next);
    this.active.set(this.min() && dateValue(next) < this.min() ? this.min() : dateValue(next));
  }

  monthAllowed(offset: number): boolean {
    const current = this.month();
    const start = dateValue(new Date(current.getFullYear(), current.getMonth() + offset, 1, 12));
    const end = dateValue(new Date(current.getFullYear(), current.getMonth() + offset + 1, 0, 12));
    return (!this.min() || end >= this.min()) && (!this.max() || start <= this.max());
  }

  today(): string {
    return dateValue(new Date());
  }
  fullDate(date: Date): string {
    return date.toLocaleDateString('es', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  keydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.close();
      return;
    }
    if (!(event.target as HTMLElement).hasAttribute('data-date')) return;
    const date = parseDate(this.active())!;
    const offsets: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    if (event.key in offsets) date.setDate(date.getDate() + offsets[event.key]);
    else if (event.key === 'Home') date.setDate(date.getDate() - date.getDay());
    else if (event.key === 'End') date.setDate(date.getDate() + 6 - date.getDay());
    else if (event.key === 'PageUp' || event.key === 'PageDown') {
      const day = date.getDate();
      date.setDate(1);
      date.setMonth(date.getMonth() + (event.key === 'PageUp' ? -1 : 1));
      date.setDate(Math.min(day, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
    } else return;
    event.preventDefault();
    if (!this.allowed(dateValue(date))) return;
    this.active.set(dateValue(date));
    this.month.set(date);
    this.focusDay();
  }
}
