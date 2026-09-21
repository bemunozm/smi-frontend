import type { ReactNode } from 'react';
import { Table } from '@heroui/react';

import { DESKTOP_QUERY, useMediaQuery } from '../../hooks/useMediaQuery';
import { SectionHeader } from './mobile';

/**
 * Las cuatro vistas de Terreno son la misma pantalla: un formulario para
 * registrar y, debajo, lo registrado. Este archivo tiene las dos piezas que
 * comparten para verse igual en las tres anchos, y así el ajuste vive en un
 * lugar y no en cuatro copias que se desincronizan.
 */

/** Mismo tratamiento de encabezado que la tabla de Inventario. */
export const COLUMNA = 'text-xs font-bold tracking-[0.06em] uppercase';

/**
 * Formulario e historial, uno al lado del otro desde `lg`.
 *
 * En teléfono y tablet quedan apilados como siempre: primero se registra y
 * después se mira lo registrado, que es el orden en que se usa en faena. En
 * escritorio esa pila deja el historial bajo la línea de flote y el formulario
 * estirado; en dos columnas, el formulario conserva un ancho de formulario y el
 * historial se queda con el resto, que es lo que la tabla necesita.
 */
export function VistaTerreno({
  titulo,
  formulario,
  historial,
}: {
  /** Encabezado de la pantalla, si la vista tiene uno. Va sobre las dos columnas. */
  titulo?: ReactNode;
  formulario: ReactNode;
  historial: ReactNode;
}) {
  return (
    <>
      {titulo}
      <div className="lg:flex lg:items-start lg:gap-6">
        <div className="lg:w-[26rem] lg:shrink-0">{formulario}</div>
        <div className="lg:min-w-0 lg:flex-1">{historial}</div>
      </div>
    </>
  );
}

/**
 * Lo registrado: tarjetas en teléfono y tablet, tabla desde escritorio.
 *
 * Es el mismo criterio que usa `InventarioView`, y la razón está en el
 * comentario de `useMediaQuery`: se monta UNA de las dos estructuras, no las
 * dos con una tapada por CSS. Serían los mismos registros dos veces en el DOM
 * y un lector de pantalla leería el historial duplicado. Por eso `tabla` y
 * `tarjetas` son funciones: solo se construye la que se va a mostrar.
 */
export function Historial({
  titulo,
  accion = 'Ver todos',
  vacio,
  hayRegistros,
  tabla,
  tarjetas,
}: {
  titulo: ReactNode;
  accion?: ReactNode;
  /** Qué decir cuando todavía no hay nada. */
  vacio: string;
  hayRegistros: boolean;
  tabla: () => ReactNode;
  tarjetas: () => ReactNode;
}) {
  const esEscritorio = useMediaQuery(DESKTOP_QUERY);

  return (
    <section>
      <SectionHeader action={accion}>{titulo}</SectionHeader>
      {!hayRegistros ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          {vacio}
        </p>
      ) : esEscritorio ? (
        tabla()
      ) : (
        <div className="space-y-2.5">{tarjetas()}</div>
      )}
    </section>
  );
}

/** Envoltura de la tabla, con el mismo `variant` y scroll horizontal que Inventario. */
export function Tabla({
  label,
  anchoMinimo = 'min-w-160',
  children,
}: {
  /** Nombre accesible de la tabla: es lo que anuncia un lector de pantalla. */
  label: string;
  anchoMinimo?: string;
  children: ReactNode;
}) {
  return (
    <Table variant="secondary">
      <Table.ScrollContainer>
        <Table.Content aria-label={label} className={anchoMinimo}>
          {children}
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}
