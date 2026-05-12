import { Component, inject, signal, computed, ElementRef, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { BehaviorSubject, catchError, of, switchMap, debounceTime, distinctUntilChanged, filter } from 'rxjs';
import { toast } from 'ngx-sonner';
import { AdminService } from '../../core/services/admin.service';
import { LojaService } from '../../core/services/loja.service';
import { Loja } from '../../core/models';
import { PhoneMaskDirective } from '../../shared/directives/phone-mask.directive';
import { SlugMaskDirective } from '../../shared/directives/slug-mask.directive';

const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024;
const COMPRESS_AFTER_SIZE = 1 * 1024 * 1024; // 1MB
const COMPRESSED_IMAGE_MIME = 'image/webp';
const COMPRESSED_IMAGE_QUALITY = 0.82;

@Component({
  selector: 'app-admin-lojas-list',
  standalone: true,
  imports: [ReactiveFormsModule, DecimalPipe, PhoneMaskDirective, SlugMaskDirective],
  templateUrl: './admin-lojas-list.component.html',
})
export class AdminLojasListComponent {
  private adminService = inject(AdminService);
  private lojaService = inject(LojaService);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  readonly mostrandoFormulario = signal(false);

  @ViewChild('imagemInput') imagemInput!: ElementRef<HTMLInputElement>;
  lojaImagem = signal<File | null>(null);
  lojaImagemPreview = signal<string | null>(null);

  // ── Lojas ──────────────────────────────────────────────────────────────────

  private readonly refreshTrigger = new BehaviorSubject<void>(undefined);

  readonly _minhasLojas = toSignal(
    this.refreshTrigger.pipe(
      switchMap(() => this.adminService.listarMinhasLojas()),
      catchError(() => of([])),
    ),
  );
  readonly lojasLoading = computed(() => this._minhasLojas() === undefined);
  readonly minhasLojas = computed(() => this._minhasLojas() ?? []);

  private refreshLojas() {
    this.refreshTrigger.next();
  }

  // ── Formulário ─────────────────────────────────────────────────────────────

  lojaForm = this.fb.group({
    nome: ['', [Validators.required, Validators.minLength(3)]],
    slug: ['', [Validators.required, Validators.pattern(/^[a-z0-9-]+$/)]],
    email_contato: ['', [Validators.required, Validators.email]],
    celular: ['', [Validators.required, Validators.pattern(/^\d{11}$/)]],
    descricao: [''],
    taxa_entrega_base: [5, [Validators.min(0)]],
    pedido_minimo: [20, [Validators.min(0)]],
    tempo_medio: [30, [Validators.min(1)]],
    max_partes: [4, [Validators.min(1), Validators.max(8)]],
  });

  slugChecking = signal(false);
  slugAvailable = signal<boolean | null>(null);
  slugMessage = signal('');
  lojaLoading = signal(false);
  lojaError = signal('');

  constructor() {
    const slugControl = this.lojaForm.get('slug');
    if (slugControl) {
      slugControl.valueChanges.pipe(
        debounceTime(400),
        distinctUntilChanged(),
        filter((slug): slug is string => slug != null && slug.length > 0),
        switchMap(slug => {
          this.slugChecking.set(true);
          this.slugAvailable.set(null);
          this.slugMessage.set('');
          return this.lojaService.verificarSlug(slug).pipe(
            catchError(() => {
              this.slugChecking.set(false);
              this.slugAvailable.set(null);
              this.slugMessage.set('Erro ao verificar slug.');
              return of(null);
            })
          );
        }),
        filter((result): result is { disponivel: boolean; slug: string } => result !== null)
      ).subscribe(result => {
        this.slugChecking.set(false);
        this.slugAvailable.set(result.disponivel);
        this.slugMessage.set(result.disponivel ? 'Slug disponível!' : 'Slug já está em uso.');
      });
    }
  }

  get fl() {
    return this.lojaForm.controls;
  }

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

  criarLoja() {
    if (this.lojaForm.invalid) {
      this.lojaForm.markAllAsTouched();
      this.lojaError.set('Preencha todos os campos obrigatórios corretamente.');
      return;
    }
    const slugOk = this.slugAvailable() === true;
    if (!slugOk) {
      this.lojaError.set('O slug deve ser verificado e disponível antes de criar a loja.');
      return;
    }
    this.lojaLoading.set(true);
    this.lojaError.set('');
    const fv = this.lojaForm.value;
    this.adminService.criarLoja({
      nome: fv.nome!,
      slug: fv.slug!,
      email_contato: fv.email_contato!,
      celular: fv.celular!,
      descricao: fv.descricao || null,
      taxa_entrega_base: fv.taxa_entrega_base ?? 5,
      pedido_minimo: fv.pedido_minimo ?? 20,
      tempo_medio: fv.tempo_medio ?? 30,
      nota_media: 0,
      max_partes: fv.max_partes ?? 4,
    }).subscribe({
      next: (l) => {
        const imagem = this.lojaImagem();
        if (imagem) {
          this.lojaService.uploadBannerLoja(l.uuid, imagem).subscribe({
            next: () => {
              this.finalizarCriacaoLoja(l);
            },
            error: (err) => {
              toast.error('Loja criada, mas falhou ao subir imagem.');
              this.finalizarCriacaoLoja(l);
            }
          });
        } else {
          this.finalizarCriacaoLoja(l);
        }
      },
      error: (e) => {
        this.lojaLoading.set(false);
        this.lojaError.set(e?.error?.error ?? 'Erro ao criar loja.');
      },
    });
  }

  private finalizarCriacaoLoja(l: Loja) {
    this.lojaLoading.set(false);
    toast.success(`Loja "${l.nome}" criada com sucesso!`);
    this.lojaForm.reset({
      taxa_entrega_base: 5,
      pedido_minimo: 20,
      tempo_medio: 30,
      max_partes: 4,
    });
    this.limparInputImagem();
    this.slugChecking.set(false);
    this.slugAvailable.set(null);
    this.slugMessage.set('');
    this.mostrandoFormulario.set(false);
    this.refreshLojas();
  }

  abrirFormulario() {
    this.mostrandoFormulario.set(true);
  }

  fecharFormulario() {
    this.mostrandoFormulario.set(false);
    this.lojaForm.reset({
      taxa_entrega_base: 5,
      pedido_minimo: 20,
      tempo_medio: 30,
      max_partes: 4,
    });
    this.limparInputImagem();
    this.slugChecking.set(false);
    this.slugAvailable.set(null);
    this.slugMessage.set('');
    this.lojaError.set('');
  }

  navegarParaPainel(loja: Loja) {
    this.router.navigate(['/admin', loja.uuid]);
  }
}
