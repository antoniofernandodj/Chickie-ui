import { 
  Component, 
  ElementRef, 
  OnInit, 
  OnDestroy, 
  ViewChild, 
  inject, 
  signal, 
  effect, 
  input 
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService } from '../../core/services/chat.service';
import { AuthService } from '../../core/services/auth.service';
import { MensagemChat, CreateMensagemRequest } from '../../core/models';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-chat-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [DatePipe],
  template: `
    <div
      class="flex flex-col h-[500px] border rounded-xl overflow-hidden bg-white shadow-sm border-gray-200"
    >
      <!-- Header -->
      <div class="p-4 border-b bg-gray-50 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <span class="font-semibold text-gray-700">Chat com a Loja</span>
        </div>
        @if (pedidoUuid()) {
          <span
            class="text-[10px] font-mono bg-gray-200 px-1.5 py-0.5 rounded text-gray-600 uppercase tracking-tighter"
          >
            Pedido: {{ pedidoUuid()?.slice(0, 8) }}
          </span>
        }
      </div>

      <!-- Messages Area -->
      <div
        #scrollContainer
        class="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50"
      >
        @for (msg of messages(); track msg.uuid) {
          <div
            class="flex flex-col"
            [class.items-end]="isMine(msg)"
            [class.items-start]="!isMine(msg)"
          >
            <div
              class="max-w-[80%] px-4 py-2 rounded-2xl text-sm shadow-sm"
              [ngClass]="
                isMine(msg)
                  ? 'bg-orange-500 text-white rounded-tr-none'
                  : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'
              "
            >
              {{ msg.texto }}
            </div>
            <span class="text-[10px] text-gray-400 mt-1 px-1">
              {{ msg.criado_em | date: 'HH:mm' }}
              @if (isMine(msg) && msg.lida) {
                <span class="text-blue-400 ml-1">✓✓</span>
              } @else if (isMine(msg)) {
                <span class="text-gray-300 ml-1">✓</span>
              }
            </span>
          </div>
        } @empty {
          <div class="h-full flex flex-col items-center justify-center text-gray-400 space-y-2">
            <span class="text-3xl">💬</span>
            <p class="text-sm">Nenhuma mensagem ainda.</p>
            <p class="text-xs text-center px-8">
              Inicie a conversa para tirar dúvidas sobre seu pedido.
            </p>
          </div>
        }
      </div>

      <!-- Input Area -->
      <div class="p-4 border-t bg-white">
        <form
          (submit)="enviarMensagem($event)"
          class="flex gap-2"
        >
          <input
            type="text"
            [(ngModel)]="novoTexto"
            name="texto"
            placeholder="Escreva sua mensagem..."
            class="flex-1 px-4 py-2 rounded-full border border-gray-200 outline-none focus:border-orange-400 text-sm"
            autocomplete="off"
          />
          <button
            type="submit"
            [disabled]="!novoTexto.trim()"
            class="w-10 h-10 flex items-center justify-center bg-orange-500 text-white rounded-full disabled:bg-gray-300 transition-colors shadow-sm"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="2"
              stroke="currentColor"
              class="w-5 h-5"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
              />
            </svg>
          </button>
        </form>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
  `]
})
export class ChatPanelComponent implements OnInit, OnDestroy {
  lojaUuid = input.required<string>();
  usuarioUuid = input.required<string>();
  pedidoUuid = input<string | null>(null);

  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  private chatService = inject(ChatService);
  private authService = inject(AuthService);
  
  messages = signal<MensagemChat[]>([]);
  novoTexto = '';
  private sub?: Subscription;

  constructor() {
    // Scroll to bottom when messages change
    effect(() => {
      this.messages();
      setTimeout(() => this.scrollToBottom(), 100);
    });
  }

  ngOnInit() {
    const token = this.authService.token();
    if (token) {
      this.chatService.connect(token);
    }

    this.carregarHistorico();

    this.sub = this.chatService.messages$.subscribe(msg => {
      // Filtrar se a mensagem pertence a este contexto (loja/usuario ou pedido)
      if (this.pedidoUuid() && msg.pedido_uuid === this.pedidoUuid()) {
        this.addMessage(msg);
      } else if (!this.pedidoUuid() && msg.loja_uuid === this.lojaUuid() && msg.usuario_uuid === this.usuarioUuid()) {
        this.addMessage(msg);
      }
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  carregarHistorico() {
    const obs = this.pedidoUuid() 
      ? this.chatService.getHistoricoPedido(this.pedidoUuid()!)
      : this.chatService.getHistoricoGeral(this.lojaUuid(), this.usuarioUuid());

    obs.subscribe(msgs => {
      this.messages.set(msgs);
    });
  }

  enviarMensagem(event: Event) {
    event.preventDefault();
    if (!this.novoTexto.trim()) return;

    const req: CreateMensagemRequest = {
      loja_uuid: this.lojaUuid(),
      usuario_uuid: this.usuarioUuid(),
      texto: this.novoTexto,
      pedido_uuid: this.pedidoUuid()
    };

    this.chatService.sendMessage(req);
    this.novoTexto = '';
  }

  isMine(msg: MensagemChat): boolean {
    return msg.remetente_uuid === this.authService.getUsuarioUuid();
  }

  private addMessage(msg: MensagemChat) {
    const current = this.messages();
    if (!current.some(m => m.uuid === msg.uuid)) {
      this.messages.set([...current, msg]);
    }
  }

  private scrollToBottom(): void {
    if (this.scrollContainer) {
      try {
        this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
      } catch (err) {}
    }
  }
}
