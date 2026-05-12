import { Component, inject, input, signal, computed, effect, DestroyRef, OnInit } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { toast } from 'ngx-sonner';
import { PedidosLiveService } from '../../../core/services/pedidos-live.service';
import { PedidoService } from '../../../core/services/pedido.service';
import { AuthService } from '../../../core/services/auth.service';
import { PhonePipe } from '../../../shared/pipes/phone.pipe';
import { UiTabBarComponent, ChatPanelComponent, STATUS_PEDIDO_CFG, UiButtonComponent, UiCheckboxComponent } from '../../../shared/components';
import { Pedido, StatusPedido, ItemPedido, PaginatedResponse } from '../../../core/models';
import type { UiTab } from '../../../shared/components';

const STATUS_CFG = STATUS_PEDIDO_CFG;

@Component({
  selector: 'admin-pedidos-tab',
  standalone: true,
  imports: [DecimalPipe, DatePipe, PhonePipe, FormsModule, UiTabBarComponent, ChatPanelComponent, UiButtonComponent, UiCheckboxComponent],
  template: `
    <div class="space-y-4">
      <!-- Header + refresh -->
      <div class="flex items-center justify-between mb-1">
        <h2 class="text-lg font-black text-gray-900">Pedidos recebidos</h2>
        <div
          (click)="refreshPedidos()"
          (keydown.enter)="refreshPedidos()"
          role="button"
          tabindex="0"
          class="inline-flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-full border-2 transition-all hover:opacity-80 cursor-pointer"
          style="
            color: var(--color-brand);
            border-color: var(--color-brand-light);
            background: var(--color-brand-light);
          "
        >
          <svg
            class="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Atualizar
        </div>
      </div>

      <!-- Filtros de status -->
      <div class="flex gap-2 overflow-x-auto pb-1">
        @for (entry of statusEntries; track entry.key) {
          <div
            (click)="pedidoFiltroStatus.set(entry.key)"
            (keydown.enter)="pedidoFiltroStatus.set(entry.key)"
            role="button"
            tabindex="0"
            class="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold border-2 transition-all duration-150 whitespace-nowrap cursor-pointer"
            [class]="
              pedidoFiltroStatus() === entry.key
                ? 'border-transparent text-white shadow-sm'
                : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-700'
            "
            [style.background]="pedidoFiltroStatus() === entry.key ? 'var(--color-brand)' : ''"
          >
            {{ entry.cfg.icon }} {{ entry.cfg.label }}
          </div>
        }
      </div>

      <!-- Loading -->
      @if (pedidosLoading()) {
        <div class="flex justify-center py-12">
          <svg
            class="animate-spin h-8 w-8 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            />
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        </div>
      } @else if (pedidos().length === 0) {
        <div class="text-center py-12 bg-white rounded-2xl border border-gray-100">
          <p class="text-4xl mb-3">📋</p>
          <p class="text-gray-500 text-sm">Nenhum pedido encontrado.</p>
        </div>
      } @else {
        <div class="space-y-2.5">
          @for (pedido of pedidos(); track pedido.uuid) {
            <div
              class="bg-white rounded-3xl overflow-hidden"
              style="
                box-shadow:
                  0 2px 8px rgba(0, 0, 0, 0.07),
                  0 0 1px rgba(0, 0, 0, 0.06);
              "
            >
              <!-- Accordion header -->
              <div
                role="button"
                tabindex="0"
                (click)="toggleExpandPedido(pedido.uuid)"
                (keydown.enter)="toggleExpandPedido(pedido.uuid)"
                class="w-full flex items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-orange-50/50 active:bg-orange-50 cursor-pointer"
              >
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5 mb-0.5">
                    <span
                      class="text-xs font-bold font-mono"
                      style="color: var(--color-brand)"
                      >{{ pedido.codigo || pedido.uuid.slice(0, 8) }}</span
                    >
                    <span class="text-gray-200 text-xs">·</span>
                    <span class="text-xs font-semibold text-gray-400">{{
                      pedido.criado_em | date: 'dd/MM HH:mm'
                    }}</span>
                  </div>
                  <p class="text-sm font-bold text-gray-700 truncate">
                    {{ pedidoResumoItens(pedido) }}
                  </p>
                </div>
                <span class="text-base font-black text-gray-900 shrink-0"
                  >R$ {{ pedido.total | number: '1.2-2' }}</span
                >
                <svg
                  class="w-4 h-4 shrink-0 transition-transform duration-200"
                  style="color: var(--color-brand)"
                  [class.rotate-180]="isPedidoExpanded(pedido.uuid)"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>

              <!-- Accordion body -->
              <div
                class="grid overflow-hidden transition-all duration-200 ease-in-out"
                [style.grid-template-rows]="isPedidoExpanded(pedido.uuid) ? '1fr' : '0fr'"
              >
                <div class="overflow-hidden">
                  <!-- Itens -->
                  <div class="px-5 py-3 space-y-2 border-t border-gray-100">
                    @for (item of pedido.itens; track item.uuid; let idx = $index) {
                      <div class="flex items-start gap-3">
                        <span
                          class="mt-0.5 w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-xs font-bold flex items-center justify-center shrink-0"
                        >
                          {{ idx + 1 }}
                        </span>
                        <div class="flex-1 min-w-0">
                          @if (item.partes.length === 1) {
                            <p class="text-sm font-medium text-gray-800">
                              {{ item.quantidade }}× {{ item.partes[0].produto_nome }}
                            </p>
                            @if (item.partes[0].adicionais.length > 0) {
                              <p class="text-xs text-gray-400 mt-0.5">
                                + {{ item.partes[0].adicionais[0].nome
                                }}{{
                                  item.partes[0].adicionais.length > 1
                                    ? ' e mais ' + (item.partes[0].adicionais.length - 1)
                                    : ''
                                }}
                              </p>
                            }
                          } @else {
                            <p class="text-sm font-medium text-gray-800 mb-1">
                              {{ item.quantidade }}× Pizza ({{ item.partes.length }} sabores)
                            </p>
                            @for (parte of item.partes; track parte.uuid) {
                              <div class="flex items-start gap-1.5 text-xs text-gray-600">
                                <span
                                  class="w-4 h-4 rounded-full text-white flex items-center justify-center font-bold shrink-0 mt-0.5"
                                  style="background: var(--color-brand); font-size: 10px"
                                  >{{ parte.posicao }}</span
                                >
                                <span>
                                  {{ parte.produto_nome }}
                                  @if (parte.adicionais.length > 0) {
                                    <span class="text-gray-400">
                                      + {{ parte.adicionais[0].nome
                                      }}{{
                                        parte.adicionais.length > 1
                                          ? ' e mais ' + (parte.adicionais.length - 1)
                                          : ''
                                      }}</span
                                    >
                                  }
                                </span>
                              </div>
                            }
                          }
                          @if (item.observacoes) {
                            <p class="text-xs text-gray-400 italic mt-0.5">"{{ item.observacoes }}"</p>
                          }
                        </div>
                        <span class="text-sm font-semibold text-gray-700 shrink-0">
                          R$ {{ itemPrecoPedido(item) * item.quantidade | number: '1.2-2' }}
                        </span>
                      </div>
                      @if (!$last) {
                        <div class="ml-8 border-t border-dashed border-gray-100"></div>
                      }
                    }
                  </div>

                  <!-- Contato + Endereço de entrega -->
                  @if (pedido.contato || pedido.endereco_entrega) {
                    <div class="px-5 py-2.5 border-t border-gray-100 space-y-1">
                      @if (pedido.contato) {
                        <p class="text-xs text-gray-500 flex items-center gap-1">
                          <span class="font-medium">Contato:</span>
                          <a
                            [href]="'https://wa.me/55' + pedido.contato"
                            target="_blank"
                            rel="noopener"
                            class="flex items-center gap-1 text-green-600 hover:underline"
                          >
                            <svg
                              class="w-3.5 h-3.5 shrink-0"
                              viewBox="0 0 32 32"
                              fill="currentColor"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                d="M16 2C8.268 2 2 8.268 2 16c0 2.49.651 4.824 1.788 6.845L2 30l7.343-1.764A13.94 13.94 0 0 0 16 30c7.732 0 14-6.268 14-14S23.732 2 16 2zm0 25.5a11.44 11.44 0 0 1-5.835-1.6l-.418-.248-4.358 1.048 1.077-4.24-.272-.435A11.46 11.46 0 0 1 4.5 16C4.5 9.596 9.596 4.5 16 4.5S27.5 9.596 27.5 16 22.404 27.5 16 27.5zm6.29-8.618c-.345-.173-2.04-1.006-2.356-1.12-.317-.115-.547-.173-.778.173-.23.345-.893 1.12-1.095 1.35-.2.23-.403.26-.748.086-.345-.173-1.457-.537-2.775-1.713-1.026-.916-1.718-2.047-1.92-2.392-.2-.345-.021-.531.152-.703.155-.155.345-.403.518-.605.172-.2.23-.345.345-.575.115-.23.058-.432-.029-.605-.086-.173-.778-1.876-1.066-2.57-.28-.673-.565-.582-.778-.593l-.662-.011c-.23 0-.605.086-.921.432-.317.345-1.21 1.182-1.21 2.882s1.239 3.342 1.411 3.572c.173.23 2.438 3.722 5.908 5.217.826.356 1.47.569 1.973.728.829.263 1.584.226 2.18.137.665-.1 2.04-.834 2.328-1.638.287-.805.287-1.494.2-1.638-.086-.144-.317-.23-.662-.403z"
                              />
                            </svg>
                            {{ pedido.contato | phone }}
                          </a>
                        </p>
                      }
                      @if (pedido.endereco_entrega) {
                        @let e = pedido.endereco_entrega;
                        <p class="text-xs text-gray-500">
                          📍 {{ e.logradouro }}, {{ e.numero
                          }}{{ e.complemento ? ' — ' + e.complemento : '' }}, {{ e.bairro }} —
                          {{ e.cidade }}/{{ e.estado }}{{ e.cep ? ' · ' + e.cep : '' }}
                        </p>
                      }
                    </div>
                  }

                  <!-- Rodapé: totais + ações -->
                  <div
                    class="px-5 py-3.5 border-t border-gray-100 flex items-center justify-between gap-3"
                    style="background: var(--color-brand-light)"
                  >
                    <div class="flex items-center gap-2 text-sm">
                      <span class="font-black text-gray-900"
                        >R$ {{ pedido.total | number: '1.2-2' }}</span
                      >
                      <span class="text-gray-300 text-xs">·</span>
                      <span class="text-xs font-semibold text-gray-500">{{
                        pedido.forma_pagamento
                      }}</span>
                      @if (pedido.pago) {
                        <span
                          class="text-xs font-semibold text-green-600 bg-green-100 px-2 py-0.5 rounded-full"
                          >Pago</span
                        >
                      }
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                      @if (!isPedidoTerminal(pedido.status)) {
                        <ui-button
                          variant="danger"
                          size="xs"
                          (click)="pedirConfirmacaoCancelar(pedido, $event)"
                          >Cancelar</ui-button
                        >
                      }
                      <ui-button
                        variant="secondary"
                        size="xs"
                        (click)="abrirDetalhesPedido(pedido)"
                        >Detalhes →</ui-button
                      >
                    </div>
                  </div>

                  <!-- Avançar pedido -->
                  @if (!isPedidoTerminal(pedido.status)) {
                    <div
                      class="px-5 py-3.5 border-t border-orange-100 space-y-2.5"
                      style="background: var(--color-brand-light)"
                    >
                      @if (pedido.status === 'pronto') {
                        <ui-checkbox
                          [ngModel]="getIsRetirada(pedido.uuid)"
                          (ngModelChange)="setIsRetirada(pedido.uuid, $event)"
                          label="Retirada na loja (sem entregador)"
                          size="sm"
                        />
                      }
                      <ui-button
                        [fullWidth]="true"
                        (click)="avancarPedido(pedido.uuid, getIsRetirada(pedido.uuid))"
                      >
                        Avançar ▶
                      </ui-button>
                    </div>
                  }
                </div>
              </div>
            </div>
          }
        </div>

        <!-- Paginação (histórico) -->
        @if (isHistorico() && historicoTotalPages() > 1) {
          <div class="flex items-center justify-between pt-2">
            <p class="text-xs text-gray-400">
              {{ historicoTotal() }} registros · página {{ historicoPage() }} de
              {{ historicoTotalPages() }}
            </p>
            <div class="flex gap-1.5">
              <ui-button
                variant="secondary"
                size="xs"
                [disabled]="historicoPage() <= 1"
                (click)="irParaPagina(historicoPage() - 1)"
              >
                ← Anterior
              </ui-button>
              <ui-button
                variant="secondary"
                size="xs"
                [disabled]="historicoPage() >= historicoTotalPages()"
                (click)="irParaPagina(historicoPage() + 1)"
              >
                Próxima →
              </ui-button>
            </div>
          </div>
        }
      }
    </div>

    <!-- Modal: Detalhes do Pedido -->
    @if (pedidoDetalhe()) {
      @let p = pedidoDetalhe()!;
      <div
        class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-4"
        (click)="fecharDetalhesPedido()"
      >
        <div
          class="w-full sm:max-w-lg bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col overflow-hidden"
          style="max-height: 90vh"
          (click)="$event.stopPropagation()"
        >
          <!-- Header modal -->
          <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
            <div>
              <p class="text-xs text-gray-400 font-mono">{{ p.uuid.slice(0, 8) }}…</p>
              <div class="flex items-center gap-2 mt-0.5">
                <p class="text-sm text-gray-500">{{ p.criado_em | date: 'dd/MM/yyyy HH:mm' }}</p>
                <span
                  class="px-2 py-0.5 rounded-full text-xs font-semibold"
                  [class]="statusCfg(p.status).bg + ' ' + statusCfg(p.status).color"
                >
                  {{ statusCfg(p.status).icon }} {{ statusCfg(p.status).label }}
                </span>
              </div>
            </div>
            <ui-button
              variant="ghost"
              size="xs"
              (click)="fecharDetalhesPedido()"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </ui-button>
          </div>

          <!-- Abas do modal -->
          <div class="px-5 pt-2 border-b border-gray-100 bg-gray-50/50">
            <ui-tab-bar
              [tabs]="pedidoDetalheTabs"
              [active]="pedidoDetalheAba()"
              (tabChange)="pedidoDetalheAba.set($any($event))"
              size="sm"
            />
          </div>

          <!-- Conteúdo scrollável -->
          <div class="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            @if (pedidoDetalheAba() === 'detalhes') {
              <!-- Itens detalhados -->
              <section>
                <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Itens do pedido
                </h3>
                <div class="space-y-2">
                  @for (item of p.itens; track item.uuid; let idx = $index) {
                    <div class="border border-gray-100 rounded-xl overflow-hidden">
                      <div class="flex items-center justify-between px-4 py-2.5 bg-gray-50">
                        <div class="flex items-center gap-2">
                          <span
                            class="w-5 h-5 rounded-full bg-white border border-gray-200 text-gray-600 text-xs font-bold flex items-center justify-center"
                          >
                            {{ idx + 1 }}
                          </span>
                          <span class="text-sm font-medium text-gray-800">
                            {{ item.quantidade }}×
                            @if (item.partes.length === 1) {
                              {{ item.partes[0].produto_nome }}
                            } @else {
                              Pizza ({{ item.partes.length }} sabores)
                            }
                          </span>
                        </div>
                        <span
                          class="text-sm font-bold"
                          style="color: var(--color-brand)"
                        >
                          R$ {{ itemPrecoPedido(item) * item.quantidade | number: '1.2-2' }}
                        </span>
                      </div>
                      <div class="px-4 py-2.5 space-y-2">
                        @for (parte of item.partes; track parte.uuid) {
                          <div>
                            <div class="flex items-center gap-2">
                              @if (item.partes.length > 1) {
                                <span
                                  class="w-4 h-4 rounded-full text-white text-xs font-bold flex items-center justify-center shrink-0"
                                  style="background: var(--color-brand); font-size: 9px"
                                  >{{ parte.posicao }}</span
                                >
                              }
                              <span class="text-sm text-gray-700 font-medium">{{
                                parte.produto_nome
                              }}</span>
                              <span class="text-xs text-gray-400 ml-auto"
                                >R$ {{ parte.preco_unitario | number: '1.2-2' }}</span
                              >
                            </div>
                            @if (parte.adicionais.length > 0) {
                              <div class="ml-6 mt-1 flex flex-wrap gap-1">
                                @for (ad of parte.adicionais; track ad.uuid) {
                                  <span
                                    class="flex items-center gap-1 px-2 py-0.5 bg-orange-50 border border-orange-100 rounded-full text-xs text-orange-700"
                                  >
                                    {{ ad.nome }}
                                    <span class="font-semibold"
                                      >+R\${{ ad.preco | number: '1.2-2' }}</span
                                    >
                                  </span>
                                }
                              </div>
                            }
                          </div>
                        }
                        @if (item.observacoes) {
                          <p class="text-xs text-gray-400 italic pt-1 border-t border-gray-50">
                            "{{ item.observacoes }}"
                          </p>
                        }
                      </div>
                    </div>
                  }
                </div>
              </section>

              <!-- Totais -->
              <section class="border-t border-gray-100 pt-3 space-y-1.5">
                <div class="flex justify-between text-sm text-gray-600">
                  <span>Subtotal</span>
                  <span>R$ {{ p.subtotal | number: '1.2-2' }}</span>
                </div>
                <div class="flex justify-between text-sm text-gray-600">
                  <span>Taxa de entrega</span>
                  @if (+p.taxa_entrega === 0) {
                    <span class="text-green-600 font-medium">Grátis</span>
                  } @else {
                    <span>R$ {{ p.taxa_entrega | number: '1.2-2' }}</span>
                  }
                </div>
                @if (+p.desconto > 0) {
                  <div class="flex justify-between text-sm text-green-600">
                    <span>Desconto</span>
                    <span>−R$ {{ p.desconto | number: '1.2-2' }}</span>
                  </div>
                }
                <div
                  class="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-100"
                >
                  <span>Total</span>
                  <span>R$ {{ p.total | number: '1.2-2' }}</span>
                </div>
              </section>

              <!-- Pagamento + obs -->
              <section class="text-sm text-gray-600 space-y-1">
                <p><span class="font-medium text-gray-700">Pagamento:</span> {{ p.forma_pagamento }}</p>
                @if (p.observacoes) {
                  <p class="italic text-gray-400">"{{ p.observacoes }}"</p>
                }
              </section>

              <!-- Contato -->
              @if (p.contato) {
                <section class="text-sm text-gray-600 space-y-1">
                  <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Contato
                  </p>
                  <a
                    [href]="'https://wa.me/55' + p.contato"
                    target="_blank"
                    rel="noopener"
                    class="flex items-center gap-1.5 text-green-600 hover:underline"
                  >
                    <svg
                      class="w-4 h-4 shrink-0"
                      viewBox="0 0 32 32"
                      fill="currentColor"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M16 2C8.268 2 2 8.268 2 16c0 2.49.651 4.824 1.788 6.845L2 30l7.343-1.764A13.94 13.94 0 0 0 16 30c7.732 0 14-6.268 14-14S23.732 2 16 2zm0 25.5a11.44 11.44 0 0 1-5.835-1.6l-.418-.248-4.358 1.048 1.077-4.24-.272-.435A11.46 11.46 0 0 1 4.5 16C4.5 9.596 9.596 4.5 16 4.5S27.5 9.596 27.5 16 22.404 27.5 16 27.5zm6.29-8.618c-.345-.173-2.04-1.006-2.356-1.12-.317-.115-.547-.173-.778.173-.23.345-.893 1.12-1.095 1.35-.2.23-.403.26-.748.086-.345-.173-1.457-.537-2.775-1.713-1.026-.916-1.718-2.047-1.92-2.392-.2-.345-.021-.531.152-.703.155-.155.345-.403.518-.605.172-.2.23-.345.345-.575.115-.23.058-.432-.029-.605-.086-.173-.778-1.876-1.066-2.57-.28-.673-.565-.582-.778-.593l-.662-.011c-.23 0-.605.086-.921.432-.317.345-1.21 1.182-1.21 2.882s1.239 3.342 1.411 3.572c.173.23 2.438 3.722 5.908 5.217.826.356 1.47.569 1.973.728.829.263 1.584.226 2.18.137.665-.1 2.04-.834 2.328-1.638.287-.805.287-1.494.2-1.638-.086-.144-.317-.23-.662-.403z"
                      />
                    </svg>
                    <span>{{ p.contato | phone }}</span>
                  </a>
                </section>
              }

              <!-- Endereço de entrega -->
              @if (p.endereco_entrega) {
                @let e = p.endereco_entrega;
                <section class="text-sm text-gray-600 space-y-1">
                  <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Endereço de entrega
                  </p>
                  <div class="bg-gray-50 rounded-xl p-3 space-y-0.5 text-sm">
                    <p class="font-medium text-gray-800">
                      {{ e.logradouro }}, {{ e.numero }}
                      @if (e.complemento) {
                        — {{ e.complemento }}
                      }
                    </p>
                    <p class="text-gray-500">{{ e.bairro }} — {{ e.cidade }}/{{ e.estado }}</p>
                    @if (e.cep) {
                      <p class="text-gray-400 text-xs">CEP {{ e.cep }}</p>
                    }
                  </div>
                </section>
              }
            } @else if (pedidoDetalheAba() === 'chat') {
              <app-chat-panel
                [lojaUuid]="p.loja_uuid"
                [usuarioUuid]="p.usuario_uuid"
                [pedidoUuid]="p.uuid"
              />
            }
          </div>

          <!-- Ações no modal: Avançar + Cancelar -->
          @if (!isPedidoTerminal(p.status)) {
            <div class="px-5 py-4 border-t border-gray-100 shrink-0 space-y-2">
              <div class="space-y-2">
                @if (p.status === 'pronto') {
                  <ui-checkbox
                    [ngModel]="getIsRetirada(p.uuid)"
                    (ngModelChange)="setIsRetirada(p.uuid, $event)"
                    label="Retirada na loja (sem entregador)"
                  />
                }
                <ui-button
                  [fullWidth]="true"
                  (click)="avancarPedido(p.uuid, getIsRetirada(p.uuid))"
                >
                  Avançar ▶
                </ui-button>
              </div>
              <ui-button
                variant="danger"
                [fullWidth]="true"
                (click)="pedirConfirmacaoCancelar(p)"
              >
                Cancelar pedido
              </ui-button>
            </div>
          }
        </div>
      </div>
    }

    <!-- Modal: Confirmar Cancelamento -->
    @if (pedidoCancelarConfirm()) {
      @let pc = pedidoCancelarConfirm()!;
      <div
        class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
        (click)="pedidoCancelarConfirm.set(null)"
      >
        <div
          class="w-full sm:max-w-sm bg-white rounded-2xl shadow-2xl p-6"
          (click)="$event.stopPropagation()"
        >
          <p class="text-2xl mb-3 text-center">⚠️</p>
          <p class="text-base font-bold text-gray-900 text-center mb-1">Cancelar pedido?</p>
          <p class="text-sm text-gray-500 text-center mb-6">
            O pedido <span class="font-mono font-semibold text-gray-700">#{{ pc.codigo }}</span>
            será cancelado e esta ação não pode ser revertida.
          </p>
          <div class="flex gap-3">
            <div class="flex-1">
              <ui-button
                variant="secondary"
                [fullWidth]="true"
                (click)="pedidoCancelarConfirm.set(null)"
              >
                Voltar
              </ui-button>
            </div>
            <div class="flex-1">
              <ui-button
                variant="danger"
                [fullWidth]="true"
                (click)="executarCancelarPedido()"
              >
                Confirmar cancelamento
              </ui-button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class AdminPedidosTabComponent {
  lojaUuid = input.required<string>();

  private pedidosLiveService = inject(PedidosLiveService);
  private pedidoService = inject(PedidoService);
  private authService = inject(AuthService);
  private destroyRef = inject(DestroyRef);

  readonly pedidoFiltroStatus = signal<StatusPedido>('criado');
  private wsSubscription: Subscription | null = null;
  private readonly _pedidosLive = signal<Pedido[]>([]);
  readonly pedidosLoading = signal(false);
  readonly pedidos = computed(() => this._pedidosLive());

  // Paginação (usado apenas nas abas de histórico)
  readonly historicoPage = signal(1);
  readonly historicoPerPage = 20;
  readonly historicoTotal = signal(0);
  readonly historicoTotalPages = signal(0);
  readonly isHistorico = computed(() =>
    this.pedidoFiltroStatus() === 'cancelado' || this.pedidoFiltroStatus() === 'entregue'
  );

  readonly pedidoDetalheAba = signal<'detalhes' | 'chat'>('detalhes');
  readonly pedidoDetalheTabs: UiTab[] = [
    { id: 'detalhes', label: '📋 Detalhes' },
    { id: 'chat',     label: '💬 Chat'     },
  ];

  readonly statusEntries = (Object.entries(STATUS_CFG) as [StatusPedido, typeof STATUS_CFG[StatusPedido]][])
    .map(([key, cfg]) => ({ key, cfg }));

  readonly expandedPedidos = signal<Set<string>>(new Set());
  readonly pedidoDetalhe = signal<Pedido | null>(null);
  readonly pedidoCancelarConfirm = signal<Pedido | null>(null);
  private readonly isRetiradaMap = signal<Map<string, boolean>>(new Map());
  readonly statusTerminal: StatusPedido[] = ['entregue', 'cancelado'];

  constructor() {
    effect(() => {
      const uuid = this.lojaUuid();
      const token = this.authService.token();
      if (uuid && token) {
        this.carregarPedidos();
      } else {
        this.desconectarWsPedidos();
      }
    });

    effect(() => {
      this.pedidoFiltroStatus();
      this.expandedPedidos.set(new Set());
      this.historicoPage.set(1);
      const uuid = this.lojaUuid();
      const token = this.authService.token();
      if (uuid && token) {
        this.carregarPedidos();
      }
    });

    this.destroyRef.onDestroy(() => this.desconectarWsPedidos());
  }

  private carregarPedidos(): void {
    if (this.isHistorico()) {
      this.desconectarWsPedidos();
      this.carregarHistorico();
    } else {
      this.conectarWsPedidos();
    }
  }

  private carregarHistorico(): void {
    const uuid = this.lojaUuid();
    if (!uuid) return;
    this.pedidosLoading.set(true);
    const page = this.historicoPage();
    const perPage = this.historicoPerPage;
    const status = this.pedidoFiltroStatus();

    const req$ = status === 'cancelado'
      ? this.pedidoService.listarHistoricoCancelados(uuid, page, perPage)
      : this.pedidoService.listarHistoricoEntregues(uuid, page, perPage);

    req$.subscribe({
      next: (res: PaginatedResponse<Pedido>) => {
        this.pedidosLoading.set(false);
        this._pedidosLive.set(res.data);
        this.historicoTotal.set(res.total);
        this.historicoTotalPages.set(res.total_pages);
      },
      error: () => this.pedidosLoading.set(false),
    });
  }

  private conectarWsPedidos(): void {
    this.wsSubscription?.unsubscribe();
    this.wsSubscription = null;
    const uuid = this.lojaUuid();
    const token = this.authService.token();
    if (!uuid || !token) return;
    this.pedidosLoading.set(true);
    this.wsSubscription = this.pedidosLiveService
      .conectar(uuid, this.pedidoFiltroStatus(), token)
      .subscribe({
        next: (lista) => {
          this.pedidosLoading.set(false);
          this._pedidosLive.set(lista);
        },
        error: () => this.pedidosLoading.set(false),
      });
  }

  private desconectarWsPedidos(): void {
    this.wsSubscription?.unsubscribe();
    this.wsSubscription = null;
    this._pedidosLive.set([]);
  }

  irParaPagina(page: number): void {
    this.historicoPage.set(page);
    this.carregarHistorico();
  }

  statusCfg(s: StatusPedido) {
    return STATUS_CFG[s];
  }

  isPedidoExpanded(uuid: string): boolean { return this.expandedPedidos().has(uuid); }

  toggleExpandPedido(uuid: string): void {
    const s = new Set(this.expandedPedidos());
    s.has(uuid) ? s.delete(uuid) : s.add(uuid);
    this.expandedPedidos.set(s);
  }

  pedidoResumoItens(pedido: Pedido): string {
    if (!pedido.itens?.length) return 'Sem itens';
    const p0 = pedido.itens[0];
    const nome = p0.partes.length === 1
      ? `${p0.quantidade}× ${p0.partes[0].produto_nome}`
      : `${p0.quantidade}× Pizza (${p0.partes.length} sabores)`;
    return pedido.itens.length > 1 ? `${nome} +${pedido.itens.length - 1}` : nome;
  }

  refreshPedidos() {
    this.carregarPedidos();
  }

  isPedidoTerminal(status: StatusPedido): boolean {
    return this.statusTerminal.includes(status);
  }

  avancarPedido(pedidoUuid: string, isRetirada = false) {
    this.pedidoService.avancar(pedidoUuid, isRetirada).subscribe({
      next: (res) => {
        toast.success('Pedido avançado com sucesso!');
        this.refreshPedidos();
        const detalhe = this.pedidoDetalhe();
        if (detalhe?.uuid === pedidoUuid) {
          this.pedidoDetalhe.set({ ...detalhe, status: res.status });
        }
      },
      error: (e) => toast.error(e?.error?.error ?? 'Erro ao avançar pedido.'),
    });
  }

  pedirConfirmacaoCancelar(pedido: Pedido, event?: Event): void {
    event?.stopPropagation();
    this.pedidoCancelarConfirm.set(pedido);
  }

  executarCancelarPedido(): void {
    const pedido = this.pedidoCancelarConfirm();
    if (!pedido) return;
    this.pedidoCancelarConfirm.set(null);
    this.pedidoService.cancelar(pedido.uuid).subscribe({
      next: () => {
        toast.success('Pedido cancelado.');
        this.refreshPedidos();
        const detalhe = this.pedidoDetalhe();
        if (detalhe?.uuid === pedido.uuid) {
          this.pedidoDetalhe.set({ ...detalhe, status: 'cancelado' });
        }
      },
      error: (e) => toast.error(e?.error?.error ?? 'Erro ao cancelar pedido.'),
    });
  }

  getIsRetirada(uuid: string): boolean {
    return this.isRetiradaMap().get(uuid) ?? false;
  }

  setIsRetirada(uuid: string, value: boolean): void {
    const m = new Map(this.isRetiradaMap());
    m.set(uuid, value);
    this.isRetiradaMap.set(m);
  }

  abrirDetalhesPedido(pedido: Pedido): void {
    this.pedidoDetalheAba.set('detalhes');
    this.pedidoDetalhe.set(pedido);
  }

  fecharDetalhesPedido(): void {
    this.pedidoDetalhe.set(null);
  }

  itemPrecoPedido(item: ItemPedido): number {
    if (item.partes.length === 0) return 0;
    const base = Math.max(...item.partes.map(p => Number(p.preco_unitario)));
    const extras = item.partes.reduce(
      (s, p) => s + p.adicionais.reduce((sa, a) => sa + Number(a.preco), 0), 0,
    );
    return base + extras;
  }
}
