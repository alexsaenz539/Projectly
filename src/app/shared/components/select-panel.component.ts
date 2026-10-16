import { Component, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { IconComponent } from './icon.component';

export interface SelectOption {
  label: string;
  value: string;
  disabled: boolean;
}

@Component({
  selector: 'app-select-panel',
  imports: [IconComponent],
  templateUrl: './select-panel.component.html',
  styleUrl: './select-panel.component.css',
})
export class SelectPanelComponent {
  readonly options = input<SelectOption[]>([]);
  readonly value = input('');
  readonly label = input('Seleccionar opción');
  readonly id = input('select-option');
  readonly active = signal(-1);
  readonly chosen = output<string>();
  readonly dismissed = output<void>();
  readonly list = viewChild<ElementRef<HTMLElement>>('list');
  private search = '';
  private lastTyped = 0;

  focus(): void {
    const selected = this.options().findIndex(
      (option) => option.value === this.value() && !option.disabled,
    );
    this.active.set(
      selected >= 0 ? selected : this.options().findIndex((option) => !option.disabled),
    );
    this.list()?.nativeElement.focus();
    this.scrollActive();
  }

  private scrollActive(): void {
    this.list()
      ?.nativeElement.querySelectorAll<HTMLElement>('[role="option"]')
      [this.active()]?.scrollIntoView({ block: 'nearest' });
  }

  keydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' || event.key === 'Tab') {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
      }
      this.dismissed.emit();
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const option = this.options()[this.active()];
      if (option && !option.disabled) this.chosen.emit(option.value);
      return;
    }
    const enabled = this.options()
      .map((option, index) => (option.disabled ? -1 : index))
      .filter((index) => index >= 0);
    if (!enabled.length) return;
    const position = enabled.indexOf(this.active());
    if (event.key === 'ArrowDown') this.active.set(enabled[(position + 1) % enabled.length]);
    else if (event.key === 'ArrowUp')
      this.active.set(enabled[(position - 1 + enabled.length) % enabled.length]);
    else if (event.key === 'Home') this.active.set(enabled[0]);
    else if (event.key === 'End') this.active.set(enabled[enabled.length - 1]);
    else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      this.search = Date.now() - this.lastTyped > 700 ? event.key : this.search + event.key;
      this.lastTyped = Date.now();
      const match = enabled.find((index) =>
        this.options()[index].label.toLocaleLowerCase().startsWith(this.search.toLocaleLowerCase()),
      );
      if (match !== undefined) this.active.set(match);
    } else return;
    event.preventDefault();
    this.scrollActive();
  }
}
