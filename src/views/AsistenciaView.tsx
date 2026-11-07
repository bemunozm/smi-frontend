import { useMemo, useState } from 'react';
import { Button, Card, Chip, Label, ListBox, Select, Spinner } from '@heroui/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { useAsistencia } from '../hooks/useAsistencia';
import type { PersonaAsistencia } from '../types/asistencia';

const FILTROS = [
  { value: 'TODOS', label: 'Todos' },
  { value: 'SUPERVISOR', label: 'Solo supervisores' },
  { value: 'OPERADOR', label: 'Solo operadores' },
] as const;

const GRUPO = {
  SUPERVISOR: { titulo: 'Supervisores', chip: 'accent' as const, x: 'text-(--accent)' },
  OPERADOR: { titulo: 'Operadores', chip: 'success' as const, x: 'text-success-soft-foreground' },
};

/** Inicial del día de semana (L M X J V S D) de un día del `mes` (YYYY-MM). */
const INICIALES = ['D', 'L', 'M', 'X', 'J', 'V', 'S'] as const;

function mesActual(): string {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
}

function sumarMes(mes: string, delta: number): string {
  const [anio, numero] = mes.split('-').map(Number);
  const corrido = new Date(anio, numero - 1 + delta, 15);
  return `${corrido.getFullYear()}-${String(corrido.getMonth() + 1).padStart(2, '0')}`;
}

function tituloMes(mes: string): string {
  const [anio, numero] = mes.split('-').map(Number);
  const texto = new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric' }).format(
    new Date(anio, numero - 1, 15),
  );
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function diaSemana(mes: string, dia: number): number {
  const [anio, numero] = mes.split('-').map(Number);
  return new Date(anio, numero - 1, dia).getDay();
}

/**
 * Asistencia mensual del administrador/secretaria (`/asistencia`): la hoja
 * «DIAS TRABAJO MES» del Excel, derivada sola de los registros — una X por
 * día TRABAJADO (día del turno, nunca el de subida; ver el endpoint).
 * Supervisores y operadores separados y con color propio; el Total por fila
 * es el número que va a la liquidación.
 */
export function AsistenciaView() {
  const [mes, setMes] = useState(mesActual);
  const [filtro, setFiltro] = useState<string>('TODOS');
  const { data, isPending, isError, error } = useAsistencia(mes);

  const dias = useMemo(
    () => Array.from({ length: data?.dias ?? 0 }, (_, i) => i + 1),
    [data?.dias],
  );
  const personas = useMemo(
    () => (data?.personas ?? []).filter((p) => filtro === 'TODOS' || p.tipo === filtro),
    [data?.personas, filtro],
  );
  const esMesActual = mes === mesActual();
  const hoy = new Date().getDate();

  const celdasDia = (p: PersonaAsistencia) => {
    const marcados = new Set(p.dias);
    return dias.map((dia) => {
      const finDeSemana = [0, 6].includes(diaSemana(mes, dia));
      return (
        <td
          className={`px-1.5 py-2 text-center font-mono text-sm font-semibold ${GRUPO[p.tipo].x} ${
            finDeSemana ? 'bg-surface-secondary/60' : ''
          } ${esMesActual && dia === hoy ? 'bg-(--accent)/10' : ''}`}
          key={dia}
        >
          {marcados.has(dia) ? 'X' : ''}
        </td>
      );
    });
  };

  const filaGrupo = (tipo: PersonaAsistencia['tipo']) => (
    <tr className="bg-surface-secondary" key={`grupo-${tipo}`}>
      <th
        className="sticky left-0 z-10 bg-surface-secondary px-3 py-2 text-left text-[11px] font-bold tracking-wider text-muted-foreground uppercase"
        colSpan={1}
        scope="colgroup"
      >
        {GRUPO[tipo].titulo}
      </th>
      <td colSpan={dias.length + 1} />
    </tr>
  );

  const filas: JSX.Element[] = [];
  let grupoAnterior: PersonaAsistencia['tipo'] | null = null;
  for (const p of personas) {
    if (p.tipo !== grupoAnterior) {
      filas.push(filaGrupo(p.tipo));
      grupoAnterior = p.tipo;
    }
    filas.push(
      <tr className="border-t border-separator" data-testid={`fila-${p.id}`} key={p.id}>
        <th
          className="sticky left-0 z-10 flex items-center gap-2 bg-card px-3 py-2 text-left text-sm font-medium whitespace-nowrap text-foreground"
          scope="row"
        >
          {p.nombre}
          <Chip color={GRUPO[p.tipo].chip} size="sm" variant="soft">
            {p.tipo === 'SUPERVISOR' ? 'Supervisor' : 'Operador'}
          </Chip>
        </th>
        {celdasDia(p)}
        <td
          className="px-3 py-2 text-center font-mono text-sm font-bold text-foreground"
          data-testid={`total-${p.id}`}
        >
          {p.total}
        </td>
      </tr>,
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium tracking-[0.14em] text-(--eyebrow-color) uppercase">
            SMI · Asistencia
          </span>
          <h1 className="font-display text-[28px] font-semibold tracking-[-0.03em] text-foreground">
            Días de trabajo del mes
          </h1>
          <p className="text-sm text-muted-foreground">
            Una X por día trabajado, derivada de las tarjetas de turno y los Reports: el supervisor
            gana el día del turno que registró; el operador, el día en que usó una máquina.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button aria-label="Mes anterior" onPress={() => setMes((m) => sumarMes(m, -1))} variant="secondary">
            <ChevronLeft aria-hidden className="size-[18px]" />
          </Button>
          <span className="min-w-40 text-center text-sm font-semibold text-foreground">
            {tituloMes(mes)}
          </span>
          <Button aria-label="Mes siguiente" onPress={() => setMes((m) => sumarMes(m, 1))} variant="secondary">
            <ChevronRight aria-hidden className="size-[18px]" />
          </Button>
        </div>
      </div>

      <Card>
        <Card.Header>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <Card.Title>Asistencia</Card.Title>
              <Card.Description>
                Supervisores y operadores por separado. El Total es el dato de la liquidación.
              </Card.Description>
            </div>
            <div className="w-56">
              <Select
                fullWidth
                onChange={(valor) => {
                  if (valor) setFiltro(String(valor));
                }}
                value={filtro}
              >
                <Label>Mostrar</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {FILTROS.map((opcion) => (
                      <ListBox.Item id={opcion.value} key={opcion.value} textValue={opcion.label}>
                        {opcion.label}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>
          </div>
        </Card.Header>
        <Card.Content>
          {isPending ? (
            <div className="flex justify-center py-10">
              <Spinner color="accent" size="sm" />
            </div>
          ) : null}

          {isError ? (
            <p className="text-sm text-danger-soft-foreground" role="alert">
              {error instanceof Error ? error.message : 'No se pudo cargar la asistencia.'}
            </p>
          ) : null}

          {!isPending && !isError && personas.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">Sin registros este mes.</p>
          ) : null}

          {!isPending && !isError && personas.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-separator">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-separator" data-testid="encabezado-dias">
                    <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                      Nombre
                    </th>
                    {dias.map((dia) => (
                      <th
                        className={`px-1.5 py-1.5 text-center align-bottom ${
                          [0, 6].includes(diaSemana(mes, dia)) ? 'bg-surface-secondary/60' : ''
                        } ${esMesActual && dia === hoy ? 'bg-(--accent)/10' : ''}`}
                        key={dia}
                      >
                        <span className="block text-[10px] font-medium text-muted-foreground">
                          {INICIALES[diaSemana(mes, dia)]}
                        </span>
                        <span className="font-mono text-xs font-semibold text-foreground">{dia}</span>
                      </th>
                    ))}
                    <th className="px-3 py-2 text-center text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>{filas}</tbody>
              </table>
            </div>
          ) : null}
        </Card.Content>
      </Card>
    </div>
  );
}
