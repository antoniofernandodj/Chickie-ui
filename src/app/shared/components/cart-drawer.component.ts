import { Component, inject, computed } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { switchMap, catchError, of } from 'rxjs';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { CartService, CartItem } from '../../core/services/cart.service';
import { HorarioService } from '../../core/services/horario.service';

@Component({
  selector: 'app-cart-drawer',
  standalone: true,
  imports: [DecimalPipe],
  template: `
    @if (cart.drawerOpen() || cart.totalItens() > 0) {
      <!-- Overlay -->
      <div
        class="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
        [class.opacity-0]="!cart.drawerOpen()"
        [class.pointer-events-none]="!cart.drawerOpen()"
        (click)="cart.closeDrawer()"
      ></div>

      <!-- Sheet -->
      <div
        class="fixed top-0 right-0 z-50 h-full w-full max-w-sm bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-in-out"
        [class.translate-x-full]="!cart.drawerOpen()"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 class="font-bold text-gray-900 text-lg">Minha sacola</h2>
            @if (loja()) {
              <p class="text-xs text-gray-500 mt-0.5">{{ loja()!.nome }}</p>
            }
          </div>
          <button
            (click)="cart.closeDrawer()"
            class="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <!-- Items list -->
        <div class="flex-1 overflow-y-auto p-4 space-y-3">
          @if (cart.itens().length === 0) {
            <div class="flex flex-col items-center justify-center h-full py-16 text-center">
              <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <svg
                  class="w-8 h-8 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.5 6M7 13l-1.5 6m0 0h9m-9 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm9 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3z"
                  />
                </svg>
              </div>
              <p class="font-medium text-gray-700">Sua sacola está vazia</p>
              <p class="text-sm text-gray-400 mt-1">Adicione itens de uma loja para começar</p>
            </div>
          } @else {
            @for (item of cart.itens(); track item.id) {
              <div class="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                <div class="flex-1 min-w-0">
                  <p class="font-medium text-sm text-gray-900 leading-snug">{{ itemLabel(item) }}</p>
                  @if (adicionaisLabel(item)) {
                    <p class="text-xs text-gray-500 mt-0.5 truncate">+ {{ adicionaisLabel(item) }}</p>
                  }
                  <p
                    class="text-sm font-semibold mt-1"
                    style="color: var(--color-brand)"
                  >
                    Rtemplate: `
    @if (cart.drawerOpen() || cart.totalItens() > 0) {
      <!-- Overlay -->
      <div
        class="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
        [class.opacity-0]="!cart.drawerOpen()"
        [class.pointer-events-none]="!cart.drawerOpen()"
        (click)="cart.closeDrawer()"
      ></div>

      <!-- Sheet -->
      <div
        class="fixed top-0 right-0 z-50 h-full w-full max-w-sm bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-in-out"
        [class.translate-x-full]="!cart.drawerOpen()"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 class="font-bold text-gray-900 text-lg">Minha sacola</h2>
            @if (loja()) {
              <p class="text-xs text-gray-500 mt-0.5">{{ loja()!.nome }}</p>
            }
          </div>
          <button
            (click)="cart.closeDrawer()"
            class="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Items list -->
        <div class="flex-1 overflow-y-auto p-4 space-y-3">
          @if (cart.itens().length === 0) {
            <div class="flex flex-col items-center justify-center h-full py-16 text-center">
              <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.5 6M7 13l-1.5 6m0 0h9m-9 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm9 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3z"/>
                </svg>
              </div>
              <p class="font-medium text-gray-700">Sua sacola está vazia</p>
              <p class="text-sm text-gray-400 mt-1">Adicione itens de uma loja para começar</p>
            </div>
          } @else {
            @for (item of cart.itens(); track item.id) {
              <div class="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                <div class="flex-1 min-w-0">
                  <p class="font-medium text-sm text-gray-900 leading-snug">{{ itemLabel(item) }}</p>
                  @if (adicionaisLabel(item)) {
                    <p class="text-xs text-gray-500 mt-0.5 truncate">+ {{ adicionaisLabel(item) }}</p>
                  }
                  <p class="text-sm font-semibold mt-1" style="color:var(--color-brand)">
                    R$&nbsp;{{ itemPreco(item) | number:'1.2-2' }}
                  </p>
                </div>
                <div class="flex items-center gap-1 shrink-0 mt-0.5">
                  <button
                    (click)="cart.decrementar(item.id)"
                    class="w-7 h-7 flex items-center justify-center rounded-full border border-gray-200 hover:bg-gray-100 text-gray-600 font-bold text-base leading-none transition-colors"
                  >−</button>
                  <span class="w-5 text-center text-sm font-semibold text-gray-900">{{ item.quantidade }}</span>
                  <button
                    (click)="cart.incrementar(item.id)"
                    class="w-7 h-7 flex items-center justify-center rounded-full text-white font-bold text-base leading-none transition-opacity hover:opacity-90"
                    style="background:var(--color-brand)"
                  >+</button>
                </div>
              </div>
            }
          }
        </div>

        <!-- Footer -->
        @if (cart.itens().length > 0) {
          <div class="border-t border-gray-100 p-4 shrink-0 space-y-3">
            <div class="space-y-1 text-sm">
              <div class="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>R$&nbsp;{{ cart.subtotal() | number:'1.2-2' }}</span>
              </div>
              @if (loja()?.taxa_entrega) {
                <div class="flex justify-between text-gray-600">
                  <span>Taxa de entrega</span>
                  <span>R$&nbsp;{{ loja()!.taxa_entrega | number:'1.2-2' }}</span>
                </div>
              }
              <div class="flex justify-between font-bold text-gray-900 pt-2 border-t border-gray-100 text-base">
                <span>Total</span>
                <span>R$&nbsp;{{ total() | number:'1.2-2' }}</span>
              </div>
            </div>

            <button
              (click)="goToCheckout()"
              [disabled]="!lojaAberta()"
              class="w-full py-3 rounded-xl font-semibold text-white text-sm transition-all"
              [class.hover:opacity-90]="lojaAberta()"
              [class.active:scale-95]="lojaAberta()"
              [class.opacity-60]="!lojaAberta()"
              [class.cursor-not-allowed]="!lojaAberta()"
              style="background:var(--color-brand)"
            >
              @if (lojaAberta()) { Finalizar pedido } @else { Loja fechada }
            </button>

            @if (loja()) {
              <button
                (click)="goToLoja()"
                class="w-full py-2 rounded-xl font-medium text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Continuar comprando
              </button>
            }
          </div>
        }
      </div>
    }
  `nbsp;{{ itemPreco(item) | number: '1.2-2' }}
                  </p>
                </div>
                <div class="flex items-center gap-1 shrink-0 mt-0.5">
                  <button
                    (click)="cart.decrementar(item.id)"
                    class="w-7 h-7 flex items-center justify-center rounded-full border border-gray-200 hover:bg-gray-100 text-gray-600 font-bold text-base leading-none transition-colors"
                  >
                    −
                  </button>
                  <span class="w-5 text-center text-sm font-semibold text-gray-900">{{
                    item.quantidade
                  }}</span>
                  <button
                    (click)="cart.incrementar(item.id)"
                    class="w-7 h-7 flex items-center justify-center rounded-full text-white font-bold text-base leading-none transition-opacity hover:opacity-90"
                    style="background: var(--color-brand)"
                  >
                    +
                  </button>
                </div>
              </div>
            }
          }
        </div>

        <!-- Footer -->
        @if (cart.itens().length > 0) {
          <div class="border-t border-gray-100 p-4 shrink-0 space-y-3">
            <div class="space-y-1 text-sm">
              <div class="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>Rtemplate: `
    @if (cart.drawerOpen() || cart.totalItens() > 0) {
      <!-- Overlay -->
      <div
        class="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
        [class.opacity-0]="!cart.drawerOpen()"
        [class.pointer-events-none]="!cart.drawerOpen()"
        (click)="cart.closeDrawer()"
      ></div>

      <!-- Sheet -->
      <div
        class="fixed top-0 right-0 z-50 h-full w-full max-w-sm bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-in-out"
        [class.translate-x-full]="!cart.drawerOpen()"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 class="font-bold text-gray-900 text-lg">Minha sacola</h2>
            @if (loja()) {
              <p class="text-xs text-gray-500 mt-0.5">{{ loja()!.nome }}</p>
            }
          </div>
          <button
            (click)="cart.closeDrawer()"
            class="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Items list -->
        <div class="flex-1 overflow-y-auto p-4 space-y-3">
          @if (cart.itens().length === 0) {
            <div class="flex flex-col items-center justify-center h-full py-16 text-center">
              <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.5 6M7 13l-1.5 6m0 0h9m-9 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm9 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3z"/>
                </svg>
              </div>
              <p class="font-medium text-gray-700">Sua sacola está vazia</p>
              <p class="text-sm text-gray-400 mt-1">Adicione itens de uma loja para começar</p>
            </div>
          } @else {
            @for (item of cart.itens(); track item.id) {
              <div class="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                <div class="flex-1 min-w-0">
                  <p class="font-medium text-sm text-gray-900 leading-snug">{{ itemLabel(item) }}</p>
                  @if (adicionaisLabel(item)) {
                    <p class="text-xs text-gray-500 mt-0.5 truncate">+ {{ adicionaisLabel(item) }}</p>
                  }
                  <p class="text-sm font-semibold mt-1" style="color:var(--color-brand)">
                    R$&nbsp;{{ itemPreco(item) | number:'1.2-2' }}
                  </p>
                </div>
                <div class="flex items-center gap-1 shrink-0 mt-0.5">
                  <button
                    (click)="cart.decrementar(item.id)"
                    class="w-7 h-7 flex items-center justify-center rounded-full border border-gray-200 hover:bg-gray-100 text-gray-600 font-bold text-base leading-none transition-colors"
                  >−</button>
                  <span class="w-5 text-center text-sm font-semibold text-gray-900">{{ item.quantidade }}</span>
                  <button
                    (click)="cart.incrementar(item.id)"
                    class="w-7 h-7 flex items-center justify-center rounded-full text-white font-bold text-base leading-none transition-opacity hover:opacity-90"
                    style="background:var(--color-brand)"
                  >+</button>
                </div>
              </div>
            }
          }
        </div>

        <!-- Footer -->
        @if (cart.itens().length > 0) {
          <div class="border-t border-gray-100 p-4 shrink-0 space-y-3">
            <div class="space-y-1 text-sm">
              <div class="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>R$&nbsp;{{ cart.subtotal() | number:'1.2-2' }}</span>
              </div>
              @if (loja()?.taxa_entrega) {
                <div class="flex justify-between text-gray-600">
                  <span>Taxa de entrega</span>
                  <span>R$&nbsp;{{ loja()!.taxa_entrega | number:'1.2-2' }}</span>
                </div>
              }
              <div class="flex justify-between font-bold text-gray-900 pt-2 border-t border-gray-100 text-base">
                <span>Total</span>
                <span>R$&nbsp;{{ total() | number:'1.2-2' }}</span>
              </div>
            </div>

            <button
              (click)="goToCheckout()"
              [disabled]="!lojaAberta()"
              class="w-full py-3 rounded-xl font-semibold text-white text-sm transition-all"
              [class.hover:opacity-90]="lojaAberta()"
              [class.active:scale-95]="lojaAberta()"
              [class.opacity-60]="!lojaAberta()"
              [class.cursor-not-allowed]="!lojaAberta()"
              style="background:var(--color-brand)"
            >
              @if (lojaAberta()) { Finalizar pedido } @else { Loja fechada }
            </button>

            @if (loja()) {
              <button
                (click)="goToLoja()"
                class="w-full py-2 rounded-xl font-medium text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Continuar comprando
              </button>
            }
          </div>
        }
      </div>
    }
  `nbsp;{{ cart.subtotal() | number: '1.2-2' }}</span>
              </div>
              @if (loja()?.taxa_entrega) {
                <div class="flex justify-between text-gray-600">
                  <span>Taxa de entrega</span>
                  <span>Rtemplate: `
    @if (cart.drawerOpen() || cart.totalItens() > 0) {
      <!-- Overlay -->
      <div
        class="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
        [class.opacity-0]="!cart.drawerOpen()"
        [class.pointer-events-none]="!cart.drawerOpen()"
        (click)="cart.closeDrawer()"
      ></div>

      <!-- Sheet -->
      <div
        class="fixed top-0 right-0 z-50 h-full w-full max-w-sm bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-in-out"
        [class.translate-x-full]="!cart.drawerOpen()"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 class="font-bold text-gray-900 text-lg">Minha sacola</h2>
            @if (loja()) {
              <p class="text-xs text-gray-500 mt-0.5">{{ loja()!.nome }}</p>
            }
          </div>
          <button
            (click)="cart.closeDrawer()"
            class="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Items list -->
        <div class="flex-1 overflow-y-auto p-4 space-y-3">
          @if (cart.itens().length === 0) {
            <div class="flex flex-col items-center justify-center h-full py-16 text-center">
              <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.5 6M7 13l-1.5 6m0 0h9m-9 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm9 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3z"/>
                </svg>
              </div>
              <p class="font-medium text-gray-700">Sua sacola está vazia</p>
              <p class="text-sm text-gray-400 mt-1">Adicione itens de uma loja para começar</p>
            </div>
          } @else {
            @for (item of cart.itens(); track item.id) {
              <div class="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                <div class="flex-1 min-w-0">
                  <p class="font-medium text-sm text-gray-900 leading-snug">{{ itemLabel(item) }}</p>
                  @if (adicionaisLabel(item)) {
                    <p class="text-xs text-gray-500 mt-0.5 truncate">+ {{ adicionaisLabel(item) }}</p>
                  }
                  <p class="text-sm font-semibold mt-1" style="color:var(--color-brand)">
                    R$&nbsp;{{ itemPreco(item) | number:'1.2-2' }}
                  </p>
                </div>
                <div class="flex items-center gap-1 shrink-0 mt-0.5">
                  <button
                    (click)="cart.decrementar(item.id)"
                    class="w-7 h-7 flex items-center justify-center rounded-full border border-gray-200 hover:bg-gray-100 text-gray-600 font-bold text-base leading-none transition-colors"
                  >−</button>
                  <span class="w-5 text-center text-sm font-semibold text-gray-900">{{ item.quantidade }}</span>
                  <button
                    (click)="cart.incrementar(item.id)"
                    class="w-7 h-7 flex items-center justify-center rounded-full text-white font-bold text-base leading-none transition-opacity hover:opacity-90"
                    style="background:var(--color-brand)"
                  >+</button>
                </div>
              </div>
            }
          }
        </div>

        <!-- Footer -->
        @if (cart.itens().length > 0) {
          <div class="border-t border-gray-100 p-4 shrink-0 space-y-3">
            <div class="space-y-1 text-sm">
              <div class="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>R$&nbsp;{{ cart.subtotal() | number:'1.2-2' }}</span>
              </div>
              @if (loja()?.taxa_entrega) {
                <div class="flex justify-between text-gray-600">
                  <span>Taxa de entrega</span>
                  <span>R$&nbsp;{{ loja()!.taxa_entrega | number:'1.2-2' }}</span>
                </div>
              }
              <div class="flex justify-between font-bold text-gray-900 pt-2 border-t border-gray-100 text-base">
                <span>Total</span>
                <span>R$&nbsp;{{ total() | number:'1.2-2' }}</span>
              </div>
            </div>

            <button
              (click)="goToCheckout()"
              [disabled]="!lojaAberta()"
              class="w-full py-3 rounded-xl font-semibold text-white text-sm transition-all"
              [class.hover:opacity-90]="lojaAberta()"
              [class.active:scale-95]="lojaAberta()"
              [class.opacity-60]="!lojaAberta()"
              [class.cursor-not-allowed]="!lojaAberta()"
              style="background:var(--color-brand)"
            >
              @if (lojaAberta()) { Finalizar pedido } @else { Loja fechada }
            </button>

            @if (loja()) {
              <button
                (click)="goToLoja()"
                class="w-full py-2 rounded-xl font-medium text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Continuar comprando
              </button>
            }
          </div>
        }
      </div>
    }
  `nbsp;{{ loja()!.taxa_entrega | number: '1.2-2' }}</span>
                </div>
              }
              <div
                class="flex justify-between font-bold text-gray-900 pt-2 border-t border-gray-100 text-base"
              >
                <span>Total</span>
                <span>Rtemplate: `
    @if (cart.drawerOpen() || cart.totalItens() > 0) {
      <!-- Overlay -->
      <div
        class="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
        [class.opacity-0]="!cart.drawerOpen()"
        [class.pointer-events-none]="!cart.drawerOpen()"
        (click)="cart.closeDrawer()"
      ></div>

      <!-- Sheet -->
      <div
        class="fixed top-0 right-0 z-50 h-full w-full max-w-sm bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-in-out"
        [class.translate-x-full]="!cart.drawerOpen()"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 class="font-bold text-gray-900 text-lg">Minha sacola</h2>
            @if (loja()) {
              <p class="text-xs text-gray-500 mt-0.5">{{ loja()!.nome }}</p>
            }
          </div>
          <button
            (click)="cart.closeDrawer()"
            class="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Items list -->
        <div class="flex-1 overflow-y-auto p-4 space-y-3">
          @if (cart.itens().length === 0) {
            <div class="flex flex-col items-center justify-center h-full py-16 text-center">
              <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.5 6M7 13l-1.5 6m0 0h9m-9 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm9 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3z"/>
                </svg>
              </div>
              <p class="font-medium text-gray-700">Sua sacola está vazia</p>
              <p class="text-sm text-gray-400 mt-1">Adicione itens de uma loja para começar</p>
            </div>
          } @else {
            @for (item of cart.itens(); track item.id) {
              <div class="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                <div class="flex-1 min-w-0">
                  <p class="font-medium text-sm text-gray-900 leading-snug">{{ itemLabel(item) }}</p>
                  @if (adicionaisLabel(item)) {
                    <p class="text-xs text-gray-500 mt-0.5 truncate">+ {{ adicionaisLabel(item) }}</p>
                  }
                  <p class="text-sm font-semibold mt-1" style="color:var(--color-brand)">
                    R$&nbsp;{{ itemPreco(item) | number:'1.2-2' }}
                  </p>
                </div>
                <div class="flex items-center gap-1 shrink-0 mt-0.5">
                  <button
                    (click)="cart.decrementar(item.id)"
                    class="w-7 h-7 flex items-center justify-center rounded-full border border-gray-200 hover:bg-gray-100 text-gray-600 font-bold text-base leading-none transition-colors"
                  >−</button>
                  <span class="w-5 text-center text-sm font-semibold text-gray-900">{{ item.quantidade }}</span>
                  <button
                    (click)="cart.incrementar(item.id)"
                    class="w-7 h-7 flex items-center justify-center rounded-full text-white font-bold text-base leading-none transition-opacity hover:opacity-90"
                    style="background:var(--color-brand)"
                  >+</button>
                </div>
              </div>
            }
          }
        </div>

        <!-- Footer -->
        @if (cart.itens().length > 0) {
          <div class="border-t border-gray-100 p-4 shrink-0 space-y-3">
            <div class="space-y-1 text-sm">
              <div class="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>R$&nbsp;{{ cart.subtotal() | number:'1.2-2' }}</span>
              </div>
              @if (loja()?.taxa_entrega) {
                <div class="flex justify-between text-gray-600">
                  <span>Taxa de entrega</span>
                  <span>R$&nbsp;{{ loja()!.taxa_entrega | number:'1.2-2' }}</span>
                </div>
              }
              <div class="flex justify-between font-bold text-gray-900 pt-2 border-t border-gray-100 text-base">
                <span>Total</span>
                <span>R$&nbsp;{{ total() | number:'1.2-2' }}</span>
              </div>
            </div>

            <button
              (click)="goToCheckout()"
              [disabled]="!lojaAberta()"
              class="w-full py-3 rounded-xl font-semibold text-white text-sm transition-all"
              [class.hover:opacity-90]="lojaAberta()"
              [class.active:scale-95]="lojaAberta()"
              [class.opacity-60]="!lojaAberta()"
              [class.cursor-not-allowed]="!lojaAberta()"
              style="background:var(--color-brand)"
            >
              @if (lojaAberta()) { Finalizar pedido } @else { Loja fechada }
            </button>

            @if (loja()) {
              <button
                (click)="goToLoja()"
                class="w-full py-2 rounded-xl font-medium text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Continuar comprando
              </button>
            }
          </div>
        }
      </div>
    }
  `nbsp;{{ total() | number: '1.2-2' }}</span>
              </div>
            </div>

            <button
              (click)="goToCheckout()"
              [disabled]="!lojaAberta()"
              class="w-full py-3 rounded-xl font-semibold text-white text-sm transition-all"
              [class.hover:opacity-90]="lojaAberta()"
              [class.active:scale-95]="lojaAberta()"
              [class.opacity-60]="!lojaAberta()"
              [class.cursor-not-allowed]="!lojaAberta()"
              style="background: var(--color-brand)"
            >
              @if (lojaAberta()) {
                Finalizar pedido
              } @else {
                Loja fechada
              }
            </button>

            @if (loja()) {
              <button
                (click)="goToLoja()"
                class="w-full py-2 rounded-xl font-medium text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Continuar comprando
              </button>
            }
          </div>
        }
      </div>
    }
  `,
})
export class CartDrawerComponent {
  readonly cart            = inject(CartService);
  private  router          = inject(Router);
  private  horarioService  = inject(HorarioService);

  readonly loja  = computed(() => this.cart.lojaAtual());
  readonly total = computed(() => {
    const taxa = Number(this.loja()?.taxa_entrega ?? 0);
    return this.cart.subtotal() + taxa;
  });

  private readonly _lojaStatus = toSignal(
    toObservable(computed(() => this.cart.lojaAtual()?.uuid)).pipe(
      switchMap(uuid =>
        uuid
          ? this.horarioService.verificarStatus(uuid).pipe(catchError(() => of(null)))
          : of(null)
      )
    )
  );

  readonly lojaAberta = computed(() => this._lojaStatus()?.aberta ?? true);

  goToCheckout(): void {
    this.cart.closeDrawer();
    this.router.navigate(['/checkout']);
  }

  goToLoja(): void {
    this.cart.closeDrawer();
    const loja = this.loja();
    if (loja) this.router.navigate(['/loja', loja.slug]);
  }

  itemLabel(item: CartItem): string {
    if (item.partes.length === 1) return item.partes[0].produto.nome;
    return item.partes.map(p => `${p.posicao}/${item.partes.length} ${p.produto.nome}`).join(' + ');
  }

  itemPreco(item: CartItem): number {
    if (!item.partes.length) return 0;
    const base   = Math.max(...item.partes.map(p => Number(p.produto.preco)));
    const extras = item.partes.reduce(
      (s, p) => s + p.adicionais.reduce((sa, a) => sa + Number(a.preco), 0), 0,
    );
    return (base + extras) * item.quantidade;
  }

  adicionaisLabel(item: CartItem): string {
    return item.partes.flatMap(p => p.adicionais).map(a => a.nome).join(', ');
  }
}
