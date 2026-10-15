import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { Icon } from '../icon/icon';

/**
 * Rodapé de paginação: "Mostrando 1–20 de 135", itens por página e páginas.
 * `page` começa em 0.
 */
@Component({
  selector: 'app-pagination',
  imports: [Icon],
  templateUrl: './pagination.html',
  styleUrl: './pagination.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Pagination {
  readonly page = input.required<number>();
  readonly size = input.required<number>();
  readonly total = input.required<number>();
  readonly totalPages = input.required<number>();
  readonly sizeOptions = input.required<readonly number[]>();
  /** Nome no plural para o resumo ("pessoas", "solicitações"). */
  readonly itemLabel = input('registros');

  readonly pageChange = output<number>();
  readonly sizeChange = output<number>();

  protected readonly from = computed(() =>
    this.total() === 0 ? 0 : this.page() * this.size() + 1,
  );
  protected readonly to = computed(() =>
    Math.min(this.total(), (this.page() + 1) * this.size()),
  );
  /** Podem vir do backend (`first`/`last` do Page do Spring). */
  readonly first = input<boolean | null>(null);
  readonly last = input<boolean | null>(null);

  protected readonly isFirst = computed(() => this.first() ?? this.page() <= 0);
  protected readonly isLast = computed(() => this.last() ?? this.page() >= this.totalPages() - 1);

  /** Números de página com reticências: 1 … 4 5 6 … 12. `null` = reticências. */
  protected readonly pages = computed<(number | null)[]>(() => {
    const total = this.totalPages();
    const current = this.page();
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i);
    }
    const set = new Set([0, total - 1, current - 1, current, current + 1]);
    const sorted = [...set].filter((p) => p >= 0 && p < total).sort((a, b) => a - b);
    const result: (number | null)[] = [];
    sorted.forEach((p, i) => {
      if (i > 0 && p - sorted[i - 1] > 1) {
        result.push(null);
      }
      result.push(p);
    });
    return result;
  });

  protected go(page: number): void {
    if (page !== this.page() && page >= 0 && page < this.totalPages()) {
      this.pageChange.emit(page);
    }
  }

  protected onSizeChange(event: Event): void {
    this.sizeChange.emit(Number((event.target as HTMLSelectElement).value));
  }
}
