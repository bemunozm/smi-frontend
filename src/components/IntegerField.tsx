import { DecimalField, type DecimalFieldProps } from './DecimalField';

/**
 * Campo para conteos y para lo que el servidor valida con `@IsInt` (cantidad de
 * insumos, umbral en horas). Lee con `parseInteger`, así que `1.200` y `1,200`
 * valen 1200 en cualquier idioma del equipo; un decimal (`12,5`) no es un
 * número. Entrega `NaN` si está vacío o no es un entero.
 */
export function IntegerField(props: Omit<DecimalFieldProps, 'entero'>) {
  return <DecimalField {...props} entero />;
}
