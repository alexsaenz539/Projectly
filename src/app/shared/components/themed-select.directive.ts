import {
  ComponentRef,
  Directive,
  ElementRef,
  inject,
  OnDestroy,
  ViewContainerRef,
} from '@angular/core';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { Subscription } from 'rxjs';
import { SelectPanelComponent } from './select-panel.component';

let nextSelectId = 0;

/** Enhances native selects without changing their options, forms, or change events. */
@Directive({
  selector: 'select',
  host: {
    class: 'themed-select',
    '[attr.aria-expanded]': 'opened',
    'aria-haspopup': 'listbox',
    '(pointerdown)': 'pointerdown($event)',
    '(click)': 'click($event)',
    '(keydown)': 'keydown($event)',
  },
})
export class ThemedSelectDirective implements OnDestroy {
  private readonly element = inject<ElementRef<HTMLSelectElement>>(ElementRef).nativeElement;
  private readonly overlay = inject(Overlay);
  private readonly viewContainer = inject(ViewContainerRef);
  private ref?: OverlayRef;
  private panel?: ComponentRef<SelectPanelComponent>;
  private subscriptions = new Subscription();
  private readonly id = `projectly-select-${nextSelectId++}`;
  opened = false;

  pointerdown(event: PointerEvent): void {
    if (event.button !== 0 || this.element.disabled) return;
    event.preventDefault();
    this.element.focus();
  }
  click(event: MouseEvent): void {
    event.preventDefault();
    this.open();
  }
  keydown(event: KeyboardEvent): void {
    if (['Enter', ' ', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      this.open();
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      this.open();
      this.panel?.instance.keydown(event);
    }
  }

  private open(): void {
    if (this.opened || this.element.disabled) return;
    this.opened = true;
    this.ref = this.overlay.create({
      width: this.element.getBoundingClientRect().width,
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-transparent-backdrop',
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
      positionStrategy: this.overlay
        .position()
        .flexibleConnectedTo(this.element)
        .withViewportMargin(12)
        .withPush(true)
        .withPositions([
          { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 },
          { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 },
        ]),
    });
    this.panel = this.ref.attach(new ComponentPortal(SelectPanelComponent, this.viewContainer));
    this.panel.setInput(
      'options',
      Array.from(this.element.options).map((option) => ({
        label: option.label,
        value: option.value,
        disabled:
          option.disabled ||
          (option.parentElement instanceof HTMLOptGroupElement && option.parentElement.disabled),
      })),
    );
    this.panel.setInput('value', this.element.value);
    this.panel.setInput(
      'label',
      this.element.getAttribute('aria-label') ||
        Array.from(this.element.labels ?? [])
          .map((label) => label.textContent?.trim())
          .join(' ') ||
        'Seleccionar opción',
    );
    this.panel.setInput('id', this.id);
    this.panel.changeDetectorRef.detectChanges();
    this.panel.instance.focus();
    this.element.setAttribute('aria-controls', this.id + '-list');
    this.panel.instance.list()?.nativeElement.setAttribute('id', this.id + '-list');
    this.panel.instance.chosen.subscribe((value) => {
      this.element.value = value;
      this.element.dispatchEvent(new Event('change', { bubbles: true }));
      this.close();
    });
    this.panel.instance.dismissed.subscribe(() => this.close());
    this.subscriptions.add(this.ref.backdropClick().subscribe(() => this.close()));
  }

  private close(restoreFocus = true): void {
    if (!this.opened) return;
    this.opened = false;
    this.element.removeAttribute('aria-controls');
    this.subscriptions.unsubscribe();
    this.subscriptions = new Subscription();
    this.ref?.dispose();
    this.ref = undefined;
    this.panel = undefined;
    if (restoreFocus) this.element.focus();
  }

  ngOnDestroy(): void {
    this.close(false);
  }
}
