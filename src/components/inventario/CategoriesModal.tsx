import { useState } from 'react';
import {
  Button,
  Chip,
  Input,
  Label,
  Modal,
  Spinner,
  TextField,
} from '@heroui/react';
import { Info } from 'lucide-react';

import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
} from '../../hooks/useCategories';
import type { ItemCategory } from '../../types/category';

/**
 * Una fila de la taxonomía. El renombrado es en el lugar y no en otro modal:
 * la corrección típica es un typo («Filttros»), y mandar al usuario a una
 * segunda pantalla para cambiar una letra es más ceremonia que el arreglo.
 */
function CategoryRow({ category }: { category: ItemCategory }) {
  const [name, setName] = useState(category.name);
  const [showBlocked, setShowBlocked] = useState(false);
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const trimmed = name.trim();
  const changed = trimmed !== category.name && trimmed.length >= 2;
  const count = category._count.items;
  const inUse = count > 0;

  return (
    <div className="flex flex-col gap-2 border-b border-border py-2 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2">
        <TextField
          aria-label={`Nombre de ${category.name}`}
          className="min-w-44 flex-1"
          value={name}
          onChange={setName}
        >
          <Input />
        </TextField>

        {/* El conteo no es decorativo: es la razón por la que no se puede
            eliminar. */}
        <Chip size="sm" variant="soft">
          {count} ítem{count === 1 ? '' : 's'}
        </Chip>

        <Button
          isDisabled={!changed || updateCategory.isPending}
          size="sm"
          variant="secondary"
          onPress={() => updateCategory.mutate({ id: category.id, name: trimmed })}
        >
          Guardar
        </Button>

        {/* Con ítems el botón NO se desactiva: un botón apagado no dice por qué
            lo está, y el usuario se queda apretando sin entender. Se deja vivo
            y al apretarlo explica qué hacer. */}
        <Button
          className="text-danger"
          isDisabled={deleteCategory.isPending}
          size="sm"
          variant="secondary"
          onPress={() => {
            if (inUse) {
              setShowBlocked(true);
              return;
            }
            deleteCategory.mutate(category.id);
          }}
        >
          Eliminar
        </Button>
      </div>

      {showBlocked && inUse ? (
        <div className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning-soft-foreground">
          <Info className="mt-0.5 shrink-0" size={16} />
          <div className="flex flex-col gap-1">
            <p>
              <strong>{category.name}</strong> no se puede eliminar: la{' '}
              {count === 1 ? 'usa 1 ítem' : `usan ${count} ítems`}. Si la
              borráramos,{' '}
              {count === 1 ? 'ese ítem quedaría' : 'esos ítems quedarían'} sin
              categoría sin avisar.
            </p>
            <p>
              Para eliminarla, abre cada uno de esos ítems y cambiale la
              categoría (o elimina el ítem si ya no existe en bodega). Después
              vuelve acá.
            </p>
            <button
              className="w-fit text-xs font-semibold underline"
              onClick={() => setShowBlocked(false)}
              type="button"
            >
              Entendido
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Administración de las categorías del catálogo (T05 · DEV-29): la taxonomía
 * base se siembra, pero tiene que poder crecer desde la app — cada faena
 * clasifica distinto y nadie va a pedir un despliegue para agregar
 * «Soldadura».
 */
export function CategoriesModal() {
  const { data: categories, isPending } = useCategories();
  const createCategory = useCreateCategory();
  const [newName, setNewName] = useState('');

  const trimmed = newName.trim();

  return (
    <Modal>
      <Button variant="secondary">Categorías</Button>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-lg">
            {() => (
              <>
                <Modal.CloseTrigger />
                <Modal.Header>
                  <Modal.Heading className="font-display text-xl font-semibold tracking-[-0.02em]">
                    Categorías
                  </Modal.Heading>
                </Modal.Header>
                <Modal.Body>
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-end gap-2">
                      <TextField
                        className="min-w-48 flex-1"
                        value={newName}
                        onChange={setNewName}
                      >
                        <Label>Nueva categoría</Label>
                        <Input placeholder="Soldadura y consumibles" />
                      </TextField>
                      <Button
                        isDisabled={trimmed.length < 2}
                        isPending={createCategory.isPending}
                        onPress={() =>
                          createCategory.mutate(trimmed, {
                            onSuccess: () => setNewName(''),
                          })
                        }
                      >
                        {({ isPending: pending }) =>
                          pending ? (
                            <Spinner color="current" size="sm" />
                          ) : (
                            'Agregar'
                          )
                        }
                      </Button>
                    </div>

                    {isPending ? (
                      <div className="flex justify-center py-8">
                        <Spinner color="accent" size="lg" />
                      </div>
                    ) : (
                      <div className="flex flex-col">
                        {(categories ?? []).map((category) => (
                          <CategoryRow category={category} key={category.id} />
                        ))}
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground">
                      Renombrar una categoría es seguro: los ítems la siguen
                      apuntando. Eliminarla solo se puede cuando no la usa
                      ningún ítem.
                    </p>
                  </div>
                </Modal.Body>
              </>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
