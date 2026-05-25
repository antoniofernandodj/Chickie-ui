import { Component, inject, input, signal } from '@angular/core';
import { toast } from 'ngx-sonner';
import { BackupService } from '../../../core/services/backup.service';
import { UiButtonComponent } from '../../../shared/components';

@Component({
  selector: 'admin-backup-tab',
  standalone: true,
  imports: [UiButtonComponent],
  template: `
    <div class="space-y-6 max-w-xl">

      <!-- Exportar -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div class="flex items-start gap-4">
          <span class="text-3xl">⬇️</span>
          <div class="flex-1">
            <h3 class="text-base font-semibold text-gray-900">Exportar configurações</h3>
            <p class="text-sm text-gray-500 mt-1">
              Baixa um arquivo <code class="bg-gray-100 px-1 rounded text-xs">.json</code> com
              catálogo, adicionais, ingredientes, montagens, cupons, promoções,
              config de pedido, endereços, horários, mesas e reservas.
            </p>
            <p class="text-xs text-gray-400 mt-2">
              Não inclui: pedidos, avaliações, equipe e imagens de produtos.
            </p>
            <ui-button
              class="mt-4 block"
              [loading]="exportando()"
              (click)="exportar()"
            >
              Baixar backup
            </ui-button>
          </div>
        </div>
      </div>

      <!-- Importar -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div class="flex items-start gap-4">
          <span class="text-3xl">⬆️</span>
          <div class="flex-1">
            <h3 class="text-base font-semibold text-gray-900">Restaurar configurações</h3>
            <p class="text-sm text-gray-500 mt-1">
              Selecione um arquivo de backup gerado anteriormente.
              <strong class="text-gray-700">Todos os dados atuais serão substituídos</strong>
              pelo conteúdo do arquivo — a operação é irreversível.
            </p>

            @if (!arquivoSelecionado()) {
              <label
                class="mt-4 flex items-center justify-center gap-2 w-full cursor-pointer rounded-xl border-2 border-dashed border-gray-300 py-6 text-sm text-gray-500 hover:border-orange-400 hover:text-orange-600 transition-colors"
              >
                <input
                  type="file"
                  accept=".json,application/json"
                  class="sr-only"
                  (change)="onArquivoSelecionado($event)"
                />
                <span class="text-xl">📂</span>
                Clique para selecionar o arquivo .json
              </label>
            } @else {
              <div class="mt-4 flex items-center gap-3 p-3 bg-orange-50 border border-orange-200 rounded-xl">
                <span class="text-lg">📄</span>
                <span class="flex-1 text-sm text-gray-700 truncate">{{ arquivoSelecionado()!.name }}</span>
                <button
                  type="button"
                  class="text-gray-400 hover:text-gray-600 text-lg leading-none"
                  (click)="limparArquivo()"
                >×</button>
              </div>

              <div class="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                ⚠️ Esta ação <strong>substituirá permanentemente</strong> todas as configurações
                atuais da loja. Esta operação não pode ser desfeita.
              </div>

              <ui-button
                variant="danger"
                class="mt-4 block"
                [loading]="restaurando()"
                (click)="restaurar()"
              >
                Restaurar backup
              </ui-button>
            }
          </div>
        </div>
      </div>

    </div>
  `,
})
export class AdminBackupTabComponent {
  lojaUuid = input.required<string>();

  private backupSvc = inject(BackupService);

  readonly exportando     = signal(false);
  readonly restaurando    = signal(false);
  readonly arquivoSelecionado = signal<File | null>(null);

  // ── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Remove as definições de categorias globais (loja_uuid === null) do snapshot.
   * Os PRODUTOS dessas categorias são preservados — eles referenciam o UUID da
   * categoria global que já existe no banco, portanto a restauração apenas
   * os reanexa à categoria existente.
   *
   * Sem esse filtro, o backend recriaria as categorias globais com o UUID da
   * loja corrente, transformando-as em categorias locais (e permitindo deletá-las).
   */
  private filtrarCategoriasGlobais(snapshot: object): object {
    const s = snapshot as Record<string, unknown>;
    if (!Array.isArray(s['categorias'])) return snapshot;
    return {
      ...s,
      categorias: (s['categorias'] as any[]).filter((c: any) => c.loja_uuid !== null),
    };
  }

  // ── Export ────────────────────────────────────────────────────────────────

  exportar() {
    if (this.exportando()) return;
    this.exportando.set(true);

    this.backupSvc.exportar(this.lojaUuid()).subscribe({
      next: (snapshot) => {
        // Filtra categorias globais — apenas seus produtos vão no arquivo.
        const snapshotFiltrado = this.filtrarCategoriasGlobais(snapshot);
        const json = JSON.stringify(snapshotFiltrado, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);

        const a    = document.createElement('a');
        a.href     = url;
        a.download = `backup-loja-${this.lojaUuid()}-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);

        this.exportando.set(false);
        toast.success('Backup baixado com sucesso!');
      },
      error: (e) => {
        this.exportando.set(false);
        toast.error(e?.error?.error ?? 'Erro ao exportar backup.');
      },
    });
  }

  // ── Import ────────────────────────────────────────────────────────────────

  onArquivoSelecionado(event: Event) {
    const input = event.target as HTMLInputElement;
    this.arquivoSelecionado.set(input.files?.[0] ?? null);
  }

  limparArquivo() {
    this.arquivoSelecionado.set(null);
  }

  restaurar() {
    const arquivo = this.arquivoSelecionado();
    if (!arquivo || this.restaurando()) return;

    this.restaurando.set(true);

    const reader = new FileReader();
    reader.onload = () => {
      let snapshot: object;
      try {
        snapshot = JSON.parse(reader.result as string);
      } catch {
        this.restaurando.set(false);
        toast.error('Arquivo inválido — não é um JSON válido.');
        return;
      }

      // Remove categorias globais antes de enviar — o backend não deve recriá-las.
      snapshot = this.filtrarCategoriasGlobais(snapshot);

      this.backupSvc.restaurar(this.lojaUuid(), snapshot).subscribe({
        next: (res: any) => {
          this.restaurando.set(false);
          this.arquivoSelecionado.set(null);
          toast.success(
            `Backup restaurado! ` +
            `${res.categorias} categorias · ${res.produtos} produtos · ` +
            `${res.montagens} montagens · ${res.cupons} cupons`
          );
        },
        error: (e) => {
          this.restaurando.set(false);
          toast.error(e?.error?.error ?? 'Erro ao restaurar backup.');
        },
      });
    };
    reader.readAsText(arquivo);
  }
}
