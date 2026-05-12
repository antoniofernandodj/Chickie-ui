import { Component, inject, input, output, signal, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { toast } from 'ngx-sonner';
import { LojaService } from '../../../core/services/loja.service';
import { Loja } from '../../../core/models';
import { UiButtonComponent } from '../../../shared/components';

const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024;
const COMPRESS_AFTER_SIZE = 1 * 1024 * 1024; // 1MB
const COMPRESSED_IMAGE_MIME = 'image/webp';
const COMPRESSED_IMAGE_QUALITY = 0.82;

@Component({
  selector: 'admin-loja-tab',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    UiButtonComponent
  ],
  template: `
    <div class="max-w-2xl bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h3 class="text-base font-semibold text-gray-900 mb-5">🏪 Perfil da Loja</h3>

      <div class="space-y-6">
        <!-- Banner/Imagem da Loja -->
        <div class="space-y-2">
          <label class="block text-xs font-medium text-gray-700">Banner da Loja</label>
          <div class="flex flex-col gap-3">
            @if (loja().banner_url || lojaImagemPreview()) {
              <div class="relative w-full h-48 rounded-xl overflow-hidden border border-gray-100 shadow-sm bg-gray-50">
                <img
                  [src]="lojaImagemPreview() || loja().banner_url"
                  class="w-full h-full object-cover"
                  alt="Banner da Loja"
                />
                <div class="absolute top-2 right-2 flex gap-2">
                  <ui-button variant="danger" size="xs" (click)="removerImagem()" title="Remover imagem">✕</ui-button>
                </div>
              </div>
            } @else {
              <div class="w-full h-48 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center bg-gray-50 text-gray-400">
                <span class="text-4xl mb-2">🖼️</span>
                <p class="text-xs">Nenhuma imagem cadastrada</p>
              </div>
            }

            <input
              #imagemInput
              type="file"
              accept="image/*"
              (change)="onImagemSelected($event)"
              class="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-orange-100 file:text-orange-700 file:text-xs file:font-medium file:cursor-pointer"
            />
          </div>
          <p class="text-[10px] text-gray-400">Recomendado: 1200x400px ou proporção 3:1. Máximo 20MB.</p>
        </div>

        @if (lojaImagem()) {
          <ui-button 
            [loading]="loading()" 
            [disabled]="loading()"
            (click)="subirImagem()"
            size="sm" 
            [fullWidth]="true">
            📤 Salvar Nova Imagem
          </ui-button>
        }
      </div>
    </div>
  `,
})
export class AdminLojaTabComponent {
  loja = input.required<Loja>();
  updated = output<void>();

  private lojaService = inject(LojaService);
  private fb = inject(FormBuilder);

  @ViewChild('imagemInput') imagemInput!: ElementRef<HTMLInputElement>;
  lojaImagem = signal<File | null>(null);
  lojaImagemPreview = signal<string | null>(null);
  loading = signal(false);

  private limparInputImagem() {
    this.lojaImagem.set(null);
    this.lojaImagemPreview.set(null);
    if (this.imagemInput?.nativeElement) {
      this.imagemInput.nativeElement.value = '';
    }
  }

  async onImagemSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const prepared = await this.prepareImagemParaUpload(file);
      this.lojaImagem.set(prepared);
      this.lojaImagemPreview.set(await this.fileToDataUrl(prepared));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao processar a imagem.';
      toast.error(message);
      this.limparInputImagem();
    }
  }

  private async prepareImagemParaUpload(file: File): Promise<File> {
    if (file.size > COMPRESS_AFTER_SIZE) {
      file = await this.comprimirImagem(file);
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      throw new Error('A imagem deve ter no máximo 20MB.');
    }
    return file;
  }

  private async comprimirImagem(file: File): Promise<File> {
    const bitmap = await createImageBitmap(file);
    const maxDimension = 1920;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width * scale;
    canvas.height = bitmap.height * scale;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    
    const blob = await new Promise<Blob>((resolve) => 
      canvas.toBlob((b) => resolve(b!), COMPRESSED_IMAGE_MIME, COMPRESSED_IMAGE_QUALITY)
    );
    
    return new File([blob], file.name.replace(/\.[^/.]+$/, "") + '.webp', {
      type: COMPRESSED_IMAGE_MIME
    });
  }

  private fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.readAsDataURL(file);
    });
  }

  subirImagem() {
    const file = this.lojaImagem();
    if (!file) return;

    this.loading.set(true);
    this.lojaService.uploadBannerLoja(this.loja().uuid, file).subscribe({
      next: () => {
        this.loading.set(false);
        toast.success('Imagem da loja atualizada com sucesso!');
        this.limparInputImagem();
        this.updated.emit();
      },
      error: (e) => {
        this.loading.set(false);
        toast.error(e?.error?.error ?? 'Erro ao subir imagem.');
      }
    });
  }

  removerImagem() {
    if (!confirm('Deseja realmente remover a imagem da loja?')) return;
    
    if (this.lojaImagem()) {
      this.limparInputImagem();
      return;
    }

    this.loading.set(true);
    this.lojaService.removerBannerLoja(this.loja().uuid).subscribe({
      next: () => {
        this.loading.set(false);
        toast.success('Imagem removida com sucesso!');
        this.updated.emit();
      },
      error: (e) => {
        this.loading.set(false);
        toast.error(e?.error?.error ?? 'Erro ao remover imagem.');
      }
    });
  }
}
