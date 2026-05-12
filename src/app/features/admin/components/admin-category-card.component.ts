import { Component, input, output } from '@angular/core';
import { CdkDrag, CdkDragHandle } from '@angular/cdk/drag-drop';
import { CategoriaProdutos, Produto } from '../../../core/models';
import { AdminProductCardComponent } from './admin-product-card.component';
import { UiButtonComponent } from '../../../shared/components';
import { ContextMenuDirective } from '../../../shared/directives/context-menu.directive';
import type { ContextMenuItem } from '../../../core/services/context-menu.service';

@Component({
  selector: 'admin-category-card',
  standalone: true,
  imports: [
    CdkDrag,
    CdkDragHandle,
    AdminProductCardComponent,
    UiButtonComponent,
    ContextMenuDirective,
  ],
  template: `
    <div
      class="bg-white rounded-xl border border-gray-200 overflow-hidden"
      cdkDrag
    >
      <!-- Categoria header -->
      <div
        class="bg-gray-50 px-4 py-3 flex items-center justify-between"
        [appContextMenu]="categoriaMenuItems"
      >
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <span
            cdkDragHandle
            class="cursor-grab text-gray-300 hover:text-gray-500 transition-colors shrink-0"
            title="Arrastar para reordenar"
          >
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 8h16M4 16h16"
              />
            </svg>
          </span>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-gray-900">{{ categoria().nome }}</p>
            @if (categoria().descricao) {
              <p class="text-xs text-gray-500">{{ categoria().descricao }}</p>
            }
            <p class="text-xs text-gray-400">
              {{ produtos().length }} produto(s)
              @if (categoria().pizza_mode) {
                · <span class="text-xs font-medium text-orange-600">🍕 Modo Pizza</span>
              }
            </p>
          </div>
        </div>
        @if (categoria().loja_uuid) {
          <div class="flex gap-2 shrink-0 ml-3">
            <ui-button
              variant="ghost"
              size="xs"
              (click)="editar.emit()"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </ui-button>
            <ui-button
              variant="danger"
              size="xs"
              (click)="deletar.emit()"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </ui-button>
          </div>
        }
      </div>

      <!-- Produtos da categoria -->
      <div class="px-3 py-2">
        @if (produtos().length === 0) {
          <p class="text-xs text-gray-400 py-2 pl-1">Nenhum produto nesta categoria.</p>
        } @else {
          <div class="space-y-1.5">
            @for (prod of produtos(); track prod.uuid) {
              <admin-product-card
                [produto]="prod"
                (toggleDisponivel)="toggleProdutoDisponivel.emit(prod)"
                (editar)="editarProduto.emit(prod)"
                (remover)="removerProduto.emit(prod)"
              />
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class AdminCategoryCardComponent {
  categoria = input.required<CategoriaProdutos>();
  produtos = input<Produto[]>([]);
  editar = output<void>();
  deletar = output<void>();
  toggleProdutoDisponivel = output<Produto>();
  editarProduto = output<Produto>();
  removerProduto = output<Produto>();

  get categoriaMenuItems(): ContextMenuItem[] {
    if (!this.categoria().loja_uuid) return [];
    return [
      {
        icon: '✏️',
        label: 'Editar categoria',
        action: () => this.editar.emit(),
      },
      'separator',
      {
        icon: '🗑️',
        label: 'Excluir categoria',
        variant: 'danger',
        action: () => this.deletar.emit(),
      },
    ];
  }
}
