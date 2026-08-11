import { useMemo, useState } from 'react';
import {
  ChevronDown, ChevronUp, FolderPlus, Globe, Pencil, Plus, Search, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import {
  useIntranetCategories, useIntranetItems, useIntranetMutations,
  type CategoryInput, type IntranetCategory, type IntranetItem, type ItemInput,
} from '@/hooks/useIntranet';
import CategoriaModal from '@/components/intranet/CategoriaModal';
import ItemModal from '@/components/intranet/ItemModal';
import ItemCard from '@/components/intranet/ItemCard';
import { resolveCategoryIcon } from '@/components/intranet/types';

const Intranet = () => {
  const { isAdmin, currentUserId } = useUserPermissions();

  const [busca, setBusca] = useState('');
  const [categoriaModal, setCategoriaModal] = useState<{ open: boolean; category: IntranetCategory | null }>(
    { open: false, category: null },
  );
  const [itemModal, setItemModal] = useState<{ open: boolean; item: IntranetItem | null; categoryId: string | null }>(
    { open: false, item: null, categoryId: null },
  );

  const { data: categories = [], isLoading: loadingCats } = useIntranetCategories();
  // Rascunhos só entram na listagem do admin.
  const { data: items = [], isLoading: loadingItems } = useIntranetItems(isAdmin);
  const {
    createCategory, updateCategory, deleteCategory, swapCategoryOrder,
    createItem, updateItem, deleteItem,
  } = useIntranetMutations(currentUserId);

  const isLoading = loadingCats || loadingItems;

  /** Itens agrupados por categoria, já filtrados pela busca. */
  const itemsByCategory = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const map = new Map<string, IntranetItem[]>();

    items
      .filter(i => !termo || [i.title, i.description, i.url]
        .some(v => v?.toLowerCase().includes(termo)))
      .forEach(i => {
        const list = map.get(i.category_id);
        if (list) list.push(i);
        else map.set(i.category_id, [i]);
      });

    return map;
  }, [items, busca]);

  // Buscando, categorias sem resultado saem da tela para não virar ruído.
  const visibleCategories = useMemo(() => {
    if (!busca.trim()) return categories;
    return categories.filter(c => (itemsByCategory.get(c.id)?.length ?? 0) > 0);
  }, [categories, itemsByCategory, busca]);

  const handleSaveCategoria = async (input: CategoryInput) => {
    const editing = categoriaModal.category;
    if (editing) await updateCategory.mutateAsync({ id: editing.id, ...input });
    else await createCategory.mutateAsync({ ...input, afterCount: categories.length });
  };

  const handleSaveItem = async (input: ItemInput & { category_id: string }) => {
    const editing = itemModal.item;
    if (editing) await updateItem.mutateAsync({ id: editing.id, ...input });
    else {
      const irmaos = items.filter(i => i.category_id === input.category_id).length;
      await createItem.mutateAsync({ ...input, afterCount: irmaos });
    }
  };

  const handleDeleteCategoria = (category: IntranetCategory) => {
    const dentro = items.filter(i => i.category_id === category.id);
    const aviso = dentro.length
      ? `Excluir "${category.name}" e os ${dentro.length} item(ns) dentro dela?`
      : `Excluir a categoria "${category.name}"?`;
    if (!window.confirm(aviso)) return;

    deleteCategory.mutate({
      id: category.id,
      itemPaths: dentro.flatMap(i => i.attachments.map(a => a.path)).filter(Boolean),
    });
  };

  const handleDeleteItem = (item: IntranetItem) => {
    if (!window.confirm(`Excluir o item "${item.title}"?`)) return;
    deleteItem.mutate(item);
  };

  /** Move a categoria uma posição para cima/baixo trocando com a vizinha. */
  const handleMove = (index: number, dir: -1 | 1) => {
    const a = categories[index];
    const b = categories[index + dir];
    if (!a || !b) return;
    swapCategoryOrder.mutate({ a, b });
  };

  const semConteudo = !isLoading && categories.length === 0;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="shrink-0 flex items-center justify-between gap-4 flex-wrap px-6 py-4 border-b border-border">
        <div className="relative w-full max-w-[320px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar na intranet…"
            className="pl-8"
            aria-label="Buscar na intranet"
          />
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setCategoriaModal({ open: true, category: null })}
            >
              <FolderPlus className="w-4 h-4" /> Nova categoria
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              disabled={categories.length === 0}
              title={categories.length === 0 ? 'Crie uma categoria primeiro' : undefined}
              onClick={() => setItemModal({ open: true, item: null, categoryId: null })}
            >
              <Plus className="w-4 h-4" /> Novo item
            </Button>
          </div>
        )}
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="space-y-4 max-w-[900px]">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-[120px] bg-card border border-border rounded-sm animate-pulse" />
            ))}
          </div>
        ) : semConteudo ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-sm">
              <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Globe className="h-7 w-7 text-primary" strokeWidth={1.5} />
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-1.5">Intranet</h2>
              <p className="text-sm text-muted-foreground mb-4">
                {isAdmin
                  ? 'Nada publicado ainda. Crie a primeira categoria — treinamentos, modelos de contrato, links úteis — e comece a anexar conteúdo.'
                  : 'Nada publicado ainda. Em breve você encontrará aqui treinamentos, modelos de contrato e links úteis.'}
              </p>
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setCategoriaModal({ open: true, category: null })}
                >
                  <FolderPlus className="w-4 h-4" /> Nova categoria
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-5 max-w-[900px]">
            {visibleCategories.map(category => {
              const Icon = resolveCategoryIcon(category.icon);
              const lista = itemsByCategory.get(category.id) ?? [];
              // Índice na lista completa — as setas reordenam a ordem real,
              // não a filtrada pela busca.
              const index = categories.findIndex(c => c.id === category.id);

              return (
                <section key={category.id}>
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="mt-0.5 h-8 w-8 shrink-0 rounded-sm bg-primary/10 flex items-center justify-center">
                        <Icon className="h-4 w-4 text-primary" strokeWidth={1.5} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                          {category.name}
                          <span className="text-[11px] font-normal text-muted-foreground tabular-nums">
                            {lista.length}
                          </span>
                        </h3>
                        {category.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{category.description}</p>
                        )}
                      </div>
                    </div>

                    {isAdmin && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          onClick={() => handleMove(index, -1)}
                          disabled={index <= 0}
                          className="p-1 rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                          title="Mover para cima"
                          aria-label={`Mover ${category.name} para cima`}
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleMove(index, 1)}
                          disabled={index >= categories.length - 1}
                          className="p-1 rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                          title="Mover para baixo"
                          aria-label={`Mover ${category.name} para baixo`}
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setCategoriaModal({ open: true, category })}
                          className="p-1 rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          title="Editar categoria"
                          aria-label={`Editar ${category.name}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteCategoria(category)}
                          className="p-1 rounded-sm text-muted-foreground hover:bg-muted hover:text-destructive transition-colors"
                          title="Excluir categoria"
                          aria-label={`Excluir ${category.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {lista.map(item => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        canManage={isAdmin}
                        onEdit={i => setItemModal({ open: true, item: i, categoryId: i.category_id })}
                        onDelete={handleDeleteItem}
                      />
                    ))}

                    {lista.length === 0 && (
                      <div
                        className={cn(
                          'border border-dashed border-border rounded-sm px-3.5 py-4 text-center',
                          'md:col-span-2',
                        )}
                      >
                        {isAdmin ? (
                          <button
                            onClick={() => setItemModal({ open: true, item: null, categoryId: category.id })}
                            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                          >
                            <Plus className="w-3.5 h-3.5" /> Adicionar link ou anexo
                          </button>
                        ) : (
                          <p className="text-xs text-muted-foreground">Nenhum conteúdo nesta seção ainda.</p>
                        )}
                      </div>
                    )}
                  </div>

                  {isAdmin && lista.length > 0 && (
                    <button
                      onClick={() => setItemModal({ open: true, item: null, categoryId: category.id })}
                      className="inline-flex items-center gap-1.5 text-[11px] text-primary hover:underline mt-2"
                    >
                      <Plus className="w-3 h-3" /> Adicionar em {category.name}
                    </button>
                  )}
                </section>
              );
            })}

            {busca.trim() && visibleCategories.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-12">
                Nenhum resultado para “{busca.trim()}”.
              </p>
            )}
          </div>
        )}
      </div>

      {isAdmin && (
        <>
          <CategoriaModal
            open={categoriaModal.open}
            onOpenChange={open => setCategoriaModal(prev => ({ ...prev, open }))}
            category={categoriaModal.category}
            onSave={handleSaveCategoria}
          />
          <ItemModal
            open={itemModal.open}
            onOpenChange={open => setItemModal(prev => ({ ...prev, open }))}
            item={itemModal.item}
            defaultCategoryId={itemModal.categoryId}
            categories={categories}
            onSave={handleSaveItem}
          />
        </>
      )}
    </div>
  );
};

export default Intranet;
