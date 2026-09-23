import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

import { EquiposView } from './EquiposView';

// La sesión real la resuelve Better Auth contra el backend; acá solo importa
// qué rol ve la pantalla, que es lo que decide las acciones visibles.
vi.mock('../hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: { id: 'u1', name: 'Admin SMI', email: 'admin@smi.local', role: 'ADMIN' },
    role: 'ADMIN',
    isPending: false,
    isAuthenticated: true,
  }),
}));

// Los formularios (create/edit) consultan sucursales para el selector
// `homeBranch` — mockeada sin datos porque estos tests no abren esos modales.
vi.mock('../hooks/useBranches', () => ({
  useBranches: () => ({ data: [] }),
}));

afterEach(cleanup);

const EQUIPO = {
  id: 'eq_1',
  internalCode: 'EX-001',
  licensePlate: null,
  equipmentClass: 'HEAVY' as const,
  type: 'Excavadora',
  brand: 'Caterpillar',
  model: '336',
  year: 2019,
  controlUnit: 'HOURS' as const,
  currentHourmeter: 1200,
  currentMileage: null,
  status: 'OPERATIONAL' as const,
  homeBranchId: null,
  photoUrl: null,
  operator: { id: 'u_op', name: 'Pedro Soto' },
  supervisor: { id: 'u_sup', name: 'Luis Vega' },
  inUse: true,
  currentFuelLevel: 72,
  openShift: null,
  // Sin alerta de documentos — el fixture base representa el caso más común
  // (equipo recién dado de alta, sin documentos vencidos/por vencer todavía);
  // los tests de `EquiposView — indicador de vencimientos` sobrescriben con
  // `'VENCIDO'`/`'POR_VENCER'`.
  documentsAlert: null as 'VENCIDO' | 'POR_VENCER' | null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

// Sin esto, el `QueryClient` por defecto (`staleTime: 0`) trata los datos
// sembrados con `setQueryData` como stale de entrada: al montar, cada
// `useQuery` dispara un refetch en segundo plano contra la API real (axios),
// aunque la key ya esté seedeada — acá eso incluye `HorometroAPI`/
// `CombustibleAPI`, que no están mockeadas en este archivo. `retry: false`
// evita además que un fallo de red quede reintentando en segundo plano.
function crearQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
}

function renderConDatos(ui: React.ReactElement, seed: (qc: QueryClient) => void, ruta = '/') {
  const qc = crearQueryClient();
  seed(qc);
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[ruta]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('EquiposView', () => {
  it('lista los equipos con su estado y uso', () => {
    renderConDatos(<EquiposView />, (qc) => {
      qc.setQueryData(['equipment'], [EQUIPO]);
      qc.setQueryData(['equipment', 'resumen'], {
        total: 1,
        disponibles: 1,
        porEstado: { OPERATIONAL: 1, IN_WORKSHOP: 0, OUT_OF_SERVICE: 0 },
      });
    });

    // El código y el uso aparecen dos veces: en la tabla (PC) y en la
    // tarjeta equivalente (tablet/celular) — ambas vistas conviven en el DOM,
    // la que se ve depende del breakpoint (CSS, no de jsdom).
    expect(screen.getAllByText('EX-001').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Excavadora/).length).toBeGreaterThan(0);
    // El estado se muestra con la etiqueta en español, no con el valor del enum.
    expect(screen.getAllByText('Operativo').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1.200 h').length).toBeGreaterThan(0);
    // Columnas nuevas de fidelidad con el artefacto: combustible y "en uso por".
    expect(screen.getAllByText('72%').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pedro Soto').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Luis Vega/).length).toBeGreaterThan(0);
  });

  it('muestra "Disponible" cuando el equipo no tiene operador ni supervisor asignado', () => {
    renderConDatos(<EquiposView />, (qc) => {
      qc.setQueryData(['equipment'], [{ ...EQUIPO, inUse: false, operator: null, supervisor: null }]);
      qc.setQueryData(['equipment', 'resumen'], {
        total: 1,
        disponibles: 1,
        porEstado: { OPERATIONAL: 1, IN_WORKSHOP: 0, OUT_OF_SERVICE: 0 },
      });
    });

    expect(screen.getAllByText('Disponible').length).toBeGreaterThan(0);
  });

  // Antes esto se decidía leyendo `inUse` (que el backend deriva de
  // `!!operator`): un equipo con supervisor asignado pero SIN operador
  // quedaba mostrando "Disponible" y el supervisor desaparecía de la fila,
  // aunque la asignación sí existía (Fix 4, review QA de fidelidad).
  it('muestra al supervisor aunque no haya operador asignado (no depende solo de "inUse")', () => {
    renderConDatos(<EquiposView />, (qc) => {
      qc.setQueryData(['equipment'], [{ ...EQUIPO, inUse: false, operator: null }]);
      qc.setQueryData(['equipment', 'resumen'], {
        total: 1,
        disponibles: 1,
        porEstado: { OPERATIONAL: 1, IN_WORKSHOP: 0, OUT_OF_SERVICE: 0 },
      });
    });

    expect(screen.getAllByText(/Luis Vega/).length).toBeGreaterThan(0);
    expect(screen.queryByText('Disponible')).toBeNull();
  });

  it('muestra el estado vacío cuando ningún equipo coincide', () => {
    renderConDatos(<EquiposView />, (qc) => {
      qc.setQueryData(['equipment'], []);
      qc.setQueryData(['equipment', 'resumen'], {
        total: 0,
        disponibles: 0,
        porEstado: { OPERATIONAL: 0, IN_WORKSHOP: 0, OUT_OF_SERVICE: 0 },
      });
    });

    expect(screen.getByText('No hay equipos que coincidan')).toBeTruthy();
  });

});

// Hoja de acciones móvil (`EquipoCardMobile`): el tile de horómetro ofrece
// "Registrar entrada" o "Registrar salida" según `equipo.openShift` — misma
// lógica de estado que el botón del header en `EquipoDetalleView` (ver
// `EquipoDetalleView.test.tsx — flujo de horómetro`). La tarjeta en sí no
// tiene un rol/aria-label propio (solo envuelve el contenido visual), así
// que se ubica por clase — no hay otro selector estable disponible acá.
describe('EquiposView — hoja de acciones móvil (horómetro)', () => {
  it('sin turno abierto, el tile de horómetro ofrece "Registrar entrada"', async () => {
    const { container } = renderConDatos(<EquiposView />, (qc) => {
      qc.setQueryData(['equipment'], [EQUIPO]);
      qc.setQueryData(['equipment', 'resumen'], {
        total: 1,
        disponibles: 1,
        porEstado: { OPERATIONAL: 1, IN_WORKSHOP: 0, OUT_OF_SERVICE: 0 },
      });
    });

    const trigger = container.querySelector('button.block.w-full') as HTMLButtonElement;
    fireEvent.click(trigger);

    expect(await screen.findByRole('button', { name: 'Registrar entrada' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Registrar salida' })).toBeNull();
  });

  it('con turno abierto, el tile de horómetro ofrece "Registrar salida"', async () => {
    const equipoConTurno = {
      ...EQUIPO,
      openShift: {
        id: 'h_abierto',
        valorInicial: 1200,
        operador: 'Carlos Núñez',
        turno: 'DIURNO',
        fecha: '2026-08-06T08:00:00.000Z',
      },
    };
    const { container } = renderConDatos(<EquiposView />, (qc) => {
      qc.setQueryData(['equipment'], [equipoConTurno]);
      qc.setQueryData(['equipment', 'resumen'], {
        total: 1,
        disponibles: 1,
        porEstado: { OPERATIONAL: 1, IN_WORKSHOP: 0, OUT_OF_SERVICE: 0 },
      });
    });

    const trigger = container.querySelector('button.block.w-full') as HTMLButtonElement;
    fireEvent.click(trigger);

    expect(await screen.findByRole('button', { name: 'Registrar salida' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Registrar entrada' })).toBeNull();
  });
});

// R3 — vista diferenciada por clase (auditoría de fidelidad Flota/Equipos):
// el listado no mostraba la patente en absoluto; ahora un equipo PESADO se
// identifica de un vistazo por su patente, y uno LIVIANO por
// patente+marca+modelo (`equipoIdentidad`, `flota-colors.ts`).
describe('EquiposView — R3 identidad por clase', () => {
  it('equipo PESADO con patente: la muestra destacada (aparte de marca/modelo)', () => {
    renderConDatos(<EquiposView />, (qc) => {
      qc.setQueryData(['equipment'], [{ ...EQUIPO, equipmentClass: 'HEAVY', licensePlate: 'AB-CD-12' }]);
      qc.setQueryData(['equipment', 'resumen'], {
        total: 1,
        disponibles: 1,
        porEstado: { OPERATIONAL: 1, IN_WORKSHOP: 0, OUT_OF_SERVICE: 0 },
      });
    });

    // La patente aparece en la tabla (PC) y en la tarjeta (tablet/celular).
    expect(screen.getAllByText('AB-CD-12').length).toBeGreaterThan(0);
    // Marca/modelo se sigue mostrando aparte (la patente no los reemplaza).
    expect(screen.getAllByText(/Caterpillar 336/).length).toBeGreaterThan(0);
  });

  it('equipo LIVIANO con patente: muestra patente + marca + modelo juntos', () => {
    renderConDatos(<EquiposView />, (qc) => {
      qc.setQueryData(
        ['equipment'],
        [{ ...EQUIPO, equipmentClass: 'LIGHT' as const, licensePlate: 'XY-12-34', type: 'Camioneta' }],
      );
      qc.setQueryData(['equipment', 'resumen'], {
        total: 1,
        disponibles: 1,
        porEstado: { OPERATIONAL: 1, IN_WORKSHOP: 0, OUT_OF_SERVICE: 0 },
      });
    });

    expect(screen.getAllByText('XY-12-34 · Caterpillar 336').length).toBeGreaterThan(0);
  });

  it('equipo PESADO sin patente: no deja un hueco vacío — cae al código interno ya visible', () => {
    renderConDatos(<EquiposView />, (qc) => {
      qc.setQueryData(['equipment'], [{ ...EQUIPO, equipmentClass: 'HEAVY', licensePlate: null }]);
      qc.setQueryData(['equipment', 'resumen'], {
        total: 1,
        disponibles: 1,
        porEstado: { OPERATIONAL: 1, IN_WORKSHOP: 0, OUT_OF_SERVICE: 0 },
      });
    });

    // El código interno sigue siendo el identificador — sin duplicarlo como
    // "patente destacada" (esa línea extra no debe aparecer).
    expect(screen.getAllByText('EX-001').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Caterpillar 336/).length).toBeGreaterThan(0);
  });

  it('equipo LIVIANO sin patente: muestra marca y modelo a secas (sin patente inventada)', () => {
    renderConDatos(<EquiposView />, (qc) => {
      qc.setQueryData(['equipment'], [{ ...EQUIPO, equipmentClass: 'LIGHT' as const, licensePlate: null }]);
      qc.setQueryData(['equipment', 'resumen'], {
        total: 1,
        disponibles: 1,
        porEstado: { OPERATIONAL: 1, IN_WORKSHOP: 0, OUT_OF_SERVICE: 0 },
      });
    });

    expect(screen.getAllByText('Caterpillar 336').length).toBeGreaterThan(0);
    expect(screen.queryByText(/· Caterpillar 336/)).toBeNull();
  });
});

// Indicador discreto de documentos en el listado: badge chico junto al chip
// de estado cuando `equipo.documentsAlert` viene informado (derivado on-read
// por el backend a partir de los documentos de la unidad — dominio
// "Documentos de equipo", ver `types/equipment-document.ts`).
describe('EquiposView — indicador de documentos', () => {
  it('no muestra el indicador cuando documentsAlert es null', () => {
    renderConDatos(<EquiposView />, (qc) => {
      qc.setQueryData(['equipment'], [EQUIPO]);
      qc.setQueryData(['equipment', 'resumen'], {
        total: 1,
        disponibles: 1,
        porEstado: { OPERATIONAL: 1, IN_WORKSHOP: 0, OUT_OF_SERVICE: 0 },
      });
    });

    expect(screen.queryByLabelText(/Revisión técnica o seguro/)).toBeNull();
  });

  it('muestra el indicador en tono ámbar cuando documentsAlert es POR_VENCER', () => {
    renderConDatos(<EquiposView />, (qc) => {
      qc.setQueryData(['equipment'], [{ ...EQUIPO, documentsAlert: 'POR_VENCER' as const }]);
      qc.setQueryData(['equipment', 'resumen'], {
        total: 1,
        disponibles: 1,
        porEstado: { OPERATIONAL: 1, IN_WORKSHOP: 0, OUT_OF_SERVICE: 0 },
      });
    });

    expect(screen.getAllByLabelText('Revisión técnica o seguro por vencer').length).toBeGreaterThan(0);
  });

  it('muestra el indicador en tono rojo cuando documentsAlert es VENCIDO', () => {
    renderConDatos(<EquiposView />, (qc) => {
      qc.setQueryData(['equipment'], [{ ...EQUIPO, documentsAlert: 'VENCIDO' as const }]);
      qc.setQueryData(['equipment', 'resumen'], {
        total: 1,
        disponibles: 1,
        porEstado: { OPERATIONAL: 1, IN_WORKSHOP: 0, OUT_OF_SERVICE: 0 },
      });
    });

    expect(screen.getAllByLabelText('Revisión técnica o seguro vencidos').length).toBeGreaterThan(0);
    expect(screen.queryByLabelText('Revisión técnica o seguro por vencer')).toBeNull();
  });
});

// La ficha de detalle (`EquipoDetalleView`) tiene su propio archivo de tests
// — `EquipoDetalleView.test.tsx` — desde la Fase 2 (fidelidad con el
// artefacto): creció lo suficiente (KPIs, estado de uso, actividad reciente)
// como para justificar separarla de este archivo, mismo criterio que el
// resto de las vistas de Flota/Terreno (`CombustibleView.test.tsx`,
// `HorometroView.test.tsx`, etc.).
